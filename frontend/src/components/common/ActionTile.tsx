import React from 'react';

interface ActionTileProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  onClick?: () => void;
  trailing?: React.ReactNode;
  className?: string;
}

export default function ActionTile({
  icon,
  title,
  description,
  onClick,
  trailing,
  className = '',
}: ActionTileProps) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      {...(onClick ? { onClick } : {})}
      className={`w-full flex items-center gap-4 p-4 bg-card border border-default rounded-2xl text-left ${onClick ? 'card-hover active:scale-[0.98]' : ''} ${className}`}
    >
      {icon && <div className="w-11 h-11 rounded-xl bg-elevated flex items-center justify-center shrink-0">{icon}</div>}
      <div className="min-w-0 flex-1">
        <div className="text-base font-semibold text-heading">{title}</div>
        {description && <div className="text-sm text-muted mt-0.5">{description}</div>}
      </div>
      {trailing && <div className="shrink-0 text-faint">{trailing}</div>}
    </Tag>
  );
}
