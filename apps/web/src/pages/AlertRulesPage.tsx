import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Bell,
  Plus,
  Trash2,
  Edit,
  Mail,
  Smartphone,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Shield,
  Activity,
  X,
} from 'lucide-react';
import { api } from '../lib/api';
import { useToast } from '../context/ToastContext';
import { Skeleton } from '../components/Skeleton';
import { EmptyState } from '../components/EmptyState';
import { ErrorState } from '../components/ErrorState';
import { ConfirmDialog } from '../components/ConfirmDialog';

interface AlertRuleFormData {
  _id?: string;
  name: string;
  monitorId: string;
  conditionType: 'consecutive_failures' | 'latency_threshold' | 'error_rate';
  threshold: number;
  windowSeconds?: number;
  severity: 'p1' | 'p2' | 'p3' | 'p4';
  channels: ('in_app' | 'email')[];
  cooldownMinutes: number;
  enabled: boolean;
}

const DEFAULT_FORM: AlertRuleFormData = {
  name: '',
  monitorId: '',
  conditionType: 'consecutive_failures',
  threshold: 3,
  windowSeconds: 300,
  severity: 'p2',
  channels: ['in_app'],
  cooldownMinutes: 15,
  enabled: true,
};

export function AlertRulesPage() {
  const { addToast } = useToast();
  const queryClient = useQueryClient();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState<AlertRuleFormData>(DEFAULT_FORM);
  const [ruleToDelete, setRuleToDelete] = useState<{ id: string; name: string } | null>(null);

  // Fetch alert rules
  const {
    data: alertRulesData,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['alert-rules'],
    queryFn: async () => {
      const res = await api.get('/alert-rules');
      return res.data.data;
    },
  });

  // Fetch monitors for dropdown
  const { data: monitorsData } = useQuery({
    queryKey: ['monitors-list-simple'],
    queryFn: async () => {
      const res = await api.get('/monitors?limit=100');
      return res.data.data;
    },
  });

  const alertRules = alertRulesData?.rules || [];
  const monitors = monitorsData?.monitors || [];

  // Create or Update mutation
  const saveMutation = useMutation({
    mutationFn: async (payload: AlertRuleFormData) => {
      const body: any = {
        name: payload.name,
        conditionType: payload.conditionType,
        threshold: Number(payload.threshold),
        windowSeconds: Number(payload.windowSeconds || 300),
        severity: payload.severity,
        channels: payload.channels,
        cooldownMinutes: Number(payload.cooldownMinutes || 15),
        enabled: payload.enabled,
      };
      if (payload.monitorId) {
        body.monitorId = payload.monitorId;
      }

      if (payload._id) {
        return (await api.patch(`/alert-rules/${payload._id}`, body)).data;
      } else {
        return (await api.post('/alert-rules', body)).data;
      }
    },
    onSuccess: (_, vars) => {
      addToast(vars._id ? 'Alert rule updated' : 'Alert rule created successfully', 'success');
      setIsModalOpen(false);
      setFormData(DEFAULT_FORM);
      queryClient.invalidateQueries({ queryKey: ['alert-rules'] });
    },
    onError: (err: any) => {
      addToast(err.response?.data?.error?.message || 'Failed to save alert rule', 'error');
    },
  });

  // Toggle enabled mutation
  const toggleMutation = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      return (await api.patch(`/alert-rules/${id}`, { enabled })).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alert-rules'] });
    },
    onError: (err: any) => {
      addToast(err.response?.data?.error?.message || 'Failed to toggle alert rule', 'error');
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return (await api.delete(`/alert-rules/${id}`)).data;
    },
    onSuccess: () => {
      addToast('Alert rule deleted', 'success');
      setRuleToDelete(null);
      queryClient.invalidateQueries({ queryKey: ['alert-rules'] });
    },
    onError: (err: any) => {
      addToast(err.response?.data?.error?.message || 'Failed to delete alert rule', 'error');
    },
  });

  const handleOpenEdit = (rule: any) => {
    setFormData({
      _id: rule._id,
      name: rule.name,
      monitorId: rule.monitorId?._id || rule.monitorId || '',
      conditionType: rule.conditionType,
      threshold: rule.threshold,
      windowSeconds: rule.windowSeconds || 300,
      severity: rule.severity,
      channels: rule.channels || ['in_app'],
      cooldownMinutes: rule.cooldownMinutes || 15,
      enabled: rule.enabled,
    });
    setIsModalOpen(true);
  };

  const getConditionLabel = (type: string, threshold: number) => {
    switch (type) {
      case 'consecutive_failures':
        return `${threshold} consecutive failures`;
      case 'latency_threshold':
        return `Latency > ${threshold}ms`;
      case 'error_rate':
        return `Error rate > ${threshold}%`;
      default:
        return `${type} (${threshold})`;
    }
  };

  const getSeverityBadge = (sev: string) => {
    switch (sev) {
      case 'p1':
        return (
          <span className="px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300">
            P1
          </span>
        );
      case 'p2':
        return (
          <span className="px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
            P2
          </span>
        );
      case 'p3':
        return (
          <span className="px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300">
            P3
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300">
            P4
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <Bell className="w-7 h-7 text-blue-600" /> Alert Rules
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Automate notifications, incident triggers, and threshold breaches.
          </p>
        </div>

        <button
          onClick={() => {
            setFormData(DEFAULT_FORM);
            setIsModalOpen(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" /> Create Alert Rule
        </button>
      </div>

      {/* Rules Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="p-6 space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-14 rounded-lg" />
            ))}
          </div>
        ) : isError ? (
          <ErrorState message="Could not load alert rules" onRetry={() => refetch()} />
        ) : alertRules.length === 0 ? (
          <EmptyState
            icon={Bell}
            title="No Alert Rules Configured"
            description="Create your first alert rule to be notified when downtime, error rates, or latency thresholds are breached."
            actionLabel="Create Alert Rule"
            onAction={() => {
              setFormData(DEFAULT_FORM);
              setIsModalOpen(true);
            }}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 dark:bg-slate-800/30 text-xs font-medium text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                  <th className="py-3 px-4">Rule Name</th>
                  <th className="py-3 px-4">Condition</th>
                  <th className="py-3 px-4">Target Monitor</th>
                  <th className="py-3 px-4">Severity</th>
                  <th className="py-3 px-4">Channels</th>
                  <th className="py-3 px-4">Cooldown</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                {alertRules.map((rule: any) => (
                  <tr
                    key={rule._id}
                    className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">
                      {rule.name}
                    </td>
                    <td className="py-3 px-4 text-slate-700 dark:text-slate-300 font-mono text-xs">
                      {getConditionLabel(rule.conditionType, rule.threshold)}
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-400 text-xs">
                      {rule.monitorId?.name || (
                        <span className="italic text-slate-400">All Monitors</span>
                      )}
                    </td>
                    <td className="py-3 px-4">{getSeverityBadge(rule.severity)}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5">
                        {rule.channels?.includes('in_app') && (
                          <span
                            title="In-App Notification"
                            className="p-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                          >
                            <Smartphone className="w-3.5 h-3.5" />
                          </span>
                        )}
                        {rule.channels?.includes('email') && (
                          <span
                            title="Email Notification"
                            className="p-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                          >
                            <Mail className="w-3.5 h-3.5" />
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-500 font-mono">
                      {rule.cooldownMinutes}m
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() =>
                          toggleMutation.mutate({ id: rule._id, enabled: !rule.enabled })
                        }
                        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out focus:outline-none ${
                          rule.enabled ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-700'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-md transition duration-200 ease-in-out mt-0.5 ${
                            rule.enabled ? 'translate-x-4' : 'translate-x-0.5'
                          }`}
                        />
                      </button>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleOpenEdit(rule)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setRuleToDelete({ id: rule._id, name: rule.name })}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create / Edit Rule Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 max-w-lg w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                {formData._id ? 'Edit Alert Rule' : 'New Alert Rule'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                saveMutation.mutate(formData);
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1">
                  Rule Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Critical API Failure Alert"
                  className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1">
                  Target Monitor
                </label>
                <select
                  value={formData.monitorId}
                  onChange={(e) => setFormData({ ...formData, monitorId: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white"
                >
                  <option value="">All Monitors in Workspace</option>
                  {monitors.map((m: any) => (
                    <option key={m._id} value={m._id}>
                      {m.name} ({m.url})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1">
                    Condition Type
                  </label>
                  <select
                    value={formData.conditionType}
                    onChange={(e: any) =>
                      setFormData({ ...formData, conditionType: e.target.value })
                    }
                    className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white"
                  >
                    <option value="consecutive_failures">Consecutive Failures</option>
                    <option value="latency_threshold">Latency Threshold (ms)</option>
                    <option value="error_rate">Error Rate (%)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1">
                    Threshold Value
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={formData.threshold}
                    onChange={(e) =>
                      setFormData({ ...formData, threshold: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1">
                    Severity
                  </label>
                  <select
                    value={formData.severity}
                    onChange={(e: any) => setFormData({ ...formData, severity: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white"
                  >
                    <option value="p1">P1 - Critical</option>
                    <option value="p2">P2 - High</option>
                    <option value="p3">P3 - Medium</option>
                    <option value="p4">P4 - Low</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1">
                    Cooldown (minutes)
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={formData.cooldownMinutes}
                    onChange={(e) =>
                      setFormData({ ...formData, cooldownMinutes: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Channels checkboxes */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-2">
                  Delivery Channels
                </label>
                <div className="flex items-center gap-6">
                  <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.channels.includes('in_app')}
                      onChange={(e) => {
                        const newChannels = e.target.checked
                          ? [...formData.channels, 'in_app' as const]
                          : formData.channels.filter((c) => c !== 'in_app');
                        setFormData({ ...formData, channels: newChannels });
                      }}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    In-App Notification
                  </label>
                  <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.channels.includes('email')}
                      onChange={(e) => {
                        const newChannels = e.target.checked
                          ? [...formData.channels, 'email' as const]
                          : formData.channels.filter((c) => c !== 'email');
                        setFormData({ ...formData, channels: newChannels });
                      }}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    Email Notification
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saveMutation.isPending || formData.channels.length === 0}
                  className="px-4 py-2 text-sm font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {saveMutation.isPending ? 'Saving...' : formData._id ? 'Update Rule' : 'Create Rule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!ruleToDelete}
        title="Delete Alert Rule"
        message={`Are you sure you want to permanently delete "${ruleToDelete?.name}"? You will no longer receive notifications triggered by this rule.`}
        confirmLabel="Delete Rule"
        isDestructive
        onConfirm={() => {
          if (ruleToDelete) deleteMutation.mutate(ruleToDelete.id);
        }}
        onCancel={() => setRuleToDelete(null)}
      />
    </div>
  );
}
