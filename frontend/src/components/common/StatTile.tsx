import React from 'react';

interface StatTileProps {
  label: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
  toneClassName?: string;
  subtitle?: string;
  onClick?: () => void;
  className?: string;
}

export default function StatTile({
  label,
  value,
  icon,
  toneClassName = 'text-heading',
  subtitle,
  onClick,
  className = '',
}: StatTileProps) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      {...(onClick ? { onClick } : {})}
      className={`bg-card border border-default rounded-2xl p-3 text-center ${onClick ? 'card-hover cursor-pointer' : ''} ${className}`}
    >
      {icon && <div className="text-lg mb-1 flex items-center justify-center">{icon}</div>}
      <div className={`text-xl font-bold ${toneClassName}`}>{value}</div>
      <div className="text-xs text-muted mt-0.5 uppercase tracking-wide">{label}</div>
      {subtitle && <div className="text-[11px] text-faint mt-0.5">{subtitle}</div>}
    </Tag>
  );
}
