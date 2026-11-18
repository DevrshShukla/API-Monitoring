import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart3,
  Calendar,
  Filter,
  TrendingDown,
  TrendingUp,
  Clock,
  Activity,
  CheckCircle2,
  AlertTriangle,
  ArrowUpDown,
} from 'lucide-react';
import { api } from '../lib/api';
import { MetricCard } from '../components/MetricCard';
import { LatencyChart } from '../components/charts/LatencyChart';
import { StatusDistributionChart } from '../components/charts/StatusDistributionChart';
import { Skeleton } from '../components/Skeleton';
import { ErrorState } from '../components/ErrorState';

export function AnalyticsPage() {
  const [selectedMonitorId, setSelectedMonitorId] = useState<string>('all');
  const [timeRange, setTimeRange] = useState<'24h' | '7d' | '30d'>('24h');

  // Fetch monitors for dropdown
  const { data: monitorsData } = useQuery({
    queryKey: ['monitors-list-simple'],
    queryFn: async () => {
      const res = await api.get('/monitors?limit=100');
      return res.data.data;
    },
  });

  const monitors = monitorsData?.monitors || [];

  // Calculate dates based on timeRange
  const getDateRange = () => {
    const to = new Date();
    const from = new Date();
    if (timeRange === '24h') from.setHours(to.getHours() - 24);
    else if (timeRange === '7d') from.setDate(to.getDate() - 7);
    else if (timeRange === '30d') from.setDate(to.getDate() - 30);
    return { from: from.toISOString(), to: to.toISOString() };
  };

  const { from, to } = getDateRange();

  // Fetch Analytics Overview or Monitor Analytics
  const {
    data: analyticsData,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['analytics', selectedMonitorId, timeRange],
    queryFn: async () => {
      if (selectedMonitorId === 'all') {
        const res = await api.get('/analytics/overview', {
          params: { from, to },
        });
        return res.data.data;
      } else {
        const res = await api.get(`/analytics/monitors/${selectedMonitorId}`, {
          params: { from, to, bucket: timeRange === '24h' ? '1h' : '1d' },
        });
        return res.data.data;
      }
    },
  });

  // Fetch status distribution
  const { data: distributionData } = useQuery({
    queryKey: ['status-distribution', selectedMonitorId, timeRange],
    queryFn: async () => {
      const params: any = { from, to };
      if (selectedMonitorId !== 'all') {
        params.monitorId = selectedMonitorId;
      }
      const res = await api.get('/analytics/status-distribution', { params });
      return res.data.data;
    },
  });

  if (isError) {
    return <ErrorState message="Failed to load analytics data" onRetry={() => refetch()} />;
  }

  const percentiles = analyticsData?.percentiles || analyticsData?.aggregatedPercentiles || {
    p50: 0,
    p90: 0,
    p95: 0,
    p99: 0,
    min: 0,
    max: 0,
    avg: 0,
  };

  const timeseries = analyticsData?.timeseries || analyticsData?.buckets || [];
  const uptime = analyticsData?.uptimePercentage ?? analyticsData?.overallUptime ?? 100;
  const totalChecks = analyticsData?.totalChecks ?? 0;

  return (
    <div className="space-y-6">
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Performance & Analytics
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Real-time latency percentiles, error rates, and system availability.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Monitor selector */}
          <div className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-1.5 shadow-sm">
            <Filter className="w-4 h-4 text-slate-400" />
            <select
              value={selectedMonitorId}
              onChange={(e) => setSelectedMonitorId(e.target.value)}
              className="bg-transparent text-sm font-medium text-slate-700 dark:text-slate-200 outline-none cursor-pointer"
            >
              <option value="all">All Monitors</option>
              {monitors.map((m: any) => (
                <option key={m._id} value={m._id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>

          {/* Time range selector */}
          <div className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-1 shadow-sm">
            {(['24h', '7d', '30d'] as const).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                  timeRange === range
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {range.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Primary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)
        ) : (
          <>
            <MetricCard
              label="Availability"
              value={`${uptime.toFixed(2)}%`}
              change={`${uptime >= 99.9 ? 'Operational' : 'Degraded'}`}
              changeType={uptime >= 99 ? 'positive' : 'negative'}
              icon={CheckCircle2}
              description="Uptime across evaluation window"
            />
            <MetricCard
              label="Median Latency (P50)"
              value={`${Math.round(percentiles.p50 || 0)}ms`}
              icon={Clock}
              description="50th percentile response time"
            />
            <MetricCard
              label="Tail Latency (P95)"
              value={`${Math.round(percentiles.p95 || 0)}ms`}
              changeType={percentiles.p95 > 1000 ? 'negative' : 'neutral'}
              icon={Activity}
              description="95th percentile response time"
            />
            <MetricCard
              label="Max Latency (P99)"
              value={`${Math.round(percentiles.p99 || 0)}ms`}
              icon={AlertTriangle}
              description="99th percentile worst-case latency"
            />
          </>
        )}
      </div>

      {/* Detailed Percentile Metrics Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-4">
          Nearest-Rank Percentile Distribution
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4 text-center">
          <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
            <span className="text-xs text-slate-500 dark:text-slate-400 block mb-1">Min</span>
            <span className="text-lg font-bold font-mono text-slate-900 dark:text-white">
              {Math.round(percentiles.min || 0)}ms
            </span>
          </div>
          <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
            <span className="text-xs text-slate-500 dark:text-slate-400 block mb-1">Avg</span>
            <span className="text-lg font-bold font-mono text-slate-900 dark:text-white">
              {Math.round(percentiles.avg || 0)}ms
            </span>
          </div>
          <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
            <span className="text-xs text-slate-500 dark:text-slate-400 block mb-1">P50</span>
            <span className="text-lg font-bold font-mono text-slate-900 dark:text-white">
              {Math.round(percentiles.p50 || 0)}ms
            </span>
          </div>
          <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
            <span className="text-xs text-slate-500 dark:text-slate-400 block mb-1">P90</span>
            <span className="text-lg font-bold font-mono text-slate-900 dark:text-white">
              {Math.round(percentiles.p90 || 0)}ms
            </span>
          </div>
          <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
            <span className="text-xs text-slate-500 dark:text-slate-400 block mb-1">P95</span>
            <span className="text-lg font-bold font-mono text-slate-900 dark:text-white">
              {Math.round(percentiles.p95 || 0)}ms
            </span>
          </div>
          <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
            <span className="text-xs text-slate-500 dark:text-slate-400 block mb-1">P99</span>
            <span className="text-lg font-bold font-mono text-slate-900 dark:text-white">
              {Math.round(percentiles.p99 || 0)}ms
            </span>
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Latency History */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                Response Time History
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                P50, P95, and P99 trend curves over the selected interval
              </p>
            </div>
            <span className="text-xs font-mono px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded text-slate-600 dark:text-slate-300">
              {totalChecks} checks recorded
            </span>
          </div>
          {isLoading ? (
            <Skeleton className="h-64 rounded-lg" />
          ) : (
            <LatencyChart data={timeseries} height={280} />
          )}
        </div>

        {/* Status Distribution */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white mb-1">
            Status Breakdown
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
            Evaluation outcome proportions
          </p>
          <StatusDistributionChart
            successCount={distributionData?.success ?? distributionData?.operational ?? 0}
            degradedCount={distributionData?.degraded ?? 0}
            failedCount={distributionData?.failed ?? distributionData?.down ?? 0}
            height={260}
          />
        </div>
      </div>

      {/* Monitors Comparison Table if All Selected */}
      {selectedMonitorId === 'all' && monitors.length > 0 && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
          <div className="p-5 border-b border-slate-200 dark:border-slate-800">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              Monitor Comparison
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Key performance indicators broken down by endpoint
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 dark:bg-slate-800/30 text-xs font-medium text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                  <th className="py-3 px-4">Endpoint</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Interval</th>
                  <th className="py-3 px-4">Timeout</th>
                  <th className="py-3 px-4">Last Check</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                {monitors.map((m: any) => (
                  <tr
                    key={m._id}
                    className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-900 dark:text-white">{m.name}</div>
                      <div className="text-xs font-mono text-slate-400 truncate max-w-xs">{m.url}</div>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium uppercase ${
                          m.status === 'operational'
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
                            : m.status === 'degraded'
                            ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400'
                            : m.status === 'down'
                            ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400'
                            : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                        }`}
                      >
                        {m.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-300 font-mono text-xs">
                      {m.intervalSeconds}s
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-300 font-mono text-xs">
                      {m.timeoutMs}ms
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-500">
                      {m.lastCheckAt ? new Date(m.lastCheckAt).toLocaleTimeString() : 'Never'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
