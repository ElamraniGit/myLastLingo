import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  glass?: boolean;
}

export function Card({ children, className = '', glass = true }: CardProps) {
  const base = glass
    ? 'bg-slate-800/60 backdrop-blur-xl border border-slate-700/50 shadow-xl'
    : 'bg-slate-800 border border-slate-700';
  return (
    <div className={`rounded-2xl ${base} ${className}`}>{children}</div>
  );
}
