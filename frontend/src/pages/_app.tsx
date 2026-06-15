/**
 * LinguaLearn — App root.
 * Single-page app shell. All routing handled by Zustand store.
 */

import '@/styles/globals.css';
import React, { useEffect, useRef, useState } from 'react';
import type { AppProps } from 'next/app';
import Head from 'next/head';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/router';
import { useStore } from '@/store/appStore';
import { authApi, tokenStore } from '@/lib/api';
import Layout from '@/components/common/Layout';
import InstallPrompt from '@/components/common/InstallPrompt';
import OfflineBanner from '@/components/common/OfflineBanner';
import NotificationCenter from '@/components/common/NotificationCenter';
import { useNotifications } from '@/hooks/useNotifications';
import { useDictionary } from '@/hooks/useDictionary';
import { AppLogo } from '@/components/ui/Icons';
import { warmUpTTS } from '@/lib/tts';

function NotificationsBootstrap() {
  useNotifications();
  return null;
}

/**
 * ShareTargetHandler — when text is shared into the PWA (Web Share Target) or
 * the URL carries ?share=/?text=/?page=, act on it once after the app mounts.
 * Shared text opens the dictionary popup for the relevant word; ?page= just
 * navigates. The query is then stripped so a refresh doesn't repeat it.
 */
function ShareTargetHandler() {
  const { lookupWord } = useDictionary();
  const setPage = useStore(s => s.setPage);
  const didHandle = useRef(false);

  useEffect(() => {
    if (didHandle.current || typeof window === 'undefined') return;
    didHandle.current = true;

    const params = new URLSearchParams(window.location.search);
    const page   = params.get('page');
    let shared   = (params.get('share') || params.get('text') || params.get('share_title') || '').trim();

    if (!page && !shared) return;

    // Clean the URL so refresh/back doesn't re-trigger the share.
    try { window.history.replaceState(null, '', window.location.pathname); } catch {}

    if (page) { setPage(page as any); return; }

    // Some apps share "word - source" or a URL tail; keep the meaningful part.
    shared = shared.replace(/https?:\/\/\S+/g, ' ').trim();
    const words = shared.split(/\s+/).filter(Boolean);
    if (words.length === 0) return;

    // Pick the best single word to look up: for a short selection use it as-is
    // (supports phrasal verbs / short phrases); for longer text pick the longest
    // alphabetic word (most likely the term the user cares about).
    let target = shared;
    if (words.length > 3) {
      target = words
        .map(w => w.replace(/[^A-Za-z'-]/g, ''))
        .filter(w => w.length >= 3)
        .sort((a, b) => b.length - a.length)[0] || words[0];
    }

    // Small delay lets the popup mount cleanly after first render.
    setTimeout(() => { lookupWord(target).catch(() => {}); }, 500);
  }, [lookupWord, setPage]);

  return null;
}

function PageLoader() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="surface-panel px-5 py-4 flex items-center gap-3 animate-fade-in">
        <AppLogo size={28} />
        <div>
          <p className="text-sm font-semibold text-heading">Loading</p>
          <p className="text-xs text-muted">Preparing your workspace…</p>
        </div>
      </div>
    </div>
  );
}

const LoginPage = dynamic(() => import('@/components/auth/LoginPage'), { loading: () => <PageLoader /> });
const RegisterPage = dynamic(() => import('@/components/auth/RegisterPage'), { loading: () => <PageLoader /> });
const PlayerView = dynamic(() => import('@/views/PlayerView'), { loading: () => <PageLoader /> });
const VocabularyView = dynamic(() => import('@/views/VocabularyView'), { loading: () => <PageLoader /> });
const ReviewView = dynamic(() => import('@/views/ReviewView'), { loading: () => <PageLoader /> });
const ProfileView = dynamic(() => import('@/views/ProfileView'), { loading: () => <PageLoader /> });
const LibraryView = dynamic(() => import('@/views/LibraryView'), { loading: () => <PageLoader /> });
const ChatView = dynamic(() => import('@/views/ChatView'), { loading: () => <PageLoader /> });
const TextReaderView = dynamic(() => import('@/views/TextReaderView'), { loading: () => <PageLoader /> });
const StatsView = dynamic(() => import('@/views/StatsView'), { loading: () => <PageLoader /> });
const OnboardingView = dynamic(() => import('@/views/OnboardingView'), { loading: () => <PageLoader /> });
const WordDetailView = dynamic(() => import('@/views/WordDetailView'), { loading: () => <PageLoader /> });
const CoreLibraryView = dynamic(() => import('@/views/CoreLibraryView'), { loading: () => <PageLoader /> });
const WordPopup = dynamic(() => import('@/components/dictionary/WordPopup'), { ssr: false });

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();

  // Read store values — but split them so theme change doesn't remount everything
  const currentPage             = useStore(s => s.currentPage);
  const isAuthenticated         = useStore(s => s.isAuthenticated);
  const hasCompletedOnboarding  = useStore(s => s.hasCompletedOnboarding);
  const theme                   = useStore(s => s.theme);
  const setUser        = useStore(s => s.setUser);
  const setPage        = useStore(s => s.setPage);
  const goBack         = useStore(s => s.goBack);
  const pageHistory    = useStore(s => s.pageHistory);

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
      // updateViaCache:'none' → the browser always revalidates /sw.js itself,
      // so a new service worker version is picked up promptly.
      navigator.serviceWorker
        .register('/sw.js', { updateViaCache: 'none' })
        .catch(() => {});

      // When a new SW takes control (after old tabs close), reload once so the
      // freshly cached app code is used. Guarded flag prevents reload loops.
      let reloaded = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (reloaded) return;
        reloaded = true;
        window.location.reload();
      });
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
        // Pre-warm neural TTS so first word plays instantly
        warmUpTTS().catch(() => {});
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


  // ── 5. Android hardware back button ─────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handlePopState = (e: PopStateEvent) => {
      e.preventDefault();

      const hist = useStore.getState().pageHistory;

      if (hist.length > 0) {
        // Go back in our internal navigation stack
        useStore.getState().goBack();
        // Keep the browser history entry so next back press fires again
        window.history.pushState(null, '', window.location.href);
      } else {
        // No more pages — ask user if they want to exit
        if (window.confirm('Exit LinguaLearn?')) {
          // On Termux/Android WebView, close the tab or go to blank
          window.history.back();
        } else {
          // Stay — push a new history entry so back button fires again
          window.history.pushState(null, '', window.location.href);
        }
      }
    };

    // Push an initial entry so popstate fires on first back press
    window.history.pushState(null, '', window.location.href);
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []); // eslint-disable-line

  // ── Non-root pages (e.g. /404) ───────────────────────────────────
  if (router.pathname !== '/') return <Component {...pageProps} />;

  // ── Loading spinner (waiting for Zustand rehydration) ────────────
  if (!hydrated) return (
    <div className="min-h-screen bg-base flex items-center justify-center px-5">
      <div className="surface-panel w-full max-w-xs px-5 py-6 text-center animate-scale-in">
        <div className="flex items-center justify-center mb-4">
          <AppLogo size={46} />
        </div>
        <p className="text-base font-semibold text-heading">LinguaLearn</p>
        <p className="text-sm text-muted mt-1">Restoring your session…</p>
        <div className="mt-4 h-1.5 bg-elevated rounded-full overflow-hidden">
          <div className="h-full bg-accent rounded-full animate-pulse-soft" style={{ width: '55%' }} />
        </div>
      </div>
    </div>
  );

  // ── Auth screens ─────────────────────────────────────────────────
  if (!isAuthenticated) {
    if (currentPage === 'register') return <RegisterPage />;
    return <LoginPage />;
  }

  // Onboarding shows ONLY when explicitly routed there (right after register, or
  // after a login by a user who hasn't completed it). It is never shown on a plain
  // app launch / session restore — see useAuth.login / register.
  if (currentPage === ('onboarding' as any)) {
    return <OnboardingView />;
  }

  // ── App ──────────────────────────────────────────────────────────
  const Page = () => {
    switch (currentPage) {
      case 'player':
      case 'home':       return <PlayerView />;
      case 'library':    return <LibraryView />;
      case 'vocabulary': return <VocabularyView />;
      case 'flashcards': return <ReviewView />;
      case 'chat':       return <ChatView />;
      case 'textreader': return <TextReaderView />;
      case 'stats':      return <StatsView />;
      case 'games':      return <ReviewView />;
      case 'worddetail': return <WordDetailView />;
      case 'core':       return <CoreLibraryView />;
      case 'profile':
      case 'settings':   return <ProfileView tab="profile" />;
      case 'onboarding' as any: return <OnboardingView />;
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
        <NotificationsBootstrap />
        <ShareTargetHandler />
        <NotificationCenter />
        <OfflineBanner />
        <InstallPrompt />
        <Page />
      </Layout>
      {/* WordPopup renders outside Layout to escape overflow:hidden constraints */}
      <WordPopup />
    </>
  );
}
