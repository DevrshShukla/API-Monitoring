import React, { useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import {
  Menu,
  X,
  Bell,
  LogOut,
  ChevronDown,
  Building2,
  Check,
} from 'lucide-react';
import { SidebarNav } from './SidebarNav.js';
import { useAuth } from '../context/AuthContext.js';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api.js';
import { NotificationDto } from '@api-monitoring/shared';

export const AppShell: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false);
  const [notifMenuOpen, setNotifMenuOpen] = useState(false);
  const { user, workspaces, activeWorkspace, setActiveWorkspace, logout } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // Fetch in-app notifications
  const { data: notifData } = useQuery<{ data: NotificationDto[] }>({
    queryKey: ['notifications'],
    queryFn: async () => {
      const res = await apiClient.get('/notifications');
      return res.data;
    },
    enabled: !!activeWorkspace,
    refetchInterval: 30000,
  });

  const notifications = notifData?.data || [];
  const unreadCount = notifications.filter((n) => !n.readAt).length;

  const markReadMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.post(`/notifications/${id}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      await apiClient.post('/notifications/read-all');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  return (
    <div className="flex h-screen overflow-hidden bg-canvas">
      {/* Desktop Sidebar (Fixed 248px) */}
      <aside className="hidden md:flex md:w-[248px] md:flex-col md:fixed md:inset-y-0 z-30">
        <SidebarNav />
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative flex-1 flex flex-col max-w-xs w-full bg-surface shadow-xl">
            <div className="absolute top-2 right-2">
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-2 text-ink-secondary hover:text-ink-primary"
                aria-label="Close menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <SidebarNav onCloseMobile={() => setMobileMenuOpen(false)} />
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex flex-col flex-1 md:pl-[248px] overflow-hidden">
        {/* Top Header Bar */}
        <header className="h-16 bg-surface border-b border-boundary flex items-center justify-between px-4 sm:px-6 z-20">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden p-2 text-ink-secondary hover:text-ink-primary hover:bg-slate-100 rounded-lg"
              aria-label="Open sidebar menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Workspace Selector */}
            <div className="relative">
              <button
                onClick={() => setWorkspaceMenuOpen(!workspaceMenuOpen)}
                className="flex items-center gap-2 px-3 py-1.5 text-sm font-semibold text-ink-primary bg-slate-100 hover:bg-slate-200/80 rounded-lg transition-colors"
              >
                <Building2 className="w-4 h-4 text-brand-700" />
                <span className="truncate max-w-[140px] sm:max-w-[200px]">
                  {activeWorkspace?.name || 'Workspace'}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-ink-muted" />
              </button>

              {workspaceMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setWorkspaceMenuOpen(false)}
                  />
                  <div className="absolute left-0 mt-2 w-64 bg-surface rounded-xl shadow-lg border border-boundary py-2 z-20 animate-fade-in">
                    <div className="px-3 py-1.5 text-[11px] font-semibold text-ink-muted uppercase tracking-wider">
                      Switch Workspace
                    </div>
                    {workspaces.map((ws) => (
                      <button
                        key={ws.id}
                        onClick={() => {
                          setActiveWorkspace(ws);
                          setWorkspaceMenuOpen(false);
                          queryClient.clear();
                        }}
                        className="w-full flex items-center justify-between px-3 py-2 text-sm text-left hover:bg-slate-50 transition-colors"
                      >
                        <span className="font-medium text-ink-primary truncate">{ws.name}</span>
                        {ws.id === activeWorkspace?.id && (
                          <Check className="w-4 h-4 text-brand-700 flex-shrink-0" />
                        )}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Right Header Controls */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Notification Popover */}
            <div className="relative">
              <button
                onClick={() => setNotifMenuOpen(!notifMenuOpen)}
                className="relative p-2 text-ink-secondary hover:text-ink-primary hover:bg-slate-100 rounded-lg transition-colors"
                aria-label="View notifications"
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-state-danger ring-2 ring-white" />
                )}
              </button>

              {notifMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setNotifMenuOpen(false)}
                  />
                  <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-surface rounded-xl shadow-xl border border-boundary py-2 z-20 animate-fade-in">
                    <div className="flex items-center justify-between px-4 py-2 border-b border-boundary">
                      <span className="text-xs font-bold text-ink-primary">
                        Notifications {unreadCount > 0 && `(${unreadCount} unread)`}
                      </span>
                      {unreadCount > 0 && (
                        <button
                          onClick={() => markAllReadMutation.mutate()}
                          className="text-xs text-brand-700 hover:text-brand-800 font-medium"
                        >
                          Mark all as read
                        </button>
                      )}
                    </div>

                    <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                      {notifications.length === 0 ? (
                        <div className="p-6 text-center text-xs text-ink-muted">
                          No notifications yet
                        </div>
                      ) : (
                        notifications.slice(0, 15).map((n) => (
                          <div
                            key={n.id}
                            onClick={() => {
                              if (!n.readAt) markReadMutation.mutate(n.id);
                              if (n.incidentId) {
                                setNotifMenuOpen(false);
                                navigate('/incidents');
                              }
                            }}
                            className={`p-3 text-xs cursor-pointer hover:bg-slate-50 transition-colors ${
                              !n.readAt ? 'bg-brand-50/40' : ''
                            }`}
                          >
                            <p className="font-semibold text-ink-primary">{n.title}</p>
                            <p className="mt-0.5 text-ink-secondary line-clamp-2">{n.message}</p>
                            <p className="mt-1 text-[10px] text-ink-muted">
                              {new Date(n.createdAt).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Logout Button */}
            <button
              onClick={logout}
              title="Sign out"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-ink-secondary hover:text-state-danger hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-200"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </header>

        {/* Scrollable Main Content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="max-w-[1440px] mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};
