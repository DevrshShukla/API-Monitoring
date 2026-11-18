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

describe('Auth Integration Flow (API-AUTH-001..005, ADR-006)', () => {
  it('registers a new user and provisions default workspace and tokens', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: 'alice@example.com',
        password: 'Password123!',
        name: 'Alice Developer',
        workspaceName: 'Acme Corp',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.accessToken).toBeDefined();
    expect(res.body.data.refreshToken).toBeDefined();
    expect(res.body.data.user.email).toBe('alice@example.com');
    expect(res.body.data.user.name).toBe('Alice Developer');
    expect(res.body.data.workspace.name).toBe('Acme Corp');
    expect(res.body.data.workspace.role).toBe('owner');
  });

  it('rejects duplicate registration with 409 CONFLICT', async () => {
    await request(app).post('/api/v1/auth/register').send({
      email: 'bob@example.com',
      password: 'Password123!',
      name: 'Bob',
    });

    const res = await request(app).post('/api/v1/auth/register').send({
      email: 'bob@example.com',
      password: 'AnotherPassword123!',
      name: 'Bob Duplicate',
    });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  it('authenticates user with valid credentials and rejects invalid password', async () => {
    await request(app).post('/api/v1/auth/register').send({
      email: 'charlie@example.com',
      password: 'Password123!',
      name: 'Charlie',
    });

    // Wrong password
    const failRes = await request(app).post('/api/v1/auth/login').send({
      email: 'charlie@example.com',
      password: 'WrongPassword!',
    });
    expect(failRes.status).toBe(401);

    // Correct password
    const successRes = await request(app).post('/api/v1/auth/login').send({
      email: 'charlie@example.com',
      password: 'Password123!',
    });
    expect(successRes.status).toBe(200);
    expect(successRes.body.data.accessToken).toBeDefined();
  });

  it('rotates refresh token and revokes family on reuse attempt (ADR-006)', async () => {
    const regRes = await request(app).post('/api/v1/auth/register').send({
      email: 'dana@example.com',
      password: 'Password123!',
      name: 'Dana',
    });

    const initialRefreshToken = regRes.body.data.refreshToken;

    // First rotation
    const refreshRes = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: initialRefreshToken });

    expect(refreshRes.status).toBe(200);
    const newRefreshToken = refreshRes.body.data.refreshToken;
    expect(newRefreshToken).not.toBe(initialRefreshToken);

    // Replay attack: try using initialRefreshToken again!
    const replayRes = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: initialRefreshToken });

    expect(replayRes.status).toBe(401);

    // The family should now be revoked, so newRefreshToken also fails
    const compromisedRes = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: newRefreshToken });

    expect(compromisedRes.status).toBe(401);
  });

  it('returns current user and workspace memberships on /auth/me', async () => {
    const regRes = await request(app).post('/api/v1/auth/register').send({
      email: 'eve@example.com',
      password: 'Password123!',
      name: 'Eve',
    });

    const token = regRes.body.data.accessToken;

    const meRes = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(meRes.status).toBe(200);
    expect(meRes.body.data.user.email).toBe('eve@example.com');
    expect(meRes.body.data.workspaces).toHaveLength(1);
    expect(meRes.body.data.workspaces[0].role).toBe('owner');
  });
});
