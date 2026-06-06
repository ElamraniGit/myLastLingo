import React, { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useStore } from '@/store/appStore';


export default function LoginPage() {
  const { login, authLoading, authError, clearAuthError } = useAuth();
  const { setPage } = useStore();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember]   = useState(false);
  const [showPass, setShowPass]   = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await login(username.trim(), password, remember);
  };

  return (
    <div className="min-h-screen bg-base flex flex-col items-center justify-center px-5 py-12">

      {/* Subtle gradient background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-blue-500/5 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-purple-500/4 blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm">

        {/* Logo */}
        <div className="flex flex-col items-center mb-10">
          <div className="w-16 h-16 rounded-2xl bg-blue-600 text-white text-2xl font-bold flex items-center justify-center shadow-lg shadow-blue-600/25 mb-5 select-none">
            L
          </div>
          <h1 className="text-2xl font-bold text-heading tracking-tight">Welcome back</h1>
          <p className="text-sm text-muted mt-1">Sign in to continue learning</p>
        </div>

        {/* Error */}
        {authError && (
          <div className="mb-4 flex items-start gap-3 bg-red-500/8 border border-red-500/20 text-red-400 text-sm rounded-2xl px-4 py-3.5">
            <svg className="w-4 h-4 mt-0.5 shrink-0 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17" strokeWidth="2.5"/></svg>
            <span className="flex-1">{authError}</span>
            <button onClick={clearAuthError} className="text-red-400/60 hover:text-red-400 text-lg leading-none">×</button>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-muted mb-1.5 ml-1">Username</label>
            <input
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="your username"
              autoComplete="username"
              autoCapitalize="none"
              required
              className="input-field"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-muted mb-1.5 ml-1">Password</label>
            <div className="relative">
              <input
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                required
                className="input-field pr-12"
              />
              <button
                type="button"
                onClick={() => setShowPass(v => !v)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted hover:text-body transition-colors text-sm"
              >
                {showPass ? (<svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>) : (<svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>)}
              </button>
            </div>
          </div>

          {/* Remember */}
          <label className="flex items-center gap-2.5 cursor-pointer py-1">
            <input
              type="checkbox"
              checked={remember}
              onChange={e => setRemember(e.target.checked)}
              className="w-4 h-4 rounded border-default accent-blue-500"
            />
            <span className="text-sm text-body">Remember me for 30 days</span>
          </label>

          <button
            type="submit"
            disabled={authLoading}
            className="btn-primary w-full mt-2"
          >
            {authLoading ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Signing in…
              </span>
            ) : 'Sign In'}
          </button>
        </form>

        {/* Divider */}
        <div className="flex items-center gap-3 my-6">
          <div className="flex-1 h-px bg-border-subtle" />
          <span className="text-xs text-faint">or</span>
          <div className="flex-1 h-px bg-border-subtle" />
        </div>

        {/* Register link */}
        <p className="text-center text-sm text-body">
          Don&apos;t have an account?{' '}
          <button
            onClick={() => setPage('register')}
            className="text-blue-500 hover:text-blue-400 font-semibold transition-colors"
          >
            Create one
          </button>
        </p>

        {/* Footer */}
        <p className="text-center text-xs text-faint mt-8">
          <span className="flex items-center justify-center gap-1.5"><svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>100% local · No cloud · Works offline</span>
        </p>
      </div>
    </div>
  );
}
