/**
 * LinguaLearn v2 — App root.
 * Handles auth routing, theme, page switching.
 */

import '@/styles/globals.css';
import React, { useEffect, useState } from 'react';
import type { AppProps } from 'next/app';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useStore } from '@/store/appStore';
import Layout from '@/components/common/Layout';
import LoginPage from '@/components/auth/LoginPage';
import RegisterPage from '@/components/auth/RegisterPage';

// Views (not Next.js pages — rendered via store.currentPage)
import PlayerView from '@/views/PlayerView';
import VocabularyView from '@/views/VocabularyView';
import FlashcardsView from '@/views/FlashcardsView';
import StatsView from '@/views/StatsView';
import SettingsView from '@/views/SettingsView';
import ProfileView from '@/views/ProfileView';
import LibraryView from '@/views/LibraryView';

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();
  const { currentPage, isAuthenticated, theme } = useStore();
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
    setHydrated(true);
  }, []);

  // Allow regular Next.js pages like /404 to render normally.
  if (router.pathname !== '/') {
    return <Component {...pageProps} />;
  }

  if (!hydrated) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-xl">
            <span className="text-white text-xl font-black">L</span>
          </div>
          <div className="w-6 h-6 border-2 border-slate-700 border-t-blue-500 rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    if (currentPage === 'register') return <RegisterPage />;
    return <LoginPage />;
  }

  const renderPage = () => {
    switch (currentPage) {
      case 'player':
      case 'home':
        return <PlayerView />;
      case 'vocabulary':
        return <VocabularyView />;
      case 'flashcards':
        return <FlashcardsView />;
      case 'stats':
        return <StatsView />;
      case 'library':
        return <LibraryView />;
      case 'settings':
        return <SettingsView />;
      case 'profile':
        return <ProfileView />;
      default:
        return <PlayerView />;
    }
  };

  return (
    <>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=1" />
        <meta name="theme-color" content="#0f172a" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <title>LinguaLearn — English Learning</title>
        <link rel="manifest" href="/manifest.json" />
      </Head>
      <Layout>{renderPage()}</Layout>
    </>
  );
}
