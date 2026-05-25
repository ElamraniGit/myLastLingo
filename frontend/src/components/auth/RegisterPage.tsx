/**
 * Registration page.
 */

import React, { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useStore } from '@/store/appStore';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export default function RegisterPage() {
  const { register, authLoading, authError, clearAuthError } = useAuth();
  const { setPage } = useStore();

  const [form, setForm] = useState({
    username: '', email: '', password: '', displayName: '', confirmPassword: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showPass, setShowPass] = useState(false);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.username.trim()) e.username = 'Username is required';
    else if (form.username.length < 3) e.username = 'At least 3 characters';
    if (!form.password) e.password = 'Password is required';
    else if (form.password.length < 6) e.password = 'At least 6 characters';
    if (form.password !== form.confirmPassword) e.confirmPassword = 'Passwords do not match';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    await register(form.username.trim(), form.email.trim(), form.password, form.displayName.trim());
  };

  const update = (k: string, v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    if (errors[k]) setErrors((prev) => { const n = { ...prev }; delete n[k]; return n; });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4 py-12">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-sm relative">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl mx-auto mb-4 flex items-center justify-center shadow-xl shadow-blue-500/20">
            <span className="text-white text-2xl font-black">L</span>
          </div>
          <h1 className="text-2xl font-bold text-white">Create Account</h1>
          <p className="text-slate-400 text-sm mt-1">Start your learning journey today</p>
        </div>

        <div className="bg-slate-800/60 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6 shadow-2xl">
          {authError && (
            <div className="mb-4 px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center justify-between">
              <p className="text-sm text-red-400">{authError}</p>
              <button onClick={clearAuthError} className="text-red-400 ml-2">×</button>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Display Name"
              placeholder="How should we call you?"
              value={form.displayName}
              onChange={(e) => update('displayName', e.target.value)}
            />

            <Input
              label="Username *"
              placeholder="letters, numbers, hyphens"
              value={form.username}
              onChange={(e) => update('username', e.target.value)}
              error={errors.username}
              autoCapitalize="none"
              required
            />

            <Input
              label="Email (optional)"
              type="email"
              placeholder="your@email.com"
              value={form.email}
              onChange={(e) => update('email', e.target.value)}
              error={errors.email}
            />

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-300">Password *</label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  placeholder="Min 6 characters"
                  value={form.password}
                  onChange={(e) => update('password', e.target.value)}
                  required
                  className={`w-full bg-slate-800 border rounded-xl px-4 py-3 pr-12 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all ${errors.password ? 'border-red-500/60' : 'border-slate-600'}`}
                />
                <button type="button" onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                  {showPass ? '🙈' : '👁'}
                </button>
              </div>
              {errors.password && <p className="text-xs text-red-400">{errors.password}</p>}
            </div>

            <Input
              label="Confirm Password *"
              type="password"
              placeholder="Repeat your password"
              value={form.confirmPassword}
              onChange={(e) => update('confirmPassword', e.target.value)}
              error={errors.confirmPassword}
              required
            />

            <Button type="submit" variant="primary" loading={authLoading} className="w-full mt-2">
              Create Account
            </Button>
          </form>

          <div className="mt-6 pt-5 border-t border-slate-700/50 text-center">
            <p className="text-sm text-slate-400">
              Already have an account?{' '}
              <button onClick={() => setPage('login')} className="text-blue-400 hover:text-blue-300 font-medium">
                Sign in
              </button>
            </p>
          </div>
        </div>

        <p className="text-center text-xs text-slate-600 mt-6">
          All data stays on your device — no cloud required
        </p>
      </div>
    </div>
  );
}
