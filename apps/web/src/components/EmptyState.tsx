import React from 'react';
import { LucideIcon, PlusCircle } from 'lucide-react';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
    icon?: LucideIcon;
  };
  actionLabel?: string;
  onAction?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon = PlusCircle,
  title,
  description,
  action,
  actionLabel,
  onAction,
}) => {
  const effectiveAction = action || (actionLabel && onAction ? { label: actionLabel, onClick: onAction } : undefined);
  return (
    <div className="flex flex-col items-center justify-center p-8 sm:p-12 text-center bg-surface border border-dashed border-boundary rounded-xl">
      <div className="w-12 h-12 flex items-center justify-center rounded-full bg-brand-50 text-brand-700 mb-4">
        <Icon className="w-6 h-6" />
      </div>
      <h3 className="text-base font-semibold text-ink-primary">{title}</h3>
      <p className="mt-1 text-sm text-ink-secondary max-w-sm">{description}</p>
      {effectiveAction && (
        <button
          onClick={effectiveAction.onClick}
          className="mt-5 inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-brand-700 hover:bg-brand-800 rounded-lg shadow-xs transition-colors focus:ring-2 focus:ring-brand-400 focus:outline-hidden"
        >
          {effectiveAction.icon && <effectiveAction.icon className="w-4 h-4" />}
          {effectiveAction.label}
        </button>
      )}
    </div>
  );
};
