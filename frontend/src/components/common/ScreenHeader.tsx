import React from 'react';
import { BackIcon } from '@/components/ui/Icons';

interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  actions?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}

export default function ScreenHeader({
  title,
  subtitle,
  onBack,
  actions,
  children,
  className = '',
}: ScreenHeaderProps) {
  return (
    <div className={`surface-panel px-4 py-3 ${className}`}>
      <div className="flex items-center gap-3">
        {onBack && (
          <button
            onClick={onBack}
            className="w-9 h-9 rounded-xl hover:bg-card text-muted hover:text-body flex items-center justify-center transition-colors shrink-0"
            aria-label="Back"
          >
            <BackIcon size={18} />
          </button>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold text-heading tracking-tight truncate">{title}</h1>
          {subtitle && <p className="text-sm text-muted mt-0.5 truncate">{subtitle}</p>}
        </div>
        {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
      </div>
      {children && <div className="mt-3">{children}</div>}
    </div>
  );
}
