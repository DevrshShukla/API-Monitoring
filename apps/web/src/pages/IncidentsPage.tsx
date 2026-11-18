import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  AlertOctagon,
  CheckCircle2,
  Clock,
  Filter,
  Search,
  ChevronRight,
  MessageSquare,
  ShieldAlert,
  Send,
  X,
  User,
  Activity,
} from 'lucide-react';
import { api } from '../lib/api';
import { useToast } from '../context/ToastContext';
import { Skeleton } from '../components/Skeleton';
import { EmptyState } from '../components/EmptyState';
import { ErrorState } from '../components/ErrorState';

export function IncidentsPage() {
  const { addToast } = useToast();
  const queryClient = useQueryClient();

  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);

  // Resolution modal state
  const [isResolveModalOpen, setIsResolveModalOpen] = useState(false);
  const [resolutionNote, setResolutionNote] = useState('');

  // Note form state
  const [newNote, setNewNote] = useState('');

  // Fetch incidents list
  const {
    data: incidentsData,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['incidents', statusFilter, severityFilter],
    queryFn: async () => {
      const params: any = { limit: 50 };
      if (statusFilter !== 'all') params.status = statusFilter;
      if (severityFilter !== 'all') params.severity = severityFilter;
      const res = await api.get('/incidents', { params });
      return res.data.data;
    },
    refetchInterval: 10000,
  });

  const incidents = incidentsData?.incidents || [];

  // Fetch selected incident detail
  const { data: selectedIncident, isLoading: isLoadingDetail } = useQuery({
    queryKey: ['incident-detail', selectedIncidentId],
    queryFn: async () => {
      if (!selectedIncidentId) return null;
      const res = await api.get(`/incidents/${selectedIncidentId}`);
      return res.data.data;
    },
    enabled: !!selectedIncidentId,
  });

  // Action mutations
  const ackMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.post(`/incidents/${id}/acknowledge`);
      return res.data;
    },
    onSuccess: () => {
      addToast('Incident acknowledged', 'success');
      queryClient.invalidateQueries({ queryKey: ['incidents'] });
      queryClient.invalidateQueries({ queryKey: ['incident-detail', selectedIncidentId] });
    },
    onError: (err: any) => {
      addToast(err.response?.data?.error?.message || 'Failed to acknowledge incident', 'error');
    },
  });

  const investigateMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.post(`/incidents/${id}/investigate`);
      return res.data;
    },
    onSuccess: () => {
      addToast('Incident state moved to investigating', 'success');
      queryClient.invalidateQueries({ queryKey: ['incidents'] });
      queryClient.invalidateQueries({ queryKey: ['incident-detail', selectedIncidentId] });
    },
    onError: (err: any) => {
      addToast(err.response?.data?.error?.message || 'Failed to update incident', 'error');
    },
  });

  const resolveMutation = useMutation({
    mutationFn: async ({ id, note }: { id: string; note: string }) => {
      const res = await api.post(`/incidents/${id}/resolve`, { resolutionNote: note });
      return res.data;
    },
    onSuccess: () => {
      addToast('Incident resolved successfully', 'success');
      setIsResolveModalOpen(false);
      setResolutionNote('');
      queryClient.invalidateQueries({ queryKey: ['incidents'] });
      queryClient.invalidateQueries({ queryKey: ['incident-detail', selectedIncidentId] });
    },
    onError: (err: any) => {
      addToast(err.response?.data?.error?.message || 'Failed to resolve incident', 'error');
    },
  });

  const addNoteMutation = useMutation({
    mutationFn: async ({ id, note }: { id: string; note: string }) => {
      const res = await api.post(`/incidents/${id}/notes`, { note });
      return res.data;
    },
    onSuccess: () => {
      addToast('Timeline note posted', 'success');
      setNewNote('');
      queryClient.invalidateQueries({ queryKey: ['incident-detail', selectedIncidentId] });
    },
    onError: (err: any) => {
      addToast(err.response?.data?.error?.message || 'Failed to post note', 'error');
    },
  });

  // Filtered incidents by search
  const filteredIncidents = incidents.filter((inc: any) =>
    inc.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getSeverityBadge = (sev: string) => {
    switch (sev) {
      case 'p1':
        return (
          <span className="px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300">
            P1 - Critical
          </span>
        );
      case 'p2':
        return (
          <span className="px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
            P2 - High
          </span>
        );
      case 'p3':
        return (
          <span className="px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300">
            P3 - Medium
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300">
            P4 - Low
          </span>
        );
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'resolved':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-400">
            <CheckCircle2 className="w-3 h-3" /> Resolved
          </span>
        );
      case 'investigating':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-400">
            <Activity className="w-3 h-3 animate-pulse" /> Investigating
          </span>
        );
      case 'identified':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-400">
            <AlertOctagon className="w-3 h-3" /> Identified
          </span>
        );
      case 'monitoring':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-400">
            <Clock className="w-3 h-3" /> Monitoring
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300">
            {status}
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
            <ShieldAlert className="w-7 h-7 text-rose-600" /> Incidents & Outages
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Lifecycle tracking, incident response workflows, and post-incident timelines.
          </p>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search incidents by title..."
            className="w-full pl-9 pr-4 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white"
          />
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 shadow-sm">
            <Filter className="w-4 h-4 text-slate-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-transparent text-sm font-medium text-slate-700 dark:text-slate-200 outline-none cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="investigating">Investigating</option>
              <option value="identified">Identified</option>
              <option value="monitoring">Monitoring</option>
              <option value="resolved">Resolved</option>
            </select>
          </div>

          <div className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 shadow-sm">
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="bg-transparent text-sm font-medium text-slate-700 dark:text-slate-200 outline-none cursor-pointer"
            >
              <option value="all">All Severities</option>
              <option value="p1">P1 - Critical</option>
              <option value="p2">P2 - High</option>
              <option value="p3">P3 - Medium</option>
              <option value="p4">P4 - Low</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Content Layout: Incidents List & Detail Drawer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Incidents Table / List */}
        <div
          className={`${
            selectedIncidentId ? 'lg:col-span-6 xl:col-span-5' : 'lg:col-span-12'
          } bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm transition-all`}
        >
          {isLoading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-16 rounded-lg" />
              ))}
            </div>
          ) : isError ? (
            <ErrorState message="Could not load incidents" onRetry={() => refetch()} />
          ) : filteredIncidents.length === 0 ? (
            <EmptyState
              icon={CheckCircle2}
              title="No Incidents Found"
              description="All systems are operating normally. No alerts or active outages match your filter criteria."
            />
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredIncidents.map((incident: any) => {
                const isSelected = selectedIncidentId === incident._id;
                return (
                  <div
                    key={incident._id}
                    onClick={() => setSelectedIncidentId(incident._id)}
                    className={`p-4 cursor-pointer transition-colors flex items-center justify-between gap-4 ${
                      isSelected
                        ? 'bg-blue-50/70 dark:bg-blue-950/30 border-l-4 border-l-blue-600'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        {getSeverityBadge(incident.severity)}
                        {getStatusBadge(incident.status)}
                        <span className="text-xs text-slate-400">
                          {new Date(incident.createdAt).toLocaleDateString()} at{' '}
                          {new Date(incident.createdAt).toLocaleTimeString()}
                        </span>
                      </div>
                      <h3 className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                        {incident.title}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                        Monitor: <span className="font-mono">{incident.monitorId?.name || 'Service'}</span>
                      </p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-400 shrink-0" />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Selected Incident Detail & Timeline */}
        {selectedIncidentId && (
          <div className="lg:col-span-6 xl:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm space-y-6">
            {isLoadingDetail ? (
              <div className="space-y-4">
                <Skeleton className="h-8 w-1/3" />
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-40 w-full" />
              </div>
            ) : selectedIncident ? (
              <>
                {/* Header and Actions */}
                <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      {getSeverityBadge(selectedIncident.severity)}
                      {getStatusBadge(selectedIncident.status)}
                    </div>
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                      {selectedIncident.title}
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Incident ID: <span className="font-mono">{selectedIncident._id}</span>
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedIncidentId(null)}
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Status action buttons */}
                {selectedIncident.status !== 'resolved' && (
                  <div className="flex flex-wrap items-center gap-2 p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider mr-2">
                      Actions:
                    </span>
                    <button
                      onClick={() => ackMutation.mutate(selectedIncident._id)}
                      disabled={ackMutation.isPending}
                      className="px-3 py-1.5 text-xs font-medium rounded-md bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600 hover:bg-slate-50 transition-colors shadow-sm"
                    >
                      Acknowledge
                    </button>
                    <button
                      onClick={() => investigateMutation.mutate(selectedIncident._id)}
                      disabled={investigateMutation.isPending}
                      className="px-3 py-1.5 text-xs font-medium rounded-md bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600 hover:bg-slate-50 transition-colors shadow-sm"
                    >
                      Investigate
                    </button>
                    <button
                      onClick={() => setIsResolveModalOpen(true)}
                      className="px-3 py-1.5 text-xs font-semibold rounded-md bg-emerald-600 text-white hover:bg-emerald-700 transition-colors shadow-sm ml-auto"
                    >
                      Resolve Incident
                    </button>
                  </div>
                )}

                {/* Incident Metadata */}
                <div className="grid grid-cols-2 gap-4 text-xs bg-slate-50 dark:bg-slate-800/30 p-4 rounded-lg">
                  <div>
                    <span className="text-slate-400 block mb-1">Started At</span>
                    <span className="font-medium text-slate-800 dark:text-slate-200">
                      {new Date(selectedIncident.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block mb-1">Resolved At</span>
                    <span className="font-medium text-slate-800 dark:text-slate-200">
                      {selectedIncident.resolvedAt
                        ? new Date(selectedIncident.resolvedAt).toLocaleString()
                        : 'Unresolved'}
                    </span>
                  </div>
                </div>

                {/* Timeline Section */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Incident Timeline
                  </h3>

                  <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-800">
                    {(selectedIncident.events || []).map((ev: any, i: number) => (
                      <div key={i} className="relative group">
                        <div className="absolute -left-6 top-1 w-2.5 h-2.5 rounded-full bg-blue-600 ring-4 ring-white dark:ring-slate-900" />
                        <div className="text-xs text-slate-400 mb-0.5">
                          {new Date(ev.timestamp || ev.createdAt).toLocaleTimeString()} ·{' '}
                          <span className="font-semibold uppercase">{ev.type}</span>
                        </div>
                        <p className="text-sm text-slate-800 dark:text-slate-200 font-medium">
                          {ev.message || ev.description}
                        </p>
                      </div>
                    ))}
                  </div>

                  {/* Add note form */}
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (newNote.trim()) {
                        addNoteMutation.mutate({ id: selectedIncident._id, note: newNote });
                      }
                    }}
                    className="flex gap-2 pt-2"
                  >
                    <input
                      type="text"
                      value={newNote}
                      onChange={(e) => setNewNote(e.target.value)}
                      placeholder="Add an internal note to the timeline..."
                      className="flex-1 px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white"
                    />
                    <button
                      type="submit"
                      disabled={!newNote.trim() || addNoteMutation.isPending}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-1.5"
                    >
                      <Send className="w-4 h-4" /> Send
                    </button>
                  </form>
                </div>
              </>
            ) : null}
          </div>
        )}
      </div>

      {/* Resolve Incident Modal */}
      {isResolveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              Resolve Incident
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Provide a resolution note explaining root cause or remediation steps taken (min 5 characters).
            </p>
            <textarea
              value={resolutionNote}
              onChange={(e) => setResolutionNote(e.target.value)}
              placeholder="e.g. Upstream database failover completed and latency normalized."
              rows={4}
              className="w-full p-3 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white"
            />
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsResolveModalOpen(false)}
                className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={resolutionNote.trim().length < 5 || resolveMutation.isPending}
                onClick={() => {
                  if (selectedIncidentId) {
                    resolveMutation.mutate({
                      id: selectedIncidentId,
                      note: resolutionNote.trim(),
                    });
                  }
                }}
                className="px-4 py-2 text-sm font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors disabled:opacity-50"
              >
                Confirm Resolution
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
