/**
 * Root Next.js page.
 *
 * Bug #17 fix: Previously returned null, showing a blank screen.
 * Now renders a proper loading state while Zustand hydrates from localStorage,
 * then delegates rendering to _app.tsx via the global store.
 */

import React, { useEffect, useState } from 'react';
import type { NextPage } from 'next';

const Home: NextPage = () => {
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    // Allow Zustand persist middleware to hydrate first
    setHydrated(true);
  }, []);

  if (!hydrated) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          background: '#0f172a',
          color: '#f8fafc',
        }}
      >
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: '50%',
            border: '3px solid #334155',
            borderTopColor: '#3b82f6',
            animation: 'spin 0.8s linear infinite',
            marginBottom: 16,
          }}
        />
        <p style={{ color: '#94a3b8', fontSize: 14 }}>جاري التحميل...</p>
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  // _app.tsx handles all page rendering via Zustand currentPage state
  return null;
};

export default Home;
