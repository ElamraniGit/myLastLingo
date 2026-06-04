/**
 * RegisterPage — Multi-step registration experience.
 *
 * Step 1: What to call you  (display name — optional but friendly)
 * Step 2: Create your account (username + password)
 * Step 3: Pick your level  (self-assessment: Beginner/Intermediate/Advanced)
 *
 * Each step slides in smoothly. Progress bar at top.
 */

import React, { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useStore } from '@/store/appStore';

type Step = 1 | 2 | 3;

const LEVELS = [
  {
    id: 'beginner',
    emoji: '🌱',
    label: 'Beginner',
    sub: 'I know basic words and phrases',
    color: 'border-green-500/40 bg-green-500/8 text-green-400',
  },
  {
    id: 'intermediate',
    emoji: '📈',
    label: 'Intermediate',
    sub: 'I can hold simple conversations',
    color: 'border-blue-500/40 bg-blue-500/8 text-blue-400',
  },
  {
    id: 'advanced',
    emoji: '🎯',
    label: 'Advanced',
    sub: 'I want to refine and expand',
    color: 'border-purple-500/40 bg-purple-500/8 text-purple-400',
  },
];

export default function RegisterPage() {
  const { register, authLoading, authError, clearAuthError } = useAuth();
  const { setPage } = useStore();

  const [step,         setStep]         = useState<Step>(1);
  const [displayName,  setDisplayName]  = useState('');
  const [username,     setUsername]     = useState('');
  const [email,        setEmail]        = useState('');
  const [password,     setPassword]     = useState('');
  const [confirmPwd,   setConfirmPwd]   = useState('');
  const [level,        setLevel]        = useState('');
  const [showPass,     setShowPass]     = useState(false);
  const [errors,       setErrors]       = useState<Record<string, string>>({});
  const [slideDir,     setSlideDir]     = useState<'fwd' | 'back'>('fwd');
  const [visible,      setVisible]      = useState(true);

  const goTo = (s: Step, dir: 'fwd' | 'back' = 'fwd') => {
    setSlideDir(dir);
    setVisible(false);
    setTimeout(() => { setStep(s); setVisible(true); }, 180);
  };

  const pct = Math.round(((step - 1) / 3) * 100);

  // ── Validation ────────────────────────────────────────────────────────────
  const validateStep2 = (): boolean => {
    const e: Record<string, string> = {};
    if (!username.trim()) e.username = 'Username is required';
    else if (username.length < 3) e.username = 'At least 3 characters';
    else if (!/^[a-zA-Z0-9_-]+$/.test(username)) e.username = 'Letters, numbers, _ and - only';
    if (!password) e.password = 'Password is required';
    else if (password.length < 6) e.password = 'At least 6 characters';
    if (password !== confirmPwd) e.confirmPwd = 'Passwords do not match';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleNext1 = () => {
    clearAuthError();
    goTo(2);
  };

  const handleNext2 = () => {
    if (!validateStep2()) return;
    clearAuthError();
    goTo(3);
  };

  const handleFinish = async () => {
    if (!level) { setErrors({ level: 'Please choose your level' }); return; }
    const name = displayName.trim() || username.trim();
    await register(username.trim(), email.trim(), password, name);
  };

  // ── Shared input style ────────────────────────────────────────────────────
  const inp = (hasErr?: boolean) =>
    `w-full bg-card border rounded-2xl px-4 py-3.5 text-sm text-heading placeholder-muted
     focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 transition-all
     ${hasErr ? 'border-red-500/50' : 'border-default'}`;

  return (
    <div className="min-h-screen bg-base flex flex-col">

      {/* Background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 right-0 w-80 h-80 rounded-full bg-purple-600/8 blur-3xl" />
        <div className="absolute bottom-0 left-0 w-80 h-80 rounded-full bg-blue-600/8 blur-3xl" />
      </div>

      {/* Progress bar */}
      <div className="relative h-1 bg-elevated shrink-0">
        <div
          className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-500 rounded-full"
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Header */}
      <div className="relative flex items-center justify-between px-5 pt-4 pb-2 shrink-0">
        {step > 1 ? (
          <button
            onClick={() => goTo((step - 1) as Step, 'back')}
            className="w-9 h-9 rounded-xl hover:bg-card text-muted hover:text-body flex items-center justify-center transition-colors"
            aria-label="Back"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" className="w-4 h-4">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
          </button>
        ) : (
          <div className="w-9" />
        )}

        {/* Step indicators */}
        <div className="flex items-center gap-1.5">
          {([1, 2, 3] as Step[]).map(s => (
            <div
              key={s}
              className={`rounded-full transition-all duration-300 ${
                s === step ? 'w-5 h-2 bg-blue-500' :
                s < step   ? 'w-2 h-2 bg-blue-400/50' :
                             'w-2 h-2 bg-elevated'
              }`}
            />
          ))}
        </div>

        <button
          onClick={() => setPage('login')}
          className="text-xs text-muted hover:text-body px-2 py-1 rounded-lg hover:bg-card transition-colors"
        >
          Sign in
        </button>
      </div>

      {/* Content */}
      <div className="relative flex-1 flex flex-col justify-center px-5 py-4">
        <div
          className={`w-full max-w-sm mx-auto transition-all duration-180 ${
            visible
              ? 'opacity-100 translate-x-0'
              : slideDir === 'fwd'
              ? 'opacity-0 translate-x-6'
              : 'opacity-0 -translate-x-6'
          }`}
        >

          {/* ── STEP 1 — Name ───────────────────────────────────── */}
          {step === 1 && (
            <div className="space-y-6">
              <div className="text-center">
                <div className="text-5xl mb-4">👋</div>
                <h1 className="text-2xl font-bold text-heading">What should we call you?</h1>
                <p className="text-sm text-muted mt-2">Choose a name — you can change it later</p>
              </div>

              <div className="space-y-3">
                <input
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleNext1()}
                  placeholder="Your name or nickname"
                  autoFocus
                  autoComplete="name"
                  className={inp()}
                />
                <p className="text-xs text-faint text-center">Optional — leave blank to use your username</p>
              </div>

              <button
                onClick={handleNext1}
                className="w-full h-12 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm
                           active:scale-[0.97] transition-all shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2"
              >
                {displayName.trim() ? `Nice to meet you, ${displayName.split(' ')[0]}! →` : 'Continue →'}
              </button>

              <p className="text-center text-xs text-faint">
                Already have an account?{' '}
                <button onClick={() => setPage('login')} className="text-blue-500 hover:text-blue-400 font-medium">
                  Sign in
                </button>
              </p>
            </div>
          )}

          {/* ── STEP 2 — Account ────────────────────────────────── */}
          {step === 2 && (
            <div className="space-y-5">
              <div className="text-center">
                <div className="text-5xl mb-4">🔐</div>
                <h1 className="text-2xl font-bold text-heading">Create your account</h1>
                <p className="text-sm text-muted mt-2">
                  {displayName ? `Hi ${displayName.split(' ')[0]}!` : 'Almost there!'} Set up your login.
                </p>
              </div>

              {authError && (
                <div className="bg-red-500/8 border border-red-500/20 text-red-400 text-sm rounded-2xl px-4 py-3 flex items-start gap-2">
                  <span>⚠️</span>
                  <span className="flex-1">{authError}</span>
                  <button onClick={clearAuthError} className="text-red-400/60 hover:text-red-400 text-lg leading-none">×</button>
                </div>
              )}

              <div className="space-y-3">
                <div>
                  <input
                    value={username}
                    onChange={e => { setUsername(e.target.value); if (errors.username) setErrors(p => ({...p, username: ''})); }}
                    placeholder="Username (letters, numbers, _ -)"
                    autoCapitalize="none"
                    autoFocus
                    className={inp(!!errors.username)}
                  />
                  {errors.username && <p className="text-xs text-red-400 mt-1 ml-1">{errors.username}</p>}
                </div>

                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="Email (optional)"
                  className={inp()}
                />

                <div>
                  <div className="relative">
                    <input
                      type={showPass ? 'text' : 'password'}
                      value={password}
                      onChange={e => { setPassword(e.target.value); if (errors.password) setErrors(p => ({...p, password: ''})); }}
                      placeholder="Password (min 6 characters)"
                      className={inp(!!errors.password) + ' pr-12'}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass(v => !v)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-muted hover:text-body text-sm"
                    >
                      {showPass ? '🙈' : '👁️'}
                    </button>
                  </div>
                  {errors.password && <p className="text-xs text-red-400 mt-1 ml-1">{errors.password}</p>}
                </div>

                <div>
                  <input
                    type="password"
                    value={confirmPwd}
                    onChange={e => { setConfirmPwd(e.target.value); if (errors.confirmPwd) setErrors(p => ({...p, confirmPwd: ''})); }}
                    onKeyDown={e => e.key === 'Enter' && handleNext2()}
                    placeholder="Confirm password"
                    className={inp(!!errors.confirmPwd)}
                  />
                  {errors.confirmPwd && <p className="text-xs text-red-400 mt-1 ml-1">{errors.confirmPwd}</p>}
                </div>
              </div>

              <button
                onClick={handleNext2}
                className="w-full h-12 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm
                           active:scale-[0.97] transition-all shadow-lg shadow-blue-600/20"
              >
                Continue →
              </button>
            </div>
          )}

          {/* ── STEP 3 — Level ──────────────────────────────────── */}
          {step === 3 && (
            <div className="space-y-6">
              <div className="text-center">
                <div className="text-5xl mb-4">🎯</div>
                <h1 className="text-2xl font-bold text-heading">What's your English level?</h1>
                <p className="text-sm text-muted mt-2">This helps us personalise your experience</p>
              </div>

              <div className="space-y-2.5">
                {LEVELS.map(l => (
                  <button
                    key={l.id}
                    onClick={() => { setLevel(l.id); setErrors(p => ({...p, level: ''})); }}
                    className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-all active:scale-[0.98] text-left ${
                      level === l.id
                        ? l.color + ' shadow-sm'
                        : 'border-default bg-card hover:border-blue-500/30 hover:bg-blue-500/5 text-body'
                    }`}
                  >
                    <span className="text-2xl shrink-0">{l.emoji}</span>
                    <div className="flex-1">
                      <div className={`font-semibold text-sm ${level === l.id ? '' : 'text-heading'}`}>
                        {l.label}
                      </div>
                      <div className={`text-xs mt-0.5 ${level === l.id ? 'opacity-80' : 'text-muted'}`}>
                        {l.sub}
                      </div>
                    </div>
                    {level === l.id && (
                      <div className="w-5 h-5 rounded-full bg-current/20 flex items-center justify-center shrink-0">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="w-3 h-3">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                      </div>
                    )}
                  </button>
                ))}
                {errors.level && <p className="text-xs text-red-400 ml-1">{errors.level}</p>}
              </div>

              <button
                onClick={handleFinish}
                disabled={authLoading || !level}
                className="w-full h-12 rounded-2xl bg-gradient-to-r from-blue-600 to-purple-600
                           hover:from-blue-500 hover:to-purple-500 text-white font-semibold text-sm
                           active:scale-[0.97] transition-all shadow-lg shadow-blue-600/20
                           disabled:opacity-50 disabled:cursor-not-allowed
                           flex items-center justify-center gap-2"
              >
                {authLoading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>
                    Creating account…
                  </>
                ) : (
                  '🚀 Start Learning!'
                )}
              </button>

              <p className="text-center text-xs text-faint">
                🔒 All your data stays on your device
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
