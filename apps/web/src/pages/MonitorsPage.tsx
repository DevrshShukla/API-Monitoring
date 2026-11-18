import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Plus,
  Search,
  Pause,
  Play,
  Trash2,
  ExternalLink,
  ChevronRight,
  X,
  Sliders,
  ShieldAlert,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.js';
import { useToast } from '../context/ToastContext.js';
import { StatusBadge } from '../components/StatusBadge.js';
import { EmptyState } from '../components/EmptyState.js';
import { ErrorState } from '../components/ErrorState.js';
import { ConfirmDialog } from '../components/ConfirmDialog.js';
import {
  MonitorDto,
  HTTP_METHODS,
  MONITOR_STATUS,
  CreateMonitorInput,
} from '@api-monitoring/shared';

export const MonitorsPage: React.FC = () => {
  const { activeWorkspace } = useAuth();
  const { success, error } = useToast();
  const queryClient = useQueryClient();

  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<MonitorDto | null>(null);

  // Form State for Add Monitor
  const [formName, setFormName] = useState('');
  const [formUrl, setFormUrl] = useState('');
  const [formMethod, setFormMethod] = useState<'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'>('GET');
  const [formInterval, setFormInterval] = useState(60);
  const [formTimeout, setFormTimeout] = useState(10000);
  const [formCodes, setFormCodes] = useState('200, 204');
  const [formThreshold, setFormThreshold] = useState(2000);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [formHeaders, setFormHeaders] = useState<Array<{ key: string; value: string; sensitive: boolean }>>([]);
  const [formBody, setFormBody] = useState('');
  const [formBodyType, setFormBodyType] = useState('application/json');

  // Query monitors
  const { data, isLoading, isError, refetch } = useQuery<{ data: MonitorDto[] }>({
    queryKey: ['monitors', activeWorkspace?.id, statusFilter, searchTerm],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (searchTerm) params.append('search', searchTerm);
      const res = await apiClient.get(`/monitors?${params.toString()}`);
      return res.data;
    },
    enabled: !!activeWorkspace,
  });

  const monitors = data?.data || [];

  // Mutations
  const createMutation = useMutation({
    mutationFn: async (input: CreateMonitorInput) => {
      const res = await apiClient.post('/monitors', input);
      return res.data;
    },
    onSuccess: () => {
      success('Monitor Created', 'Health checks will begin running in background.');
      setIsAddModalOpen(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ['monitors'] });
      queryClient.invalidateQueries({ queryKey: ['overview'] });
    },
    onError: (err: any) => {
      error('Creation Failed', err.response?.data?.error?.message || 'Could not create monitor');
    },
  });

  const pauseMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.post(`/monitors/${id}/pause`);
    },
    onSuccess: () => {
      success('Monitor Paused', 'Scheduled health checks paused.');
      queryClient.invalidateQueries({ queryKey: ['monitors'] });
    },
  });

  const resumeMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.post(`/monitors/${id}/resume`);
    },
    onSuccess: () => {
      success('Monitor Resumed', 'Health checks enqueued.');
      queryClient.invalidateQueries({ queryKey: ['monitors'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/monitors/${id}`);
    },
    onSuccess: () => {
      success('Monitor Deleted', 'Monitor and scheduled runs deactivated.');
      setDeleteTarget(null);
      queryClient.invalidateQueries({ queryKey: ['monitors'] });
      queryClient.invalidateQueries({ queryKey: ['overview'] });
    },
  });

  const resetForm = () => {
    setFormName('');
    setFormUrl('');
    setFormMethod('GET');
    setFormInterval(60);
    setFormTimeout(10000);
    setFormCodes('200, 204');
    setFormThreshold(2000);
    setFormHeaders([]);
    setFormBody('');
    setShowAdvanced(false);
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const expectedStatusCodes = formCodes
      .split(',')
      .map((c) => parseInt(c.trim(), 10))
      .filter((c) => !isNaN(c) && c >= 100 && c <= 599);

    const validHeaders = formHeaders.filter((h) => h.key.trim().length > 0);

    createMutation.mutate({
      name: formName.trim(),
      url: formUrl.trim(),
      method: formMethod,
      intervalSeconds: Number(formInterval),
      timeoutMs: Number(formTimeout),
      expectedStatusCodes: expectedStatusCodes.length > 0 ? expectedStatusCodes : [200, 204],
      latencyThresholdMs: Number(formThreshold),
      headers: validHeaders,
      body: formBody || undefined,
      bodyContentType: formBodyType,
    });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink-primary tracking-tight">Monitors</h1>
          <p className="text-xs text-ink-secondary mt-0.5">
            Configure uptime targets, interval frequencies, and safe HTTP validation
          </p>
        </div>
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-brand-700 hover:bg-brand-800 rounded-lg shadow-xs transition-colors focus:ring-2 focus:ring-brand-400 focus:outline-hidden"
        >
          <Plus className="w-4 h-4" />
          Add Endpoint
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-surface p-3 rounded-xl border border-boundary shadow-xs">
        {/* Status Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {[
            { id: 'all', label: 'All' },
            { id: MONITOR_STATUS.OPERATIONAL, label: 'Operational' },
            { id: MONITOR_STATUS.DEGRADED, label: 'Degraded' },
            { id: MONITOR_STATUS.DOWN, label: 'Down' },
            { id: MONITOR_STATUS.PAUSED, label: 'Paused' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors capitalize ${
                statusFilter === tab.id
                  ? 'bg-brand-700 text-white shadow-xs'
                  : 'text-ink-secondary hover:text-ink-primary hover:bg-slate-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative min-w-[240px]">
          <Search className="w-4 h-4 text-ink-muted absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by name or URL..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-boundary rounded-lg text-ink-primary placeholder:text-ink-muted focus:bg-white focus:ring-2 focus:ring-brand-400 focus:outline-hidden"
          />
        </div>
      </div>

      {/* Monitors Table */}
      {isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : isLoading ? (
        <div className="p-12 text-center text-xs text-ink-secondary">Loading monitors...</div>
      ) : monitors.length === 0 ? (
        <EmptyState
          title="No monitors match your criteria"
          description="Try clearing your filters or create a new monitor endpoint."
          action={{
            label: 'Add First Monitor',
            onClick: () => setIsAddModalOpen(true),
            icon: Plus,
          }}
        />
      ) : (
        <div className="bg-surface rounded-xl border border-boundary shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-ink-secondary font-semibold uppercase tracking-wider border-b border-boundary">
                <tr>
                  <th className="px-5 py-3.5">Endpoint</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5">Latency</th>
                  <th className="px-5 py-3.5">Interval</th>
                  <th className="px-5 py-3.5">Last Checked</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-ink-primary">
                {monitors.map((mon) => (
                  <tr key={mon.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-5 py-4 font-medium">
                      <div className="flex items-center gap-2.5">
                        <span className="font-mono text-[11px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-ink-secondary">
                          {mon.method}
                        </span>
                        <div className="min-w-0">
                          <Link
                            to={`/monitors/${mon.id}`}
                            className="text-sm font-semibold text-ink-primary hover:text-brand-700 block truncate max-w-sm"
                          >
                            {mon.name}
                          </Link>
                          <span className="text-[11px] text-ink-muted font-mono block truncate max-w-sm">
                            {mon.url}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <StatusBadge status={mon.status} size="sm" />
                    </td>
                    <td className="px-5 py-4 font-mono font-medium text-ink-secondary">
                      {mon.lastLatencyMs !== null ? `${mon.lastLatencyMs} ms` : '—'}
                    </td>
                    <td className="px-5 py-4 text-ink-secondary">{mon.intervalSeconds}s</td>
                    <td className="px-5 py-4 text-ink-secondary">
                      {mon.lastCheckedAt ? new Date(mon.lastCheckedAt).toLocaleTimeString() : 'Never'}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {mon.active ? (
                          <button
                            onClick={() => pauseMutation.mutate(mon.id)}
                            title="Pause checks"
                            className="p-1.5 text-ink-secondary hover:text-amber-600 hover:bg-amber-50 rounded-md transition-colors"
                          >
                            <Pause className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <button
                            onClick={() => resumeMutation.mutate(mon.id)}
                            title="Resume checks"
                            className="p-1.5 text-ink-secondary hover:text-green-600 hover:bg-green-50 rounded-md transition-colors"
                          >
                            <Play className="w-3.5 h-3.5" />
                          </button>
                        )}

                        <button
                          onClick={() => setDeleteTarget(mon)}
                          title="Delete monitor"
                          className="p-1.5 text-ink-secondary hover:text-state-danger hover:bg-red-50 rounded-md transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>

                        <Link
                          to={`/monitors/${mon.id}`}
                          title="View details"
                          className="p-1.5 text-ink-secondary hover:text-brand-700 hover:bg-brand-50 rounded-md transition-colors"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Monitor Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-2xl bg-surface rounded-2xl shadow-2xl border border-boundary overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-boundary bg-slate-50/50">
              <div>
                <h3 className="text-base font-bold text-ink-primary">Add HTTP Monitor</h3>
                <p className="text-xs text-ink-secondary mt-0.5">
                  Periodic health and latency probes executed from independent workers
                </p>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-ink-muted hover:text-ink-secondary p-1 rounded-md"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-ink-primary mb-1">
                    Monitor Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Users API Health"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-boundary rounded-lg text-ink-primary focus:ring-2 focus:ring-brand-400 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-ink-primary mb-1">Method</label>
                  <select
                    value={formMethod}
                    onChange={(e) => setFormMethod(e.target.value as any)}
                    className="w-full px-3 py-2 text-xs bg-white border border-boundary rounded-lg text-ink-primary font-mono focus:ring-2 focus:ring-brand-400 focus:outline-hidden"
                  >
                    {HTTP_METHODS.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink-primary mb-1">
                  Target Endpoint URL
                </label>
                <input
                  type="url"
                  required
                  placeholder="https://api.example.com/health"
                  value={formUrl}
                  onChange={(e) => setFormUrl(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono bg-white border border-boundary rounded-lg text-ink-primary focus:ring-2 focus:ring-brand-400 focus:outline-hidden"
                />
                <p className="mt-1 text-[11px] text-ink-muted flex items-center gap-1">
                  <ShieldAlert className="w-3.5 h-3.5 text-brand-700" />
                  Protected by SSRF guard: internal, loopback, and metadata destinations blocked.
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-ink-primary mb-1">
                    Interval (sec)
                  </label>
                  <input
                    type="number"
                    min={30}
                    max={3600}
                    value={formInterval}
                    onChange={(e) => setFormInterval(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs bg-white border border-boundary rounded-lg text-ink-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-ink-primary mb-1">
                    Timeout (ms)
                  </label>
                  <input
                    type="number"
                    min={1000}
                    max={30000}
                    value={formTimeout}
                    onChange={(e) => setFormTimeout(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs bg-white border border-boundary rounded-lg text-ink-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-ink-primary mb-1">
                    Expected HTTP
                  </label>
                  <input
                    type="text"
                    placeholder="200, 204"
                    value={formCodes}
                    onChange={(e) => setFormCodes(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-boundary rounded-lg text-ink-primary font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-ink-primary mb-1">
                    Degraded (ms)
                  </label>
                  <input
                    type="number"
                    min={100}
                    value={formThreshold}
                    onChange={(e) => setFormThreshold(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs bg-white border border-boundary rounded-lg text-ink-primary"
                  />
                </div>
              </div>

              {/* Advanced Headers & Request Payload Accordion */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="flex items-center gap-1.5 text-xs font-semibold text-brand-700 hover:text-brand-800"
                >
                  <Sliders className="w-3.5 h-3.5" />
                  {showAdvanced ? 'Hide advanced request configuration' : 'Configure custom headers and body'}
                </button>

                {showAdvanced && (
                  <div className="mt-3 p-4 bg-slate-50 border border-boundary rounded-xl space-y-3 animate-fade-in">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-ink-primary">Headers</span>
                        <button
                          type="button"
                          onClick={() =>
                            setFormHeaders([...formHeaders, { key: '', value: '', sensitive: false }])
                          }
                          className="text-[11px] font-semibold text-brand-700 hover:text-brand-800"
                        >
                          + Add Header
                        </button>
                      </div>
                      {formHeaders.map((header, idx) => (
                        <div key={idx} className="flex items-center gap-2 mb-2">
                          <input
                            type="text"
                            placeholder="Header Key (e.g. Authorization)"
                            value={header.key}
                            onChange={(e) => {
                              const updated = [...formHeaders];
                              updated[idx].key = e.target.value;
                              setFormHeaders(updated);
                            }}
                            className="flex-1 px-2.5 py-1.5 text-xs font-mono bg-white border border-boundary rounded-md"
                          />
                          <input
                            type="text"
                            placeholder="Value"
                            value={header.value}
                            onChange={(e) => {
                              const updated = [...formHeaders];
                              updated[idx].value = e.target.value;
                              setFormHeaders(updated);
                            }}
                            className="flex-1 px-2.5 py-1.5 text-xs font-mono bg-white border border-boundary rounded-md"
                          />
                          <label className="flex items-center gap-1 text-[11px] text-ink-secondary whitespace-nowrap">
                            <input
                              type="checkbox"
                              checked={header.sensitive}
                              onChange={(e) => {
                                const updated = [...formHeaders];
                                updated[idx].sensitive = e.target.checked;
                                setFormHeaders(updated);
                              }}
                              className="rounded text-brand-700"
                            />
                            Encrypt
                          </label>
                          <button
                            type="button"
                            onClick={() => setFormHeaders(formHeaders.filter((_, i) => i !== idx))}
                            className="text-ink-muted hover:text-state-danger p-1"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-ink-primary mb-1">
                        Request Body (JSON / text)
                      </label>
                      <textarea
                        rows={3}
                        value={formBody}
                        onChange={(e) => setFormBody(e.target.value)}
                        placeholder='{"check": true}'
                        className="w-full px-3 py-2 text-xs font-mono bg-white border border-boundary rounded-lg text-ink-primary focus:ring-2 focus:ring-brand-400 focus:outline-hidden"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-boundary flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-ink-secondary hover:text-ink-primary hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="px-5 py-2 text-xs font-semibold text-white bg-brand-700 hover:bg-brand-800 disabled:opacity-60 rounded-lg shadow-xs transition-colors"
                >
                  {createMutation.isPending ? 'Validating & Saving...' : 'Save Monitor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Delete Monitor"
        message={`Are you sure you want to deactivate and delete "${deleteTarget?.name}"? All future scheduled checks will stop immediately.`}
        confirmLabel="Delete Monitor"
        variant="danger"
        isLoading={deleteMutation.isPending}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
};
