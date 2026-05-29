import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  glass?: boolean;
}

export function Card({ children, className = '', glass = true }: CardProps) {
  const base = glass
    ? 'bg-card/60 backdrop-blur-xl border border-line/50 shadow-xl'
    : 'bg-card border border-line';
  return (
    <div className={`rounded-2xl ${base} ${className}`}>{children}</div>
  );
}
