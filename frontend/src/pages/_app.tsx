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
import InstallPrompt from '@/components/common/InstallPrompt';
import LoginPage from '@/components/auth/LoginPage';
import RegisterPage from '@/components/auth/RegisterPage';

// Views
import PlayerView from '@/views/PlayerView';
import VocabularyView from '@/views/VocabularyView';
import FlashcardsView from '@/views/FlashcardsView';
import ProfileView from '@/views/ProfileView';
import LibraryView from '@/views/LibraryView';

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();
  const { currentPage, isAuthenticated, theme } = useStore();
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const el = document.documentElement;
    el.classList.remove('dark', 'light');
    if (theme === 'dark') {
      el.classList.add('dark');
    } else if (theme === 'light') {
      el.classList.add('light');
    }
    // 'auto' = no class added, CSS @media (prefers-color-scheme) handles it
  }, [theme]);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
    setHydrated(true);
  }, []);

  if (router.pathname !== '/') return <Component {...pageProps} />;

  if (!hydrated) {
    return (
      <div className="min-h-screen bg-base flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-xl">
            <span className="text-heading text-xl font-black">L</span>
          </div>
          <div className="w-6 h-6 border-2 border-line border-t-blue-500 rounded-full animate-spin" />
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
      case 'library':
        return <LibraryView />;
      case 'vocabulary':
        return <VocabularyView />;
      case 'flashcards':
        return <FlashcardsView />;
      case 'profile':
      case 'settings':
      case 'stats':
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
      <Layout>
        <div key={currentPage} className="h-full">
          {renderPage()}
        </div>
        <InstallPrompt />
      </Layout>
    </>
  );
}
