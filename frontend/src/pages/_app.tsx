/**
 * LinguaLearn — App root.
 * Single-page app shell. All routing handled by Zustand store.
 */

import '@/styles/globals.css';
import React, { useEffect, useRef, useState } from 'react';
import type { AppProps } from 'next/app';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useStore } from '@/store/appStore';
import { authApi, tokenStore } from '@/lib/api';
import Layout from '@/components/common/Layout';
import InstallPrompt from '@/components/common/InstallPrompt';
import OfflineBanner from '@/components/common/OfflineBanner';
import LoginPage from '@/components/auth/LoginPage';
import RegisterPage from '@/components/auth/RegisterPage';
import PlayerView from '@/views/PlayerView';
import VocabularyView from '@/views/VocabularyView';
import FlashcardsView from '@/views/FlashcardsView';
import ProfileView from '@/views/ProfileView';
import LibraryView from '@/views/LibraryView';
import ChatView from '@/views/ChatView';
import TextReaderView from '@/views/TextReaderView';
import StatsView from '@/views/StatsView';

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();

  // Read store values — but split them so theme change doesn't remount everything
  const currentPage    = useStore(s => s.currentPage);
  const isAuthenticated = useStore(s => s.isAuthenticated);
  const theme          = useStore(s => s.theme);
  const setUser        = useStore(s => s.setUser);
  const setPage        = useStore(s => s.setPage);

  // hydrated = Zustand has rehydrated from localStorage
  const [hydrated, setHydrated] = useState(false);

  // Session restore — runs ONCE on mount, never again
  const didRestoreRef = useRef(false);

  // ── 1. Apply theme class ─────────────────────────────────────────
  useEffect(() => {
    const el = document.documentElement;
    el.classList.remove('dark', 'light');
    if (theme === 'dark')       el.classList.add('dark');
    else if (theme === 'light') el.classList.add('light');
  }, [theme]);

  // ── 2. Register SW + mark hydrated ───────────────────────────────
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
    // Give Zustand one tick to rehydrate from localStorage before rendering
    const raf = requestAnimationFrame(() => setHydrated(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  // ── 3. Session restore — exactly once ────────────────────────────
  useEffect(() => {
    if (didRestoreRef.current) return;
    didRestoreRef.current = true;

    // If store already has a user (rehydrated from localStorage), skip API call
    if (useStore.getState().isAuthenticated) return;

    const token = tokenStore.get();
    if (!token) return;

    let cancelled = false;
    authApi.me()
      .then(u => {
        if (cancelled) return;
        setUser(u);
        const page = useStore.getState().currentPage;
        if (page === 'login' || page === 'register') setPage('player');
      })
      .catch(() => {
        if (!cancelled) tokenStore.clear();
      });

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── 4. Listen for 401 → logout ───────────────────────────────────
  useEffect(() => {
    const onUnauth = () => {
      const s = useStore.getState();
      if (!s.isAuthenticated) return;
      s.logout();
      setPage('login');
    };
    window.addEventListener('ll:unauthorized', onUnauth);
    return () => window.removeEventListener('ll:unauthorized', onUnauth);
  }, [setPage]);

  // ── Non-root pages (e.g. /404) ───────────────────────────────────
  if (router.pathname !== '/') return <Component {...pageProps} />;

  // ── Loading spinner (waiting for Zustand rehydration) ────────────
  if (!hydrated) return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100vh', backgroundColor: '#000',
    }}>
      <div style={{
        width: 52, height: 52, borderRadius: 14, backgroundColor: '#2563eb',
        color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 26, fontWeight: 800,
      }}>L</div>
    </div>
  );

  // ── Auth screens ─────────────────────────────────────────────────
  if (!isAuthenticated) {
    if (currentPage === 'register') return <RegisterPage />;
    return <LoginPage />;
  }

  // ── App ──────────────────────────────────────────────────────────
  const Page = () => {
    switch (currentPage) {
      case 'player':
      case 'home':       return <PlayerView />;
      case 'library':    return <LibraryView />;
      case 'vocabulary': return <VocabularyView />;
      case 'flashcards': return <FlashcardsView />;
      case 'chat':       return <ChatView />;
      case 'textreader': return <TextReaderView />;
      case 'profile':
      case 'settings':
      case 'stats':      return <StatsView />;
      default:           return <PlayerView />;
    }
  };

  return (
    <>
      <Head>
        <title>LinguaLearn — English Learning</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </Head>
      <Layout>
        <OfflineBanner />
        <InstallPrompt />
        <Page />
      </Layout>
    </>
  );
}
