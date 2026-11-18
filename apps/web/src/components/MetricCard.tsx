import React from 'react';
import { LucideIcon } from 'lucide-react';

interface MetricCardProps {
  label: string;
  value: React.ReactNode;
  unit?: string;
  description?: string;
  trend?: string;
  trendDirection?: 'up' | 'down' | 'neutral';
  change?: string;
  changeType?: 'positive' | 'negative' | 'neutral' | 'up' | 'down';
  loading?: boolean;
  error?: string;
  icon?: LucideIcon;
  variant?: 'default' | 'success' | 'warning' | 'danger';
}

export const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  unit,
  description,
  trend,
  trendDirection,
  change,
  changeType,
  loading = false,
  error,
  icon: Icon,
  variant = 'default',
}) => {
  const effectiveTrend = trend || change;
  const effectiveDirection: 'up' | 'down' | 'neutral' =
    trendDirection ||
    (changeType === 'positive' || changeType === 'up'
      ? 'up'
      : changeType === 'negative' || changeType === 'down'
      ? 'down'
      : 'neutral');
  const borderStyles = {
    default: 'border-boundary',
    success: 'border-green-200 bg-green-50/30',
    warning: 'border-amber-200 bg-amber-50/30',
    danger: 'border-red-200 bg-red-50/30',
  }[variant];

  const trendColor = {
    up: 'text-green-600',
    down: 'text-red-600',
    neutral: 'text-ink-secondary',
  }[effectiveDirection || 'neutral'];

  return (
    <div className={`p-5 bg-surface rounded-xl border shadow-xs transition-all ${borderStyles}`}>
      <div className="flex items-center justify-between text-ink-secondary text-sm font-medium">
        <span>{label}</span>
        {Icon && <Icon className="w-4 h-4 text-ink-muted" />}
      </div>

      <div className="mt-3 flex items-baseline gap-1.5">
        {loading ? (
          <div className="h-8 w-24 bg-slate-200 rounded animate-pulse" />
        ) : error ? (
          <span className="text-sm text-state-danger font-medium">{error}</span>
        ) : value === null || value === undefined ? (
          <span className="text-2xl font-bold text-ink-muted tracking-tight">—</span>
        ) : (
          <>
            <span className="text-2xl font-bold text-ink-primary tracking-tight">{value}</span>
            {unit && <span className="text-sm font-medium text-ink-secondary">{unit}</span>}
          </>
        )}
      </div>

      {(description || effectiveTrend) && (
        <div className="mt-2 flex items-center gap-2 text-xs">
          {effectiveTrend && <span className={`font-semibold ${trendColor}`}>{effectiveTrend}</span>}
          {description && <span className="text-ink-secondary">{description}</span>}
        </div>
      )}
    </div>
  );
};
