/**
 * Login page — clean English UI with local auth.
 */

import React, { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useStore } from '@/store/appStore';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export default function LoginPage() {
  const { login, authLoading, authError, clearAuthError } = useAuth();
  const { setPage } = useStore();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [showPass, setShowPass] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await login(username.trim(), password, remember);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-base px-4 py-12">
      {/* Background gradient blobs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-sm relative">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl mx-auto mb-4 flex items-center justify-center shadow-xl shadow-blue-500/20">
            <span className="text-heading text-2xl font-black">L</span>
          </div>
          <h1 className="text-2xl font-bold text-heading">Welcome back</h1>
          <p className="text-body text-sm mt-1">Sign in to continue learning</p>
        </div>

        {/* Card */}
        <div className="bg-card/60 backdrop-blur-xl border border-line/50 rounded-2xl p-6 shadow-2xl">
          {authError && (
            <div className="mb-4 px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center justify-between">
              <p className="text-sm text-red-400">{authError}</p>
              <button onClick={clearAuthError} className="text-red-400 hover:text-red-300 ml-2">×</button>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Username or Email"
              type="text"
              placeholder="Enter your username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              autoCapitalize="none"
              required
            />

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-body">Password</label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                  className="w-full bg-card border border-line rounded-xl px-4 py-3 pr-12 text-heading placeholder-muted focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-body transition-colors"
                >
                  {showPass ? '🙈' : '👁'}
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="remember"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="w-4 h-4 rounded border-line accent-blue-500"
              />
              <label htmlFor="remember" className="text-sm text-body cursor-pointer">
                Remember me for 30 days
              </label>
            </div>

            <Button type="submit" variant="primary" loading={authLoading} className="w-full mt-2">
              Sign In
            </Button>
          </form>

          <div className="mt-6 pt-5 border-t border-line/50 text-center">
            <p className="text-sm text-body">
              Don't have an account?{' '}
              <button
                onClick={() => setPage('register')}
                className="text-blue-400 hover:text-blue-300 font-medium transition-colors"
              >
                Create one
              </button>
            </p>
          </div>
        </div>

        {/* Footer note */}
        <p className="text-center text-xs text-faint mt-6">
          100% local • No cloud • Works offline
        </p>
      </div>
    </div>
  );
}
