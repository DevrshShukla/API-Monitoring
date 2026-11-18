import { describe, it, expect } from 'vitest';
import {
  calculateNearestRankPercentile,
  computePercentiles,
  calculateStatusCodeDistribution,
  aggregateTimeSeries,
} from '../src/services/analyticsAggregator.js';
import { CHECK_OUTCOME } from '@api-monitoring/shared';

describe('Analytics Nearest-Rank Percentiles & Aggregation (TC-ANA-001)', () => {
  it('returns null for empty dataset', () => {
    expect(calculateNearestRankPercentile([], 50)).toBeNull();
    const stats = computePercentiles([]);
    expect(stats.p50).toBeNull();
    expect(stats.p95).toBeNull();
    expect(stats.p99).toBeNull();
    expect(stats.min).toBeNull();
    expect(stats.max).toBeNull();
    expect(stats.avg).toBeNull();
  });

  it('correctly calculates nearest-rank percentiles on ordered sample array', () => {
    // 10 samples: 10, 20, 30, 40, 50, 60, 70, 80, 90, 100
    // p50: rank = ceil(0.50 * 10) = 5 -> index 4 -> 50
    // p95: rank = ceil(0.95 * 10) = 10 -> index 9 -> 100
    // p99: rank = ceil(0.99 * 10) = 10 -> index 9 -> 100
    const samples = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
    const stats = computePercentiles(samples);

    expect(stats.min).toBe(10);
    expect(stats.max).toBe(100);
    expect(stats.avg).toBe(55);
    expect(stats.p50).toBe(50);
    expect(stats.p95).toBe(100);
    expect(stats.p99).toBe(100);
  });

  it('handles single sample correctly', () => {
    const stats = computePercentiles([42]);
    expect(stats.min).toBe(42);
    expect(stats.max).toBe(42);
    expect(stats.avg).toBe(42);
    expect(stats.p50).toBe(42);
    expect(stats.p95).toBe(42);
    expect(stats.p99).toBe(42);
  });

  it('calculates status code distributions with exact percentages', () => {
    const checks = [
      { completedAt: new Date(), outcome: CHECK_OUTCOME.SUCCESS, statusCode: 200, latencyMs: 100 },
      { completedAt: new Date(), outcome: CHECK_OUTCOME.SUCCESS, statusCode: 200, latencyMs: 120 },
      { completedAt: new Date(), outcome: CHECK_OUTCOME.SUCCESS, statusCode: 204, latencyMs: 90 },
      { completedAt: new Date(), outcome: CHECK_OUTCOME.HTTP_ERROR, statusCode: 500, latencyMs: 300 },
    ];

    const distribution = calculateStatusCodeDistribution(checks);
    expect(distribution).toHaveLength(3);

    const s200 = distribution.find((d) => d.statusCode === 200);
    expect(s200?.count).toBe(2);
    expect(s200?.percentage).toBe(50.0);

    const s204 = distribution.find((d) => d.statusCode === 204);
    expect(s204?.count).toBe(1);
    expect(s204?.percentage).toBe(25.0);

    const s500 = distribution.find((d) => d.statusCode === 500);
    expect(s500?.count).toBe(1);
    expect(s500?.percentage).toBe(25.0);
  });
});
