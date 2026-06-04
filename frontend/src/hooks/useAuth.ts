/**
 * useAuth — login, register, logout only.
 * Session restore is now handled entirely in _app.tsx (runs once on mount).
 * This hook no longer touches session restore to avoid double-run issues.
 */
import { useCallback, useState } from 'react';
import { useStore } from '@/store/appStore';
import { authApi, tokenStore, ApiError } from '@/lib/api';

export function useAuth() {
  const { user, isAuthenticated, setUser, logout: storeLogout, setPage } = useStore();
  const [authLoading, setAuthLoading] = useState(false);
  const [authError,   setAuthError]   = useState<string | null>(null);

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
        setAuthError(e instanceof ApiError ? e.message : 'Login failed');
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
        // New user → show onboarding before home
        useStore.getState().setHasCompletedOnboarding(false);
        setPage('onboarding' as any);
        return true;
      } catch (e) {
        setAuthError(e instanceof ApiError ? e.message : 'Registration failed');
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
