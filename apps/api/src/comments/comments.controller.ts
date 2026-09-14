import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { CommentEntry, Paginated } from '@projectflow/shared';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PaginationQueryDto } from '../common/dto/pagination.dto';
import { toObjectId } from '../common/utils/object-id';
import { CommentsService } from './comments.service';
import { CreateCommentDto } from './dto/create-comment.dto';

@ApiTags('Comments')
@ApiBearerAuth()
@Controller('tasks/:taskId/comments')
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Get()
  @ApiOperation({ summary: 'Get comments for a task' })
  @ApiResponse({ status: 200, description: 'List of comments.' })
  findByTask(
    @Param('taskId') taskId: string,
    @CurrentUser('id') userId: string,
    @Query() query: PaginationQueryDto,
  ): Promise<Paginated<CommentEntry>> {
    return this.commentsService.findByTask(
      toObjectId(taskId, 'task id'),
      toObjectId(userId, 'user id'),
      query,
    );
  }

  @Post()
  @ApiOperation({ summary: 'Create a comment on a task' })
  @ApiResponse({ status: 201, description: 'Comment created successfully.' })
  create(
    @Param('taskId') taskId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: CreateCommentDto,
  ): Promise<CommentEntry> {
    return this.commentsService.create(
      toObjectId(taskId, 'task id'),
      toObjectId(userId, 'user id'),
      dto,
    );
  }
}
