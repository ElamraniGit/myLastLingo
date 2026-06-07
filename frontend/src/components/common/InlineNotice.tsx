import React from 'react';

type Tone = 'info' | 'success' | 'warning' | 'danger';

interface InlineNoticeProps {
  tone?: Tone;
  children: React.ReactNode;
  className?: string;
}

const TONES: Record<Tone, string> = {
  info: 'bg-blue-500/10 border-blue-500/20 text-blue-500',
  success: 'bg-green-500/10 border-green-500/20 text-green-500',
  warning: 'bg-amber-500/10 border-amber-500/20 text-amber-500',
  danger: 'bg-red-500/10 border-red-500/20 text-red-400',
};

export default function InlineNotice({ tone = 'info', children, className = '' }: InlineNoticeProps) {
  return (
    <div className={`text-xs font-medium rounded-xl border px-3 py-2 ${TONES[tone]} ${className}`}>
      {children}
    </div>
  );
}
