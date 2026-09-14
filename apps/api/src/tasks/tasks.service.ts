import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { type FilterQuery, Model, Types } from 'mongoose';
import type { CursorPaginated, Paginated, TaskDetail, TaskSummary } from '@projectflow/shared';
import { toUserSummary } from '../common/utils/serialize';
import { Comment, type CommentDocument } from '../comments/schemas/comment.schema';
import { canManage, ProjectAccessService } from '../projects/project-access.service';
import { Project, type ProjectDocument } from '../projects/schemas/project.schema';
import { UsersService } from '../users/users.service';
import type { CreateTaskDto } from './dto/create-task.dto';
import type { ListTasksQueryDto } from './dto/list-tasks.dto';
import type { UpdateTaskDto } from './dto/update-task.dto';
import type { UpdateTaskStatusDto } from './dto/update-task-status.dto';
import type { AssignTaskDto } from './dto/assign-task.dto';
import type { CursorPaginationQueryDto } from '../common/dto/cursor-pagination.dto';
import { Activity, type ActivityDocument, ActivityType } from './schemas/activity.schema';
import { Sequence, type SequenceDocument } from './schemas/sequence.schema';
import { Task, type TaskDocument } from './schemas/task.schema';
import type { ActivityEntry } from '@projectflow/shared';

@Injectable()
export class TasksService {
  constructor(
    @InjectModel(Task.name) private readonly taskModel: Model<TaskDocument>,
    @InjectModel(Project.name) private readonly projectModel: Model<ProjectDocument>,
    @InjectModel(Comment.name) private readonly commentModel: Model<CommentDocument>,
    @InjectModel(Sequence.name) private readonly sequenceModel: Model<SequenceDocument>,
    @InjectModel(Activity.name) private readonly activityModel: Model<ActivityDocument>,
    private readonly projectAccessService: ProjectAccessService,
    private readonly usersService: UsersService,
  ) {}

  async findByProject(
    projectId: Types.ObjectId,
    userId: Types.ObjectId,
    query: ListTasksQueryDto,
  ): Promise<Paginated<TaskSummary>> {
    await this.projectAccessService.assertCanView(projectId, userId);

    const filter: FilterQuery<TaskDocument> = { projectId };
    if (query.status) {
      filter.status = query.status;
    }
    if (query.priority) {
      filter.priority = query.priority;
    }

    const [tasks, total] = await Promise.all([
      this.taskModel.find(filter).sort({ number: 1 }).skip(query.skip).limit(query.pageSize).exec(),
      this.taskModel.countDocuments(filter),
    ]);

    return {
      items: await this.toSummaries(tasks),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async create(
    projectId: Types.ObjectId,
    userId: Types.ObjectId,
    dto: CreateTaskDto,
  ): Promise<TaskDetail> {
    const { project } = await this.projectAccessService.assertCanView(projectId, userId);

    const sequenceDoc = await this.sequenceModel.findOneAndUpdate(
      { projectId },
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );
    const number = sequenceDoc.seq;

    const task = await this.taskModel.create({
      projectId,
      number,
      key: `${project.key}-${number}`,
      title: dto.title,
      description: dto.description ?? null,
      status: dto.status,
      priority: dto.priority,
      createdBy: userId,
    });

    return this.toDetail(task, project);
  }

  async findOne(taskId: Types.ObjectId, userId: Types.ObjectId): Promise<TaskDetail> {
    const task = await this.findTaskOrFail(taskId);
    const { project } = await this.projectAccessService.assertCanView(task.projectId, userId);

    return this.toDetail(task, project);
  }

  async update(
    taskId: Types.ObjectId,
    userId: Types.ObjectId,
    dto: UpdateTaskDto,
  ): Promise<TaskDetail> {
    const task = await this.findTaskOrFail(taskId);
    const access = await this.projectAccessService.assertCanView(task.projectId, userId);

    const isCreator = task.createdBy.equals(userId);
    if (!canManage(access) && !isCreator) {
      throw new ForbiddenException('You do not have permission to edit this task');
    }

    if (dto.title !== undefined) {
      task.title = dto.title;
    }
    if (dto.description !== undefined) {
      task.description = dto.description;
    }
    if (dto.status !== undefined) {
      task.status = dto.status;
    }
    if (dto.priority !== undefined) {
      task.priority = dto.priority;
    }

    await task.save();

    return this.toDetail(task, access.project);
  }

  async updateStatus(
    taskId: Types.ObjectId,
    userId: Types.ObjectId,
    dto: UpdateTaskStatusDto,
  ): Promise<TaskDetail> {
    const task = await this.findTaskOrFail(taskId);
    const access = await this.projectAccessService.assertCanView(task.projectId, userId);

    const isCreator = task.createdBy.equals(userId);
    if (!canManage(access) && !isCreator) {
      throw new ForbiddenException('You do not have permission to edit this task');
    }

    task.status = dto.status;
    await task.save();

    return this.toDetail(task, access.project);
  }

  async assign(taskId: Types.ObjectId, userId: Types.ObjectId, dto: AssignTaskDto): Promise<TaskDetail> {
    const task = await this.findTaskOrFail(taskId);
    const access = await this.projectAccessService.assertCanView(task.projectId, userId);

    const isCreator = task.createdBy.equals(userId);
    if (!canManage(access) && !isCreator) {
      throw new ForbiddenException('You do not have permission to assign this task');
    }

    if (dto.assigneeId) {
      await this.projectAccessService.assertCanView(task.projectId, new Types.ObjectId(dto.assigneeId));
      task.assignee = new Types.ObjectId(dto.assigneeId);
    } else {
      task.assignee = null;
    }

    await task.save();

    await this.activityModel.create({
      taskId: task._id,
      actorId: userId,
      type: ActivityType.TASK_ASSIGNEE_CHANGED,
      metadata: { assigneeId: dto.assigneeId },
    });

    return this.toDetail(task, access.project);
  }

  async getActivity(taskId: Types.ObjectId, userId: Types.ObjectId, query: CursorPaginationQueryDto): Promise<CursorPaginated<ActivityEntry>> {
    const task = await this.findTaskOrFail(taskId);
    await this.projectAccessService.assertCanView(task.projectId, userId);

    const filter: any = { taskId };
    if (query.cursor) {
      filter._id = { $lt: new Types.ObjectId(query.cursor) };
    }

    const limit = query.limit || 20;

    const activities = await this.activityModel
      .find(filter)
      .sort({ _id: -1 })
      .limit(limit + 1)
      .exec();

    let hasMore = false;
    if (activities.length > limit) {
      hasMore = true;
      activities.pop();
    }

    const lastActivity = activities[activities.length - 1];
    const nextCursor = hasMore && lastActivity ? lastActivity._id.toString() : null;

    const actors = await this.usersService.findManyByIds(activities.map(a => a.actorId));
    const actorsById = new Map(actors.map(u => [u._id.toString(), u]));

    const items = activities.map(a => ({
      id: a._id.toString(),
      taskId: a.taskId.toString(),
      actor: toCreatorSummary(actorsById.get(a.actorId.toString())),
      type: a.type,
      metadata: a.metadata,
      createdAt: a.createdAt.toISOString(),
    }));

    return {
      items,
      nextCursor,
      hasMore,
    };
  }

  async remove(taskId: Types.ObjectId, userId: Types.ObjectId): Promise<void> {
    const task = await this.findTaskOrFail(taskId);
    await this.projectAccessService.assertCanManage(task.projectId, userId);

    await Promise.all([
      this.commentModel.deleteMany({ taskId: task._id }),
      this.activityModel.deleteMany({ taskId: task._id }),
      task.deleteOne()
    ]);
  }

  async findTaskOrFail(taskId: Types.ObjectId): Promise<TaskDocument> {
    const task = await this.taskModel.findById(taskId).exec();
    if (!task) {
      throw new NotFoundException('Task not found');
    }
    return task;
  }

  private async toSummaries(tasks: TaskDocument[]): Promise<TaskSummary[]> {
    if (tasks.length === 0) {
      return [];
    }

    const userIds = new Set<string>();
    tasks.forEach(task => {
      userIds.add(task.createdBy.toString());
      if (task.assignee) userIds.add(task.assignee.toString());
    });

    const [users, commentRows] = await Promise.all([
      this.usersService.findManyByIds(Array.from(userIds).map(id => new Types.ObjectId(id))),
      this.commentModel
        .aggregate<{
          _id: Types.ObjectId;
          count: number;
        }>([
          { $match: { taskId: { $in: tasks.map((task) => task._id) } } },
          { $group: { _id: '$taskId', count: { $sum: 1 } } },
        ])
        .exec(),
    ]);

    const usersById = new Map(users.map((user) => [user._id.toString(), user]));
    const commentCounts = new Map(commentRows.map((row) => [row._id.toString(), row.count]));

    return tasks.map((task) => ({
      id: task._id.toString(),
      projectId: task.projectId.toString(),
      number: task.number,
      key: task.key,
      title: task.title,
      status: task.status,
      priority: task.priority,
      commentCount: commentCounts.get(task._id.toString()) ?? 0,
      assignee: task.assignee ? toCreatorSummary(usersById.get(task.assignee.toString())) : null,
      createdBy: toCreatorSummary(usersById.get(task.createdBy.toString())),
      createdAt: task.createdAt.toISOString(),
      updatedAt: task.updatedAt.toISOString(),
    }));
  }

  private async toDetail(task: TaskDocument, project?: ProjectDocument): Promise<TaskDetail> {
    const [summary] = await this.toSummaries([task]);
    const resolvedProject = project ?? (await this.projectModel.findById(task.projectId).exec());

    if (!resolvedProject) {
      throw new NotFoundException('Project not found');
    }

    return {
      ...summary!,
      description: task.description ?? null,
      project: {
        id: resolvedProject._id.toString(),
        name: resolvedProject.name,
        key: resolvedProject.key,
      },
    };
  }
}

const DELETED_USER = {
  id: '',
  name: 'Unknown user',
  email: '',
  avatarUrl: null,
};

function toCreatorSummary(user: Parameters<typeof toUserSummary>[0] | undefined) {
  return user ? toUserSummary(user) : DELETED_USER;
}
