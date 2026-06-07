import React from 'react';

interface SectionCardProps {
  title?: string;
  subtitle?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}

export default function SectionCard({
  title,
  subtitle,
  icon,
  action,
  children,
  className = '',
  bodyClassName = '',
}: SectionCardProps) {
  return (
    <section className={`bg-card border border-default rounded-2xl p-4 ${className}`}>
      {(title || subtitle || action) && (
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0 flex-1">
            {title && (
              <div className="flex items-center gap-2">
                {icon && <span className="text-body shrink-0">{icon}</span>}
                <h3 className="text-base font-semibold text-heading truncate">{title}</h3>
              </div>
            )}
            {subtitle && <p className="text-sm text-muted mt-1">{subtitle}</p>}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}
