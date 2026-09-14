import type { INestApplication } from '@nestjs/common';
import type { Connection } from 'mongoose';
import request from 'supertest';
import { OrganizationRole } from '@projectflow/shared';
import { createTestApp, resetDatabase } from './utils/test-app';
import {
  addOrganizationMember,
  authHeader,
  createOrganization,
  registerUser,
  type TestUser,
} from './utils/fixtures';

describe('Organizations', () => {
  let app: INestApplication;
  let connection: Connection;

  let owner: TestUser;
  let admin: TestUser;
  let member: TestUser;
  let outsider: TestUser;
  let organizationId: string;

  beforeAll(async () => {
    ({ app, connection } = await createTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await resetDatabase(connection);

    owner = await registerUser(app, 'Ammar Yaser', 'ammar@example.com');
    admin = await registerUser(app, 'Sarah Ahmed', 'sarah@example.com');
    member = await registerUser(app, 'Magd Ali', 'magd@example.com');
    outsider = await registerUser(app, 'Outside User', 'outside@example.com');

    organizationId = await createOrganization(
      connection,
      'Acme Software',
      'acme-software',
      owner.id,
    );
    await addOrganizationMember(connection, organizationId, owner.id, OrganizationRole.OWNER);
    await addOrganizationMember(connection, organizationId, admin.id, OrganizationRole.ADMIN);
    await addOrganizationMember(connection, organizationId, member.id, OrganizationRole.MEMBER);
  });

  describe('GET /organizations', () => {
    it('returns the organizations a user belongs to along with their role', async () => {
      const response = await request(app.getHttpServer())
        .get('/organizations')
        .set('Authorization', authHeader(owner))
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0]).toMatchObject({
        name: 'Acme Software',
        slug: 'acme-software',
        role: OrganizationRole.OWNER,
      });
    });

    it('returns empty array for an outsider', async () => {
      const response = await request(app.getHttpServer())
        .get('/organizations')
        .set('Authorization', authHeader(outsider))
        .expect(200);

      expect(response.body).toEqual([]);
    });
  });

  describe('POST /organizations/:id/members', () => {
    it('allows an organization owner to add a new member', async () => {
      // Register a new user to add
      const newUser = await registerUser(app, 'New User', 'new1@example.com');

      const response = await request(app.getHttpServer())
        .post(`/organizations/${organizationId}/members`)
        .set('Authorization', authHeader(owner))
        .send({ email: newUser.email, role: OrganizationRole.MEMBER })
        .expect(201);

      expect(response.body).toEqual({
        success: true,
      });
    });

    it('allows an organization admin to add a new member', async () => {
      // Register a new user to add
      const newUser = await registerUser(app, 'New User 2', 'new2@example.com');

      const response = await request(app.getHttpServer())
        .post(`/organizations/${organizationId}/members`)
        .set('Authorization', authHeader(admin))
        .send({ email: newUser.email, role: OrganizationRole.MEMBER })
        .expect(201);

      expect(response.body).toEqual({
        success: true,
      });
    });

    it('refuses to let a plain member add someone to the organization', async () => {
      const newUser = await registerUser(app, 'New User 3', 'new3@example.com');

      const response = await request(app.getHttpServer())
        .post(`/organizations/${organizationId}/members`)
        .set('Authorization', authHeader(member))
        .send({ email: newUser.email, role: OrganizationRole.MEMBER })
        .expect(403);
        
      expect(response.body.message).toMatch(/permission/i); // Expecting some "permission" message
    });

    it('refuses to let an outsider add someone to the organization', async () => {
      const newUser = await registerUser(app, 'New User 4', 'new4@example.com');

      const response = await request(app.getHttpServer())
        .post(`/organizations/${organizationId}/members`)
        .set('Authorization', authHeader(outsider))
        .send({ email: newUser.email, role: OrganizationRole.MEMBER });
        
      // Usually outsiders get 403 or 404 depending on how the resource lookup is structured
      expect([403, 404]).toContain(response.status);
    });
  });
});
