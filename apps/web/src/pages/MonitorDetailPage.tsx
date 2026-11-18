import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Pause,
  Play,
  Clock,
  Gauge,
  Activity,
  History,
  BarChart3,
  Settings,
  ShieldCheck,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api.js';
import { useToast } from '../context/ToastContext.js';
import { StatusBadge } from '../components/StatusBadge.js';
import { MetricCard } from '../components/MetricCard.js';
import { LatencyChart } from '../components/charts/LatencyChart.js';
import { StatusDistributionChart } from '../components/charts/StatusDistributionChart.js';
import { ErrorState } from '../components/ErrorState.js';
import {
  MonitorDto,
  HealthCheckDto,
  EndpointAnalyticsDto,
  CHECK_OUTCOME,
} from '@api-monitoring/shared';

export const MonitorDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [activeTab, setActiveTab] = useState<'history' | 'analytics' | 'config'>('history');
  const { success, error } = useToast();
  const queryClient = useQueryClient();

  // 1. Fetch Monitor details
  const {
    data: monitorData,
    isLoading: monitorLoading,
    error: monitorError,
    refetch: refetchMonitor,
  } = useQuery<{ data: MonitorDto }>({
    queryKey: ['monitor', id],
    queryFn: async () => {
      const res = await apiClient.get(`/monitors/${id}`);
      return res.data;
    },
    enabled: !!id,
  });

  // 2. Fetch Check History
  const { data: checksData, isLoading: checksLoading } = useQuery<{ data: HealthCheckDto[] }>({
    queryKey: ['monitor-checks', id],
    queryFn: async () => {
      const res = await apiClient.get(`/monitors/${id}/checks?limit=50`);
      return res.data;
    },
    enabled: !!id && activeTab === 'history',
    refetchInterval: 10000,
  });

  // 3. Fetch Analytics
  const { data: analyticsData } = useQuery<{ data: EndpointAnalyticsDto }>({
    queryKey: ['monitor-analytics', id],
    queryFn: async () => {
      const res = await apiClient.get(`/monitors/${id}/analytics?bucket=15m`);
      return res.data;
    },
    enabled: !!id && activeTab === 'analytics',
  });

  // Toggle pause/resume
  const togglePauseMutation = useMutation({
    mutationFn: async () => {
      if (!monitor) return;
      if (monitor.active) {
        await apiClient.post(`/monitors/${id}/pause`);
      } else {
        await apiClient.post(`/monitors/${id}/resume`);
      }
    },
    onSuccess: () => {
      success('Status Updated', 'Monitor scheduling updated.');
      queryClient.invalidateQueries({ queryKey: ['monitor', id] });
      queryClient.invalidateQueries({ queryKey: ['monitors'] });
    },
    onError: (err: any) => {
      error('Action failed', err.response?.data?.error?.message || 'Could not update status');
    },
  });

  if (monitorError) {
    return <ErrorState onRetry={() => refetchMonitor()} />;
  }

  if (monitorLoading || !monitorData) {
    return <div className="p-12 text-center text-xs text-ink-secondary">Loading monitor...</div>;
  }

  const monitor = monitorData.data;
  const checks = checksData?.data || [];
  const analytics = analyticsData?.data;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Back Link & Header */}
      <div>
        <Link
          to="/monitors"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-secondary hover:text-ink-primary mb-3"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Monitors
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs font-bold px-2 py-1 rounded bg-slate-100 text-ink-secondary">
              {monitor.method}
            </span>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl font-bold text-ink-primary">{monitor.name}</h1>
                <StatusBadge status={monitor.status} size="sm" />
              </div>
              <p className="text-xs font-mono text-ink-secondary mt-0.5">{monitor.url}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => togglePauseMutation.mutate()}
              disabled={togglePauseMutation.isPending}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border shadow-xs transition-colors ${
                monitor.active
                  ? 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100'
                  : 'border-green-200 bg-green-50 text-green-700 hover:bg-green-100'
              }`}
            >
              {monitor.active ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              {monitor.active ? 'Pause Checks' : 'Resume Checks'}
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3.5">
        <MetricCard
          label="Current Latency"
          value={monitor.lastLatencyMs}
          unit="ms"
          icon={Clock}
        />
        <MetricCard
          label="Degraded Threshold"
          value={monitor.latencyThresholdMs}
          unit="ms"
          icon={Activity}
        />
        <MetricCard
          label="24h Availability"
          value={monitor.uptime24h}
          unit="%"
          icon={Gauge}
          variant={monitor.uptime24h && monitor.uptime24h >= 99 ? 'success' : 'default'}
        />
        <MetricCard
          label="7d Availability"
          value={monitor.uptime7d}
          unit="%"
          icon={Gauge}
        />
        <MetricCard
          label="30d Availability"
          value={monitor.uptime30d}
          unit="%"
          icon={Gauge}
        />
        <MetricCard
          label="Check Interval"
          value={monitor.intervalSeconds}
          unit="sec"
          icon={Clock}
        />
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-boundary">
        {[
          { id: 'history', label: 'Check History', icon: History },
          { id: 'analytics', label: 'Performance Analytics', icon: BarChart3 },
          { id: 'config', label: 'Configuration & Security', icon: Settings },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 -mb-px transition-colors ${
              activeTab === tab.id
                ? 'border-brand-700 text-brand-700'
                : 'border-transparent text-ink-secondary hover:text-ink-primary'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab 1: Check History */}
      {activeTab === 'history' && (
        <div className="bg-surface rounded-xl border border-boundary shadow-xs overflow-hidden">
          <div className="px-6 py-3.5 border-b border-boundary bg-slate-50/50 flex items-center justify-between">
            <span className="text-xs font-bold text-ink-primary">
              Immutable Check Observations (Last 50)
            </span>
            <span className="text-[11px] text-ink-muted">Auto-refreshes every 10s</span>
          </div>

          {checksLoading ? (
            <div className="p-8 text-center text-xs text-ink-muted">Loading checks...</div>
          ) : checks.length === 0 ? (
            <div className="p-8 text-center text-xs text-ink-muted">
              Waiting for first background check execution...
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-ink-secondary font-semibold uppercase tracking-wider border-b border-boundary">
                  <tr>
                    <th className="px-6 py-3">Timestamp</th>
                    <th className="px-6 py-3">Outcome</th>
                    <th className="px-6 py-3">Status Code</th>
                    <th className="px-6 py-3">Latency</th>
                    <th className="px-6 py-3">Size</th>
                    <th className="px-6 py-3">Diagnosis</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {checks.map((c) => {
                    const isSuccess = c.outcome === CHECK_OUTCOME.SUCCESS;
                    return (
                      <tr key={c.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="px-6 py-3 text-ink-secondary">
                          {new Date(c.completedAt).toLocaleString()}
                        </td>
                        <td className="px-6 py-3">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                              isSuccess
                                ? 'bg-green-100 text-green-700'
                                : 'bg-red-100 text-red-700'
                            }`}
                          >
                            {isSuccess ? (
                              <CheckCircle2 className="w-3 h-3" />
                            ) : (
                              <XCircle className="w-3 h-3" />
                            )}
                            {c.outcome}
                          </span>
                        </td>
                        <td className="px-6 py-3">
                          {c.statusCode ? (
                            <span
                              className={`px-1.5 py-0.5 rounded text-[11px] font-semibold ${
                                c.statusCode >= 200 && c.statusCode < 300
                                  ? 'bg-green-50 text-green-700'
                                  : 'bg-red-50 text-red-700'
                              }`}
                            >
                              HTTP {c.statusCode}
                            </span>
                          ) : (
                            <span className="text-ink-muted">—</span>
                          )}
                        </td>
                        <td className="px-6 py-3 font-semibold text-ink-primary">
                          {c.latencyMs} ms
                        </td>
                        <td className="px-6 py-3 text-ink-muted">
                          {c.responseBytes ? `${c.responseBytes} B` : '0 B'}
                        </td>
                        <td className="px-6 py-3 font-sans text-xs text-ink-secondary truncate max-w-xs">
                          {c.errorMessageSafe || 'Healthy response received'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Analytics */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-surface p-5 rounded-xl border border-boundary shadow-xs">
              <h3 className="text-sm font-bold text-ink-primary mb-3">Response Time (P50 & P95)</h3>
              <LatencyChart data={analytics?.timeSeries || []} height={280} />
            </div>
            <div className="bg-surface p-5 rounded-xl border border-boundary shadow-xs">
              <h3 className="text-sm font-bold text-ink-primary mb-3">HTTP Status Distribution</h3>
              <StatusDistributionChart data={analytics?.statusDistribution || []} height={280} />
            </div>
          </div>

          {/* Anomaly Detection List */}
          <div className="bg-surface p-5 rounded-xl border border-boundary shadow-xs">
            <h3 className="text-sm font-bold text-ink-primary mb-3">Explainable Anomaly Log</h3>
            {!analytics?.anomalies || analytics.anomalies.length === 0 ? (
              <div className="p-6 text-center text-xs text-ink-muted">
                No latency or failure threshold breaches recorded for this window.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 text-xs">
                {analytics.anomalies.map((a, i) => (
                  <div key={i} className="py-2.5 flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-ink-primary">{a.message}</span>
                      <span className="text-ink-muted text-[11px] block mt-0.5">
                        {new Date(a.timestamp).toLocaleString()}
                      </span>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-100 text-amber-800">
                      {a.type}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 3: Configuration & Security */}
      {activeTab === 'config' && (
        <div className="bg-surface p-6 rounded-xl border border-boundary shadow-xs space-y-4">
          <h3 className="text-sm font-bold text-ink-primary">Endpoint Configuration</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="p-3 bg-slate-50 rounded-lg border border-boundary">
              <span className="text-ink-secondary block font-medium">Expected Status Codes</span>
              <span className="font-mono text-ink-primary font-semibold mt-1 block">
                {monitor.expectedStatusCodes.join(', ')}
              </span>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg border border-boundary">
              <span className="text-ink-secondary block font-medium">Request Timeout</span>
              <span className="font-mono text-ink-primary font-semibold mt-1 block">
                {monitor.timeoutMs} ms
              </span>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg border border-boundary">
              <span className="text-ink-secondary block font-medium">Encrypted Headers</span>
              <span className="text-ink-primary font-semibold mt-1 flex items-center gap-1">
                <ShieldCheck className="w-4 h-4 text-brand-700" />
                {monitor.headersConfigured
                  ? 'Configured (AES-256-GCM Encrypted at rest)'
                  : 'None'}
              </span>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg border border-boundary">
              <span className="text-ink-secondary block font-medium">Request Body</span>
              <span className="text-ink-primary font-semibold mt-1 block">
                {monitor.bodyConfigured
                  ? `Configured (${monitor.bodyContentType || 'application/json'})`
                  : 'None'}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
