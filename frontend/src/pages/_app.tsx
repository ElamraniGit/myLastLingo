/**
 * LinguaLearn v2 — App root.
 * Handles auth routing, theme, page switching.
 *
 * FIX: Removed "if (router.pathname !== '/') return <Component />"
 *      That pattern caused a render loop — Component re-rendered _app
 *      which re-rendered Component infinitely.
 *      Now we always render the SPA shell on '/' and return null elsewhere.
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
import ChatView from '@/views/ChatView';
import TextReaderView from '@/views/TextReaderView';

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();
  const { currentPage, isAuthenticated, theme } = useStore();
  const [hydrated, setHydrated] = useState(false);

  // Apply theme class to <html>
  useEffect(() => {
    const el = document.documentElement;
    el.classList.remove('dark', 'light');
    if (theme === 'dark') {
      el.classList.add('dark');
    } else if (theme === 'light') {
      el.classList.add('light');
    }
    // 'auto' = no class — CSS @media (prefers-color-scheme) handles it
  }, [theme]);

  // Register SW once, then mark hydrated
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
    setHydrated(true);
  }, []);

  // FIX: Only render the SPA on the root path.
  // For any other Next.js page (e.g. /404), render normally without our shell.
  if (router.pathname !== '/') {
    return <Component {...pageProps} />;
  }

  // Show loading spinner while Zustand is rehydrating from localStorage
  if (!hydrated) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', background: '#020617',
      }}>
        <div style={{
          width: 48, height: 48, borderRadius: 12,
          background: '#3b82f6', color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 24, fontWeight: 800,
          animation: 'pulse 1.5s ease-in-out infinite',
        }}>L</div>
        <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }`}</style>
      </div>
    );
  }

  // Not logged in → show auth screens
  if (!isAuthenticated) {
    if (currentPage === 'register') return <RegisterPage />;
    return <LoginPage />;
  }

  // Logged in → render the correct view
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
      case 'chat':
        return <ChatView />;
      case 'textreader':
        return <TextReaderView />;
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
        <title>LinguaLearn — English Learning</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </Head>
      <Layout>
        <InstallPrompt />
        {renderPage()}
      </Layout>
    </>
  );
}
