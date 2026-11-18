import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Activity,
  BarChart3,
  AlertOctagon,
  BellRing,
  Settings,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';

interface SidebarNavProps {
  onCloseMobile?: () => void;
}

export const SidebarNav: React.FC<SidebarNavProps> = ({ onCloseMobile }) => {
  const { activeWorkspace, user } = useAuth();

  const navigation = [
    { name: 'Overview', href: '/', icon: LayoutDashboard },
    { name: 'Monitors', href: '/monitors', icon: Activity },
    { name: 'Analytics', href: '/analytics', icon: BarChart3 },
    { name: 'Incidents', href: '/incidents', icon: AlertOctagon },
    { name: 'Alert Rules', href: '/alert-rules', icon: BellRing },
    { name: 'Settings', href: '/settings', icon: Settings },
  ];

  return (
    <div className="flex flex-col h-full bg-surface border-r border-boundary select-none">
      {/* Brand Header */}
      <div className="flex items-center gap-3 px-6 h-16 border-b border-boundary">
        <div className="w-8 h-8 rounded-lg bg-brand-700 flex items-center justify-center text-white shadow-xs">
          <ShieldCheck className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <span className="font-bold text-ink-primary tracking-tight text-sm block truncate">
            API Monitor
          </span>
          <span className="text-[10px] text-ink-muted uppercase tracking-wider font-semibold block">
            Enterprise MVP
          </span>
        </div>
      </div>

      {/* Workspace Context Capsule */}
      <div className="px-4 py-3 border-b border-boundary bg-canvas/50">
        <div className="text-[11px] font-medium text-ink-secondary mb-1">Active Workspace</div>
        <div className="flex items-center justify-between text-xs font-semibold text-ink-primary bg-surface p-2 rounded-lg border border-boundary">
          <span className="truncate">{activeWorkspace?.name || 'Default'}</span>
          <span className="px-1.5 py-0.5 rounded text-[10px] uppercase font-bold bg-brand-50 text-brand-700">
            {activeWorkspace?.role || 'member'}
          </span>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navigation.map((item) => {
          return (
            <NavLink
              key={item.name}
              to={item.href}
              end={item.href === '/'}
              onClick={onCloseMobile}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                  isActive
                    ? 'bg-brand-50 text-brand-700 font-semibold shadow-xs'
                    : 'text-ink-secondary hover:text-ink-primary hover:bg-slate-100'
                }`
              }
            >
              <item.icon className="w-4 h-4 flex-shrink-0" />
              <span>{item.name}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* User Footer */}
      <div className="p-4 border-t border-boundary bg-surface">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center font-bold text-xs text-ink-primary">
            {user?.name?.[0]?.toUpperCase() || 'U'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-ink-primary truncate">{user?.name}</p>
            <p className="text-[11px] text-ink-secondary truncate">{user?.email}</p>
          </div>
        </div>
      </div>
    </div>
  );
};
