import type { INestApplication } from '@nestjs/common';
import type { Connection } from 'mongoose';
import request from 'supertest';
import { OrganizationRole, ProjectRole, TaskPriority, TaskStatus } from '@projectflow/shared';
import { createTestApp, resetDatabase } from './utils/test-app';
import {
  addOrganizationMember,
  addProjectMember,
  authHeader,
  createOrganization,
  createProject,
  registerUser,
  type TestUser,
} from './utils/fixtures';

describe('Tasks', () => {
  let app: INestApplication;
  let connection: Connection;

  let owner: TestUser;
  let member: TestUser;
  let outsider: TestUser;
  let projectId: string;

  beforeAll(async () => {
    ({ app, connection } = await createTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await resetDatabase(connection);

    owner = await registerUser(app, 'Ammar Yaser', 'ammar@example.com');
    member = await registerUser(app, 'Magd Ali', 'magd@example.com');
    outsider = await registerUser(app, 'Outside User', 'outside@example.com');

    const organizationId = await createOrganization(
      connection,
      'Acme Software',
      'acme-software',
      owner.id,
    );
    await addOrganizationMember(connection, organizationId, owner.id, OrganizationRole.OWNER);
    await addOrganizationMember(connection, organizationId, member.id, OrganizationRole.MEMBER);

    projectId = await createProject(
      connection,
      organizationId,
      'Internal Platform',
      'ENG',
      owner.id,
    );
    await addProjectMember(connection, projectId, member.id, ProjectRole.MEMBER);
  });

  it('lets a project member create a task', async () => {
    const response = await request(app.getHttpServer())
      .post(`/projects/${projectId}/tasks`)
      .set('Authorization', authHeader(member))
      .send({
        title: 'Improve API error handling',
        description: 'Normalise validation and permission errors.',
        priority: TaskPriority.HIGH,
      })
      .expect(201);

    expect(response.body).toMatchObject({
      key: 'ENG-1',
      number: 1,
      title: 'Improve API error handling',
      status: TaskStatus.TODO,
      priority: TaskPriority.HIGH,
    });
    expect(response.body.createdBy).toMatchObject({ email: 'magd@example.com' });
  });

  it('numbers tasks sequentially within a project', async () => {
    for (const title of ['First task', 'Second task', 'Third task']) {
      await request(app.getHttpServer())
        .post(`/projects/${projectId}/tasks`)
        .set('Authorization', authHeader(member))
        .send({ title })
        .expect(201);
    }

    const response = await request(app.getHttpServer())
      .get(`/projects/${projectId}/tasks`)
      .set('Authorization', authHeader(member))
      .expect(200);

    expect(response.body.total).toBe(3);
    expect(response.body.items.map((task: { key: string }) => task.key)).toEqual([
      'ENG-1',
      'ENG-2',
      'ENG-3',
    ]);
  });

  it('refuses to create a task for someone outside the project', async () => {
    await request(app.getHttpServer())
      .post(`/projects/${projectId}/tasks`)
      .set('Authorization', authHeader(outsider))
      .send({ title: 'Should not be created' })
      .expect(403);
  });

  it('refuses to list tasks for someone outside the project', async () => {
    await request(app.getHttpServer())
      .get(`/projects/${projectId}/tasks`)
      .set('Authorization', authHeader(outsider))
      .expect(403);
  });

  it('rejects a task without a usable title', async () => {
    const response = await request(app.getHttpServer())
      .post(`/projects/${projectId}/tasks`)
      .set('Authorization', authHeader(member))
      .send({ title: 'ab' })
      .expect(400);

    expect(response.body.statusCode).toBe(400);
  });

  it('filters the task list by status', async () => {
    await request(app.getHttpServer())
      .post(`/projects/${projectId}/tasks`)
      .set('Authorization', authHeader(member))
      .send({ title: 'Work in flight', status: TaskStatus.IN_PROGRESS })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/projects/${projectId}/tasks`)
      .set('Authorization', authHeader(member))
      .send({ title: 'Not started yet' })
      .expect(201);

    const response = await request(app.getHttpServer())
      .get(`/projects/${projectId}/tasks`)
      .query({ status: TaskStatus.IN_PROGRESS })
      .set('Authorization', authHeader(member))
      .expect(200);

    expect(response.body.total).toBe(1);
    expect(response.body.items[0]).toMatchObject({ title: 'Work in flight' });
  });

  it('refuses to update a task status for someone outside the project (IDOR fix)', async () => {
    const createRes = await request(app.getHttpServer())
      .post(`/projects/${projectId}/tasks`)
      .set('Authorization', authHeader(member))
      .send({ title: 'Important Task' })
      .expect(201);
    
    const taskId = createRes.body.id;

    await request(app.getHttpServer())
      .patch(`/tasks/${taskId}/status`)
      .set('Authorization', authHeader(outsider))
      .send({ status: TaskStatus.DONE })
      .expect(403);
  });

  describe('Concurrent Task Creation', () => {
    it('generates unique sequence numbers even under concurrent creation', async () => {
      // Fire 10 simultaneous create requests
      const createPromises = Array.from({ length: 10 }).map((_, i) =>
        request(app.getHttpServer())
          .post(`/projects/${projectId}/tasks`)
          .set('Authorization', authHeader(member))
          .send({ title: `Concurrent Task ${i}` })
          .expect(201)
      );

      const results = await Promise.all(createPromises);
      const keys = results.map(res => res.body.key);
      const uniqueKeys = new Set(keys);
      
      // All 10 keys should be unique (no duplicates)
      expect(uniqueKeys.size).toBe(10);
    });
  });

  describe('Task Assignment and Activity Tracking', () => {
    let taskId: string;
    let manager: TestUser;

    beforeEach(async () => {
      // Create a manager
      manager = await registerUser(app, 'Manager User', 'manager@example.com');
      await addProjectMember(connection, projectId, manager.id, ProjectRole.PROJECT_MANAGER);

      // Create a task by owner
      const res = await request(app.getHttpServer())
        .post(`/projects/${projectId}/tasks`)
        .set('Authorization', authHeader(owner))
        .send({ title: 'Task to be assigned' })
        .expect(201);
      taskId = res.body.id;
    });

    it('allows a manager to assign a task to a project member', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/tasks/${taskId}/assignee`)
        .set('Authorization', authHeader(manager))
        .send({ assigneeId: member.id })
        .expect(200);

      expect(res.body.assignee.id).toBe(member.id);
    });

    it('refuses to let a normal member assign a task they did not create', async () => {
      await request(app.getHttpServer())
        .patch(`/tasks/${taskId}/assignee`)
        .set('Authorization', authHeader(member))
        .send({ assigneeId: member.id })
        .expect(403);
    });

    it('allows a normal member to assign a task they created', async () => {
      const memberTaskRes = await request(app.getHttpServer())
        .post(`/projects/${projectId}/tasks`)
        .set('Authorization', authHeader(member))
        .send({ title: 'My own task' })
        .expect(201);

      await request(app.getHttpServer())
        .patch(`/tasks/${memberTaskRes.body.id}/assignee`)
        .set('Authorization', authHeader(member))
        .send({ assigneeId: owner.id })
        .expect(200);
    });

    it('refuses assignment to a user outside the project', async () => {
      await request(app.getHttpServer())
        .patch(`/tasks/${taskId}/assignee`)
        .set('Authorization', authHeader(owner))
        .send({ assigneeId: outsider.id })
        .expect(403);
    });

    it('records an activity event when assignee is changed', async () => {
      // Assign the task
      await request(app.getHttpServer())
        .patch(`/tasks/${taskId}/assignee`)
        .set('Authorization', authHeader(owner))
        .send({ assigneeId: member.id })
        .expect(200);

      // Fetch the activity timeline
      const activityRes = await request(app.getHttpServer())
        .get(`/tasks/${taskId}/activity`)
        .set('Authorization', authHeader(owner))
        .expect(200);

      expect(activityRes.body.total).toBe(1);
      expect(activityRes.body.items[0]).toMatchObject({
        type: 'TASK_ASSIGNEE_CHANGED',
        metadata: { assigneeId: member.id }
      });
      expect(activityRes.body.items[0].actor.id).toBe(owner.id);
    });
  });
});
