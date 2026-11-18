import React from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  Gauge,
  AlertOctagon,
  ArrowUpRight,
  Plus,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.js';
import { MetricCard } from '../components/MetricCard.js';
import { StatusBadge } from '../components/StatusBadge.js';
import { LatencyChart } from '../components/charts/LatencyChart.js';
import { EmptyState } from '../components/EmptyState.js';
import { ErrorState } from '../components/ErrorState.js';
import {
  AnalyticsSummaryDto,
  IncidentDto,
  MonitorDto,
  LatencyTimeSeriesPoint,
} from '@api-monitoring/shared';

export const OverviewPage: React.FC = () => {
  const { activeWorkspace } = useAuth();

  // 1. Fetch Overview KPIs
  const {
    data: overviewData,
    isLoading: overviewLoading,
    error: overviewError,
    refetch: refetchOverview,
  } = useQuery<{ data: AnalyticsSummaryDto }>({
    queryKey: ['overview', activeWorkspace?.id],
    queryFn: async () => {
      const res = await apiClient.get('/analytics/overview');
      return res.data;
    },
    enabled: !!activeWorkspace,
  });

  // 2. Fetch Active Incidents
  const { data: incidentsData } = useQuery<{ data: IncidentDto[] }>({
    queryKey: ['incidents', 'overview', activeWorkspace?.id],
    queryFn: async () => {
      const res = await apiClient.get('/incidents?limit=5');
      return res.data;
    },
    enabled: !!activeWorkspace,
  });

  // 3. Fetch Monitors to display recent status
  const { data: monitorsData } = useQuery<{ data: MonitorDto[] }>({
    queryKey: ['monitors', 'overview', activeWorkspace?.id],
    queryFn: async () => {
      const res = await apiClient.get('/monitors?limit=6');
      return res.data;
    },
    enabled: !!activeWorkspace,
  });

  // 4. Fetch TimeSeries for trend chart (from first monitor or workspace)
  const firstMonitorId = monitorsData?.data?.[0]?.id;
  const { data: chartData } = useQuery<{ data: { timeSeries: LatencyTimeSeriesPoint[] } }>({
    queryKey: ['monitor-chart', firstMonitorId],
    queryFn: async () => {
      if (!firstMonitorId) return { data: { timeSeries: [] } };
      const res = await apiClient.get(`/monitors/${firstMonitorId}/analytics?bucket=1h`);
      return res.data;
    },
    enabled: !!firstMonitorId,
  });

  if (overviewError) {
    return <ErrorState onRetry={() => refetchOverview()} />;
  }

  const kpis = overviewData?.data;
  const incidents = incidentsData?.data || [];
  const monitors = monitorsData?.data || [];
  const timeSeries = chartData?.data?.timeSeries || [];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink-primary tracking-tight">Overview</h1>
          <p className="text-xs text-ink-secondary mt-0.5">
            Real-time operational health and response times across {activeWorkspace?.name || 'Workspace'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/monitors"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-brand-700 hover:bg-brand-800 rounded-lg shadow-xs transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Monitor
          </Link>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3.5">
        <MetricCard
          label="Total Endpoints"
          value={kpis?.totalMonitors ?? 0}
          icon={Activity}
          loading={overviewLoading}
        />
        <MetricCard
          label="Operational"
          value={kpis?.operational ?? 0}
          icon={CheckCircle2}
          variant="success"
          loading={overviewLoading}
        />
        <MetricCard
          label="Degraded"
          value={kpis?.degraded ?? 0}
          icon={AlertTriangle}
          variant="warning"
          loading={overviewLoading}
        />
        <MetricCard
          label="Down"
          value={kpis?.down ?? 0}
          icon={XCircle}
          variant="danger"
          loading={overviewLoading}
        />
        <MetricCard
          label="Average Latency"
          value={kpis?.averageLatencyMs ?? null}
          unit="ms"
          icon={Clock}
          loading={overviewLoading}
        />
        <MetricCard
          label="Availability"
          value={kpis?.overallUptimePercent ?? null}
          unit="%"
          icon={Gauge}
          loading={overviewLoading}
        />
      </div>

      {/* Main Charts & Incidents Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Latency Trend Area Chart */}
        <div className="lg:col-span-2 bg-surface p-5 rounded-xl border border-boundary shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-ink-primary">Latency Trends</h2>
              <p className="text-xs text-ink-secondary mt-0.5">
                {firstMonitorId
                  ? `Response time percentiles for ${monitors[0]?.name}`
                  : 'Register monitors to view latency percentiles'}
              </p>
            </div>
            {firstMonitorId && (
              <Link
                to={`/monitors/${firstMonitorId}`}
                className="text-xs font-semibold text-brand-700 hover:text-brand-800 inline-flex items-center gap-1"
              >
                Inspect endpoint <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            )}
          </div>
          <LatencyChart data={timeSeries} height={280} />
        </div>

        {/* Active Incidents Panel */}
        <div className="bg-surface p-5 rounded-xl border border-boundary shadow-xs flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-ink-primary flex items-center gap-1.5">
              <AlertOctagon className="w-4 h-4 text-state-danger" />
              Active Incidents
            </h2>
            <Link
              to="/incidents"
              className="text-xs font-semibold text-brand-700 hover:text-brand-800"
            >
              View all
            </Link>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {incidents.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-center text-xs text-ink-muted">
                <CheckCircle2 className="w-8 h-8 text-green-500 mb-2" />
                All monitored systems operational. No active incidents.
              </div>
            ) : (
              incidents.map((inc) => (
                <div key={inc.id} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-semibold text-xs text-ink-primary line-clamp-1">
                      {inc.title}
                    </span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                        inc.severity === 'critical'
                          ? 'bg-red-100 text-red-700'
                          : inc.severity === 'high'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-blue-100 text-blue-700'
                      }`}
                    >
                      {inc.severity}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-ink-secondary line-clamp-2">{inc.description}</p>
                  <div className="mt-2 flex items-center justify-between text-[11px] text-ink-muted">
                    <span>{new Date(inc.openedAt).toLocaleTimeString()}</span>
                    <Link
                      to={`/incidents`}
                      className="text-brand-700 font-medium hover:underline"
                    >
                      Investigate →
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Monitored Endpoints Snapshot */}
      <div className="bg-surface rounded-xl border border-boundary shadow-xs overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-boundary">
          <h2 className="text-sm font-bold text-ink-primary">Monitored Endpoints</h2>
          <Link
            to="/monitors"
            className="text-xs font-semibold text-brand-700 hover:text-brand-800 inline-flex items-center gap-1"
          >
            Manage all monitors <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {monitors.length === 0 ? (
          <div className="p-8">
            <EmptyState
              title="No monitors configured"
              description="Get started by registering your first HTTP endpoint to track availability and latency."
              action={{
                label: 'Create First Monitor',
                onClick: () => {},
                icon: Plus,
              }}
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-ink-secondary font-semibold uppercase tracking-wider border-b border-boundary">
                <tr>
                  <th className="px-6 py-3">Monitor</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3">Latency</th>
                  <th className="px-6 py-3">Last Checked</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-ink-primary">
                {monitors.map((mon) => (
                  <tr key={mon.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-6 py-3.5 font-medium">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[11px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-ink-secondary">
                          {mon.method}
                        </span>
                        <div>
                          <Link
                            to={`/monitors/${mon.id}`}
                            className="text-sm font-semibold text-ink-primary hover:text-brand-700"
                          >
                            {mon.name}
                          </Link>
                          <span className="text-[11px] text-ink-muted block font-mono truncate max-w-xs">
                            {mon.url}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-3.5">
                      <StatusBadge status={mon.status} size="sm" />
                    </td>
                    <td className="px-6 py-3.5 font-mono text-ink-secondary">
                      {mon.lastLatencyMs !== null ? `${mon.lastLatencyMs} ms` : '—'}
                    </td>
                    <td className="px-6 py-3.5 text-ink-secondary">
                      {mon.lastCheckedAt ? new Date(mon.lastCheckedAt).toLocaleTimeString() : 'Never'}
                    </td>
                    <td className="px-6 py-3.5 text-right">
                      <Link
                        to={`/monitors/${mon.id}`}
                        className="text-xs font-semibold text-brand-700 hover:text-brand-800"
                      >
                        Details
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
