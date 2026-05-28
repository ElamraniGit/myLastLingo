/**
 * Root Next.js page — shows loading spinner while _app.tsx hydrates.
 * All real routing is handled by Zustand store in _app.tsx.
 */

import React from 'react';
import type { NextPage } from 'next';

const Home: NextPage = () => (
  <div className="min-h-screen bg-slate-950 flex items-center justify-center">
    <div className="flex flex-col items-center gap-4">
      <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-xl">
        <span className="text-white text-xl font-black">L</span>
      </div>
      <div className="w-6 h-6 border-2 border-slate-700 border-t-blue-500 rounded-full animate-spin" />
    </div>
  </div>
);

export default Home;
