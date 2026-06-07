import React from 'react';

interface SettingsRowProps {
  label: string;
  description?: string;
  control: React.ReactNode;
  className?: string;
  noBorder?: boolean;
}

export default function SettingsRow({
  label,
  description,
  control,
  className = '',
  noBorder = false,
}: SettingsRowProps) {
  return (
    <div className={`flex items-center justify-between gap-3 py-2 ${!noBorder ? 'border-b border-subtle last:border-0' : ''} ${className}`}>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-heading">{label}</p>
        {description && <p className="text-xs text-muted mt-0.5">{description}</p>}
      </div>
      <div className="shrink-0">{control}</div>
    </div>
  );
}
