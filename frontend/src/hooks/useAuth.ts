/**
 * Authentication hook — handles login, register, logout, session restore.
 *
 * FIX: Session restore effect now uses a ref to prevent running twice
 *      in React StrictMode (double-invoke in dev) and avoids the loop
 *      where setUser() → store update → component re-render → effect re-runs.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useStore } from '@/store/appStore';
import { authApi, tokenStore, ApiError } from '@/lib/api';

export function useAuth() {
  const { user, isAuthenticated, setUser, logout: storeLogout, setPage } = useStore();
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError]     = useState<string | null>(null);

  // FIX: Use a ref to guarantee the restore runs EXACTLY ONCE,
  // even if the component mounts/unmounts in React StrictMode.
  const didRestoreRef = useRef(false);

  // Restore session on mount
  useEffect(() => {
    // Already authenticated (store rehydrated from localStorage) — nothing to do
    if (isAuthenticated) return;

    // Guard against double-invoke in React 18 StrictMode
    if (didRestoreRef.current) return;
    didRestoreRef.current = true;

    const token = tokenStore.get();
    if (!token) return; // No token → stay on login page

    let cancelled = false;
    authApi.me()
      .then((u) => {
        if (cancelled) return;
        setUser(u);
        // Only redirect if currently on an auth page
        const page = useStore.getState().currentPage;
        if (page === 'login' || page === 'register') {
          setPage('player');
        }
      })
      .catch(() => {
        if (!cancelled) {
          // Token invalid/expired — clear it
          tokenStore.clear();
        }
      });

    return () => { cancelled = true; };
  // FIX: intentionally empty deps — we only want this to run once on mount.
  // isAuthenticated is read via the ref guard instead.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Listen for centrally-detected 401 (expired token) → auto logout
  useEffect(() => {
    const onUnauthorized = () => {
      if (!useStore.getState().isAuthenticated) return;
      storeLogout();
      setAuthError('Your session expired. Please log in again.');
      setPage('login');
    };
    window.addEventListener('ll:unauthorized', onUnauthorized);
    return () => window.removeEventListener('ll:unauthorized', onUnauthorized);
  }, [storeLogout, setPage]);

  const login = useCallback(
    async (username: string, password: string, remember = false) => {
      setAuthLoading(true);
      setAuthError(null);
      try {
        const res = await authApi.login(username, password, remember);
        tokenStore.set(res.token);
        setUser(res.user);
        setPage('player');
        return true;
      } catch (e) {
        const msg = e instanceof ApiError ? e.message : 'Login failed';
        setAuthError(msg);
        return false;
      } finally {
        setAuthLoading(false);
      }
    },
    [setUser, setPage]
  );

  const register = useCallback(
    async (username: string, email: string, password: string, displayName?: string) => {
      setAuthLoading(true);
      setAuthError(null);
      try {
        const res = await authApi.register(username, email, password, displayName);
        tokenStore.set(res.token);
        setUser(res.user);
        setPage('player');
        return true;
      } catch (e) {
        const msg = e instanceof ApiError ? e.message : 'Registration failed';
        setAuthError(msg);
        return false;
      } finally {
        setAuthLoading(false);
      }
    },
    [setUser, setPage]
  );

  const logout = useCallback(async () => {
    try { await authApi.logout(); } catch {}
    storeLogout();
  }, [storeLogout]);

  const clearAuthError = useCallback(() => setAuthError(null), []);

  return { user, isAuthenticated, authLoading, authError, login, register, logout, clearAuthError };
}
