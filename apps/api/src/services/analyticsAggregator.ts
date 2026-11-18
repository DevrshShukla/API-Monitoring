import {
  LatencyTimeSeriesPoint,
  StatusCodeDistributionItem,
  AnalyticsBucket,
  CHECK_OUTCOME,
} from '@api-monitoring/shared';

export interface RawCheckSample {
  completedAt: Date;
  outcome: string;
  statusCode: number | null;
  latencyMs: number;
}

/**
 * Computes nearest-rank percentile for an array of numbers.
 * Ordinal rank k = Math.ceil((percentile / 100) * N)
 * Index = k - 1
 */
export function calculateNearestRankPercentile(sortedValues: number[], percentile: number): number | null {
  if (!sortedValues || sortedValues.length === 0) return null;
  const rank = Math.ceil((percentile / 100) * sortedValues.length);
  const index = Math.max(0, Math.min(rank - 1, sortedValues.length - 1));
  return sortedValues[index];
}

export function computePercentiles(values: number[]): {
  p50: number | null;
  p95: number | null;
  p99: number | null;
  min: number | null;
  max: number | null;
  avg: number | null;
} {
  if (values.length === 0) {
    return { p50: null, p95: null, p99: null, min: null, max: null, avg: null };
  }

  const sorted = [...values].sort((a, b) => a - b);
  const sum = sorted.reduce((acc, v) => acc + v, 0);

  return {
    p50: calculateNearestRankPercentile(sorted, 50),
    p95: calculateNearestRankPercentile(sorted, 95),
    p99: calculateNearestRankPercentile(sorted, 99),
    min: sorted[0],
    max: sorted[sorted.length - 1],
    avg: Math.round((sum / sorted.length) * 10) / 10,
  };
}

export function getBucketTimestamp(date: Date, bucket: AnalyticsBucket): string {
  const d = new Date(date);
  switch (bucket) {
    case '5m': {
      const minutes = Math.floor(d.getUTCMinutes() / 5) * 5;
      d.setUTCMinutes(minutes, 0, 0);
      return d.toISOString();
    }
    case '15m': {
      const minutes = Math.floor(d.getUTCMinutes() / 15) * 15;
      d.setUTCMinutes(minutes, 0, 0);
      return d.toISOString();
    }
    case '1h': {
      d.setUTCMinutes(0, 0, 0);
      return d.toISOString();
    }
    case '1d': {
      d.setUTCHours(0, 0, 0, 0);
      return d.toISOString();
    }
    default:
      return d.toISOString();
  }
}

export function aggregateTimeSeries(
  checks: RawCheckSample[],
  bucket: AnalyticsBucket
): LatencyTimeSeriesPoint[] {
  const groups = new Map<string, number[]>();

  for (const check of checks) {
    if (check.outcome === CHECK_OUTCOME.SUCCESS) {
      const bucketKey = getBucketTimestamp(check.completedAt, bucket);
      if (!groups.has(bucketKey)) {
        groups.set(bucketKey, []);
      }
      groups.get(bucketKey)!.push(check.latencyMs);
    }
  }

  const sortedKeys = Array.from(groups.keys()).sort();
  return sortedKeys.map((key) => {
    const latencies = groups.get(key)!;
    const stats = computePercentiles(latencies);
    return {
      timestamp: key,
      sampleCount: latencies.length,
      p50: stats.p50,
      p95: stats.p95,
      p99: stats.p99,
      avg: stats.avg,
      min: stats.min,
      max: stats.max,
    };
  });
}

export function calculateStatusCodeDistribution(checks: RawCheckSample[]): StatusCodeDistributionItem[] {
  const counts = new Map<number, number>();
  let totalWithStatus = 0;

  for (const check of checks) {
    if (check.statusCode !== null) {
      counts.set(check.statusCode, (counts.get(check.statusCode) || 0) + 1);
      totalWithStatus++;
    }
  }

  const items: StatusCodeDistributionItem[] = [];
  for (const [statusCode, count] of counts.entries()) {
    items.push({
      statusCode,
      count,
      percentage: totalWithStatus > 0 ? Math.round((count / totalWithStatus) * 1000) / 10 : 0,
    });
  }

  return items.sort((a, b) => a.statusCode - b.statusCode);
}
