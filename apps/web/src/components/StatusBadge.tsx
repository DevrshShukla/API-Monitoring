import React from 'react';
import { CheckCircle2, AlertTriangle, XCircle, HelpCircle, PauseCircle } from 'lucide-react';
import { MonitorStatus, MONITOR_STATUS } from '@api-monitoring/shared';

interface StatusBadgeProps {
  status: MonitorStatus;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'md', className = '' }) => {
  const normalized = status?.toLowerCase() || MONITOR_STATUS.UNKNOWN;

  const config = {
    [MONITOR_STATUS.OPERATIONAL]: {
      label: 'Operational',
      icon: CheckCircle2,
      styles: 'bg-green-50 text-green-700 border-green-200',
      iconColor: 'text-green-600',
    },
    [MONITOR_STATUS.DEGRADED]: {
      label: 'Degraded',
      icon: AlertTriangle,
      styles: 'bg-amber-50 text-amber-700 border-amber-200',
      iconColor: 'text-amber-600',
    },
    [MONITOR_STATUS.DOWN]: {
      label: 'Down',
      icon: XCircle,
      styles: 'bg-red-50 text-red-700 border-red-200',
      iconColor: 'text-red-600',
    },
    [MONITOR_STATUS.PAUSED]: {
      label: 'Paused',
      icon: PauseCircle,
      styles: 'bg-slate-100 text-slate-700 border-slate-300',
      iconColor: 'text-slate-500',
    },
    [MONITOR_STATUS.UNKNOWN]: {
      label: 'Unknown',
      icon: HelpCircle,
      styles: 'bg-gray-100 text-gray-600 border-gray-300',
      iconColor: 'text-gray-500',
    },
  }[normalized] || {
    label: normalized,
    icon: HelpCircle,
    styles: 'bg-gray-100 text-gray-600 border-gray-300',
    iconColor: 'text-gray-500',
  };

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5 gap-1',
    md: 'text-xs px-2.5 py-1 gap-1.5 font-medium',
    lg: 'text-sm px-3 py-1.5 gap-2 font-medium',
  }[size];

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-3.5 h-3.5',
    lg: 'w-4 h-4',
  }[size];

  const Icon = config.icon;

  return (
    <span
      className={`inline-flex items-center rounded-full border shadow-xs transition-colors ${config.styles} ${sizeClasses} ${className}`}
    >
      <Icon className={`${iconSizes} ${config.iconColor} flex-shrink-0`} aria-hidden="true" />
      <span>{config.label}</span>
    </span>
  );
};
