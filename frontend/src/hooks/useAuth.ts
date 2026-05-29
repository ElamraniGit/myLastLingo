/**
 * Authentication hook — handles login, register, logout, session restore.
 */

import { useCallback, useEffect, useState } from 'react';
import { useStore } from '@/store/appStore';
import { authApi, tokenStore, ApiError } from '@/lib/api';

export function useAuth() {
  const { user, isAuthenticated, setUser, logout: storeLogout, setPage } = useStore();
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Restore session on mount (runs once)
  useEffect(() => {
    const token = tokenStore.get();
    if (!token || isAuthenticated) return;

    let cancelled = false;
    authApi.me()
      .then((u) => {
        if (cancelled) return;
        setUser(u);
        // Only navigate to player if currently on login/register
        const page = useStore.getState().currentPage;
        if (page === 'login' || page === 'register') {
          setPage('player');
        }
      })
      .catch(() => {
        if (!cancelled) tokenStore.clear();
      });
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
