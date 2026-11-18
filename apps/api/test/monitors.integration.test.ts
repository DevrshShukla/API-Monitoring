import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { Application } from 'express';
import { setupTestEnvironment, teardownTestEnvironment, clearTestDatabase } from './setup.js';

let app: Application;

beforeAll(async () => {
  const env = await setupTestEnvironment();
  app = env.app;
});

afterAll(async () => {
  await teardownTestEnvironment();
});

beforeEach(async () => {
  await clearTestDatabase();
});

async function createTestUser(email: string, wsName: string) {
  const res = await request(app).post('/api/v1/auth/register').send({
    email,
    password: 'Password123!',
    name: 'Test User',
    workspaceName: wsName,
  });
  return {
    token: res.body.data.accessToken as string,
    workspaceId: res.body.data.workspace.id as string,
  };
}

describe('Monitor CRUD & Tenancy Isolation (TC-MON-001..003, TC-SEC-004)', () => {
  it('creates monitor with encrypted headers and redacts secret values in response', async () => {
    const { token, workspaceId } = await createTestUser('dev1@example.com', 'Dev Workspace');

    const res = await request(app)
      .post('/api/v1/monitors')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Workspace-Id', workspaceId)
      .send({
        name: 'Public API',
        url: 'https://1.1.1.1/dns-query',
        method: 'GET',
        intervalSeconds: 60,
        timeoutMs: 5000,
        expectedStatusCodes: [200, 204],
        headers: [
          { key: 'Authorization', value: 'Bearer secret_token_xyz', sensitive: true },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe('Public API');
    expect(res.body.data.status).toBe('unknown');
    expect(res.body.data.headersConfigured).toBe(true);
    // Crucial security invariant: raw secret value MUST NOT be returned in API response
    expect(JSON.stringify(res.body)).not.toContain('secret_token_xyz');
  });

  it('rejects monitor creation pointing to loopback or private IP (SSRF guard)', async () => {
    const { token, workspaceId } = await createTestUser('dev2@example.com', 'Dev Workspace');

    const res = await request(app)
      .post('/api/v1/monitors')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Workspace-Id', workspaceId)
      .send({
        name: 'Malicious Internal Monitor',
        url: 'http://127.0.0.1:80/admin',
        method: 'GET',
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('SSRF_BLOCKED');
  });

  it('enforces workspace isolation: cross-workspace read returns safe 404 (RBAC-008)', async () => {
    // User A in Workspace A
    const userA = await createTestUser('usera@example.com', 'Workspace A');
    const monRes = await request(app)
      .post('/api/v1/monitors')
      .set('Authorization', `Bearer ${userA.token}`)
      .set('X-Workspace-Id', userA.workspaceId)
      .send({
        name: 'Workspace A API',
        url: 'https://1.1.1.1/dns-query',
      });

    const monitorId = monRes.body.data.id;

    // User B in Workspace B
    const userB = await createTestUser('userb@example.com', 'Workspace B');

    // User B tries to read Monitor A
    const crossRes = await request(app)
      .get(`/api/v1/monitors/${monitorId}`)
      .set('Authorization', `Bearer ${userB.token}`)
      .set('X-Workspace-Id', userB.workspaceId);

    // MUST return 404 not found to prevent tenant enumeration
    expect(crossRes.status).toBe(404);
  });

  it('pauses and resumes monitor with proper status transitions', async () => {
    const { token, workspaceId } = await createTestUser('dev3@example.com', 'Dev Workspace');

    const monRes = await request(app)
      .post('/api/v1/monitors')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Workspace-Id', workspaceId)
      .send({
        name: 'Toggle API',
        url: 'https://1.1.1.1/test',
      });

    const monitorId = monRes.body.data.id;

    // Pause
    const pauseRes = await request(app)
      .post(`/api/v1/monitors/${monitorId}/pause`)
      .set('Authorization', `Bearer ${token}`)
      .set('X-Workspace-Id', workspaceId);

    expect(pauseRes.status).toBe(200);
    expect(pauseRes.body.data.active).toBe(false);
    expect(pauseRes.body.data.status).toBe('paused');

    // Resume
    const resumeRes = await request(app)
      .post(`/api/v1/monitors/${monitorId}/resume`)
      .set('Authorization', `Bearer ${token}`)
      .set('X-Workspace-Id', workspaceId);

    expect(resumeRes.status).toBe(200);
    expect(resumeRes.body.data.active).toBe(true);
    expect(resumeRes.body.data.status).toBe('unknown');
  });
});
