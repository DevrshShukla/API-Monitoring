import { describe, it, expect } from 'vitest';
import { computeMonitorStatus } from '../src/services/statusCalculator.js';
import { MONITOR_STATUS, CHECK_OUTCOME } from '@api-monitoring/shared';

describe('Status Calculator Matrix (Section 4 Testing Documentation)', () => {
  it('returns PAUSED when monitor is not active regardless of outcome', () => {
    const status = computeMonitorStatus({
      active: false,
      latestOutcome: CHECK_OUTCOME.SUCCESS,
      latestLatencyMs: 150,
      consecutiveFailures: 0,
      recentSuccessRatio: 1.0,
      latencyThresholdMs: 2000,
    });
    expect(status).toBe(MONITOR_STATUS.PAUSED);
  });

  it('returns OPERATIONAL when latest check is success and latency is below threshold', () => {
    const status = computeMonitorStatus({
      active: true,
      latestOutcome: CHECK_OUTCOME.SUCCESS,
      latestLatencyMs: 250,
      consecutiveFailures: 0,
      recentSuccessRatio: 1.0,
      latencyThresholdMs: 2000,
    });
    expect(status).toBe(MONITOR_STATUS.OPERATIONAL);
  });

  it('returns DEGRADED when check succeeds but latency exceeds threshold', () => {
    const status = computeMonitorStatus({
      active: true,
      latestOutcome: CHECK_OUTCOME.SUCCESS,
      latestLatencyMs: 2500,
      consecutiveFailures: 0,
      recentSuccessRatio: 1.0,
      latencyThresholdMs: 2000,
    });
    expect(status).toBe(MONITOR_STATUS.DEGRADED);
  });

  it('returns DEGRADED when check succeeds but rolling success ratio is below 95%', () => {
    const status = computeMonitorStatus({
      active: true,
      latestOutcome: CHECK_OUTCOME.SUCCESS,
      latestLatencyMs: 300,
      consecutiveFailures: 0,
      recentSuccessRatio: 0.90, // below 0.95
      latencyThresholdMs: 2000,
    });
    expect(status).toBe(MONITOR_STATUS.DEGRADED);
  });

  it('returns DOWN when latest check is failure and consecutive failures reach threshold (3)', () => {
    const status = computeMonitorStatus({
      active: true,
      latestOutcome: CHECK_OUTCOME.HTTP_ERROR,
      latestLatencyMs: 500,
      consecutiveFailures: 3,
      recentSuccessRatio: 0.70,
      latencyThresholdMs: 2000,
      failuresToDownThreshold: 3,
    });
    expect(status).toBe(MONITOR_STATUS.DOWN);
  });

  it('returns DEGRADED as early failure warning when failures are below threshold (1 of 3)', () => {
    const status = computeMonitorStatus({
      active: true,
      latestOutcome: CHECK_OUTCOME.HTTP_ERROR,
      latestLatencyMs: 500,
      consecutiveFailures: 1,
      recentSuccessRatio: 0.95,
      latencyThresholdMs: 2000,
      failuresToDownThreshold: 3,
      previousStatus: MONITOR_STATUS.OPERATIONAL,
    });
    expect(status).toBe(MONITOR_STATUS.DEGRADED);
  });

  it('remains DOWN if previously DOWN and check is still failing', () => {
    const status = computeMonitorStatus({
      active: true,
      latestOutcome: CHECK_OUTCOME.TIMEOUT,
      latestLatencyMs: 10000,
      consecutiveFailures: 2,
      recentSuccessRatio: 0.5,
      latencyThresholdMs: 2000,
      previousStatus: MONITOR_STATUS.DOWN,
    });
    expect(status).toBe(MONITOR_STATUS.DOWN);
  });

  it('recovers to OPERATIONAL when recovery check succeeds with normal latency and ratio', () => {
    const status = computeMonitorStatus({
      active: true,
      latestOutcome: CHECK_OUTCOME.SUCCESS,
      latestLatencyMs: 180,
      consecutiveFailures: 0,
      recentSuccessRatio: 1.0,
      latencyThresholdMs: 2000,
      previousStatus: MONITOR_STATUS.DOWN,
    });
    expect(status).toBe(MONITOR_STATUS.OPERATIONAL);
  });
});
