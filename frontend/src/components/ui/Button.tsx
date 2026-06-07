import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  loading?: boolean;
  children: React.ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  children,
  className = '',
  disabled,
  ...props
}: ButtonProps) {
  const base =
    'inline-flex items-center justify-center gap-2 font-semibold rounded-2xl transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed select-none';

  const variants = {
    primary:   'bg-blue-600 text-white hover:bg-blue-500 shadow-lg shadow-blue-500/25',
    secondary: 'bg-card text-heading hover:bg-elevated border border-default shadow-sm',
    ghost:     'text-body hover:text-heading hover:bg-elevated/60',
    danger:    'bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20',
    outline:   'border border-default text-body hover:bg-elevated/60 hover:border-default',
  };

  const sizes = {
    sm:   'px-3 py-1.5 text-xs',
    md:   'px-4 py-2.5 text-sm',
    lg:   'px-6 py-3 text-base',
    icon: 'p-2.5',
  };

  return (
    <button
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin flex-shrink-0" />
      )}
      {children}
    </button>
  );
}
