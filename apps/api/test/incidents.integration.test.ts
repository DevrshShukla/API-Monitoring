import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { Application } from 'express';
import { setupTestEnvironment, teardownTestEnvironment, clearTestDatabase } from './setup.js';
import { Incident } from '../src/db/Incident.js';
import { INCIDENT_STATUS, INCIDENT_SEVERITY } from '@api-monitoring/shared';

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

async function setupIncidentFixture() {
  const regRes = await request(app).post('/api/v1/auth/register').send({
    email: 'oncall@example.com',
    password: 'Password123!',
    name: 'Oncall Engineer',
    workspaceName: 'Ops Workspace',
  });

  const token = regRes.body.data.accessToken as string;
  const workspaceId = regRes.body.data.workspace.id as string;

  const monRes = await request(app)
    .post('/api/v1/monitors')
    .set('Authorization', `Bearer ${token}`)
    .set('X-Workspace-Id', workspaceId)
    .send({
      name: 'Orders Service',
      url: 'https://1.1.1.1/orders',
    });

  const monitorId = monRes.body.data.id as string;

  const incident = await Incident.create({
    workspaceId: new mongoose.Types.ObjectId(workspaceId),
    monitorId: new mongoose.Types.ObjectId(monitorId),
    fingerprint: `${workspaceId}:${monitorId}:rule1:consecutive_failures`,
    title: 'Orders Service Outage',
    description: '3 consecutive failures observed',
    conditionType: 'consecutive_failures',
    severity: INCIDENT_SEVERITY.HIGH,
    status: INCIDENT_STATUS.OPEN,
  });

  return { token, workspaceId, monitorId, incidentId: incident._id.toString() };
}

describe('Incident Lifecycle Integration (TC-INC-001..004, AC-INC-002)', () => {
  it('transitions incident through Open -> Acknowledged -> Investigating -> Resolved with timeline', async () => {
    const { token, workspaceId, incidentId } = await setupIncidentFixture();

    // 1. Acknowledge
    const ackRes = await request(app)
      .post(`/api/v1/incidents/${incidentId}/acknowledge`)
      .set('Authorization', `Bearer ${token}`)
      .set('X-Workspace-Id', workspaceId);

    expect(ackRes.status).toBe(200);
    expect(ackRes.body.data.status).toBe('acknowledged');
    expect(ackRes.body.data.acknowledgedAt).toBeDefined();

    // 2. Investigate
    const invRes = await request(app)
      .post(`/api/v1/incidents/${incidentId}/investigate`)
      .set('Authorization', `Bearer ${token}`)
      .set('X-Workspace-Id', workspaceId);

    expect(invRes.status).toBe(200);
    expect(invRes.body.data.status).toBe('investigating');
    expect(invRes.body.data.investigatingAt).toBeDefined();

    // 3. Add note
    const noteRes = await request(app)
      .post(`/api/v1/incidents/${incidentId}/notes`)
      .set('Authorization', `Bearer ${token}`)
      .set('X-Workspace-Id', workspaceId)
      .send({ note: 'Investigating upstream database connection pool' });

    expect(noteRes.status).toBe(201);
    expect(noteRes.body.data.message).toBe('Investigating upstream database connection pool');

    // 4. Resolve with note shorter than 5 chars should fail
    const badResolveRes = await request(app)
      .post(`/api/v1/incidents/${incidentId}/resolve`)
      .set('Authorization', `Bearer ${token}`)
      .set('X-Workspace-Id', workspaceId)
      .send({ resolutionNote: 'fix' }); // 3 chars < 5 chars

    expect(badResolveRes.status).toBe(400);

    // 5. Resolve with valid note
    const resolveRes = await request(app)
      .post(`/api/v1/incidents/${incidentId}/resolve`)
      .set('Authorization', `Bearer ${token}`)
      .set('X-Workspace-Id', workspaceId)
      .send({ resolutionNote: 'Restarted database pool and verified health check returns 200 OK' });

    expect(resolveRes.status).toBe(200);
    expect(resolveRes.body.data.status).toBe('resolved');
    expect(resolveRes.body.data.resolutionNote).toBe(
      'Restarted database pool and verified health check returns 200 OK'
    );

    // 6. Inspect detail timeline
    const detailRes = await request(app)
      .get(`/api/v1/incidents/${incidentId}`)
      .set('Authorization', `Bearer ${token}`)
      .set('X-Workspace-Id', workspaceId);

    expect(detailRes.status).toBe(200);
    expect(detailRes.body.data.timeline.length).toBeGreaterThanOrEqual(4);
  });
});
