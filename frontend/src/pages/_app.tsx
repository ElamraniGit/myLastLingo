import '@/styles/globals.css';
import React, { useEffect } from 'react';
import type { AppProps } from 'next/app';
import Head from 'next/head';
import { useAppStore } from '@/store/appStore';
import Layout from '@/components/common/Layout';
import PlayerPage from './PlayerPage';
import VocabularyPage from './VocabularyPage';
import FlashcardsPage from './FlashcardsPage';
import StatsPage from './StatsPage';
import SettingsPage from './SettingsPage';

export default function App({ Component, pageProps }: AppProps) {
  const { currentPage, theme } = useAppStore();

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);

  const renderPage = () => {
    switch (currentPage) {
      case 'player': return <PlayerPage />;
      case 'vocabulary': return <VocabularyPage />;
      case 'flashcards': return <FlashcardsPage />;
      case 'stats': return <StatsPage />;
      case 'settings': return <SettingsPage />;
      default: return <PlayerPage />;
    }
  };

  return (
    <>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="theme-color" content="#0f172a" />
        <title>LinguaLearn - تعلم الإنجليزية</title>
      </Head>
      <Layout>
        {renderPage()}
      </Layout>
    </>
  );
}
