import React from 'react';
import type { CEFRLevel } from '@/types';

const levelStyles: Record<CEFRLevel, string> = {
  A1: 'bg-green-500/15 text-green-400 border-green-500/30',
  A2: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  B1: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  B2: 'bg-violet-500/15 text-violet-400 border-violet-500/30',
  C1: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
  C2: 'bg-red-500/15 text-red-400 border-red-500/30',
};

export function LevelBadge({ level }: { level: CEFRLevel | string }) {
  const style = levelStyles[level as CEFRLevel] ?? 'bg-elevated text-body border-line';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold border ${style}`}>
      {level}
    </span>
  );
}

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger';
  className?: string;
}

const badgeVariants = {
  default:  'bg-elevated/50 text-body',
  primary:  'bg-blue-500/15 text-blue-400 border border-blue-500/30',
  success:  'bg-green-500/15 text-green-400 border border-green-500/30',
  warning:  'bg-yellow-500/15 text-yellow-400 border border-yellow-500/30',
  danger:   'bg-red-500/15 text-red-400 border border-red-500/30',
};

export function Badge({ children, variant = 'default', className = '' }: BadgeProps) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${badgeVariants[variant]} ${className}`}>
      {children}
    </span>
  );
}
