/**
 * Main application layout with navigation sidebar.
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '@/store/appStore';
import type { AppPage } from '@/types';
import {
  HiPlay,
  HiBookOpen,
  HiCollection,
  HiChartBar,
  HiCog,
  HiMenu,
  HiX,
  HiSearch,
} from 'react-icons/hi';

const navItems: { id: AppPage; label: string; icon: React.ReactNode }[] = [
  { id: 'player', label: 'اللاعب', icon: <HiPlay className="w-5 h-5" /> },
  { id: 'vocabulary', label: 'المفردات', icon: <HiBookOpen className="w-5 h-5" /> },
  { id: 'flashcards', label: 'البطاقات', icon: <HiCollection className="w-5 h-5" /> },
  { id: 'stats', label: 'الإحصائيات', icon: <HiChartBar className="w-5 h-5" /> },
  { id: 'settings', label: 'الإعدادات', icon: <HiCog className="w-5 h-5" /> },
];

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const { currentPage, setCurrentPage, sidebarOpen, setSidebarOpen } = useAppStore();

  return (
    <div className="flex h-screen bg-surface-900 overflow-hidden">
      {/* Mobile sidebar backdrop */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <AnimatePresence mode="wait">
        {sidebarOpen && (
          <motion.aside
            initial={{ x: -280 }}
            animate={{ x: 0 }}
            exit={{ x: -280 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed inset-y-0 left-0 z-50 w-72 bg-surface-800 border-l border-surface-700/50 lg:hidden"
          >
            <MobileSidebar
              currentPage={currentPage}
              onNavigate={(page) => {
                setCurrentPage(page);
                setSidebarOpen(false);
              }}
              onClose={() => setSidebarOpen(false)}
            />
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-64 bg-surface-800/50 border-l border-surface-700/30">
        <DesktopSidebar currentPage={currentPage} onNavigate={setCurrentPage} />
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="flex items-center justify-between px-4 py-3 bg-surface-800/30 backdrop-blur-sm border-b border-surface-700/30 lg:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="btn-icon btn-ghost"
            aria-label="Open menu"
          >
            <HiMenu className="w-6 h-6" />
          </button>

          <div className="flex items-center gap-2">
            <span className="text-lg font-bold gradient-text">LinguaLearn</span>
          </div>

          <button className="btn-icon btn-ghost" aria-label="Search">
            <HiSearch className="w-6 h-6" />
          </button>
        </header>

        {/* Page content */}
        <div className="flex-1 overflow-y-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentPage}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="h-full"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

/* Desktop Sidebar */
function DesktopSidebar({
  currentPage,
  onNavigate,
}: {
  currentPage: AppPage;
  onNavigate: (page: AppPage) => void;
}) {
  return (
    <>
      {/* Logo */}
      <div className="p-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center shadow-lg">
            <span className="text-white font-bold text-lg">L</span>
          </div>
          <div>
            <h1 className="text-lg font-bold gradient-text">LinguaLearn</h1>
            <p className="text-xs text-surface-400">English Learning</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 space-y-1">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
              currentPage === item.id
                ? 'bg-primary-500/10 text-primary-400 border border-primary-500/20 shadow-sm'
                : 'text-surface-300 hover:text-white hover:bg-surface-700/50'
            }`}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-surface-700/30">
        <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-surface-700/30">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse-soft" />
          <span className="text-xs text-surface-400">الخادم المحلي نشط</span>
        </div>
      </div>
    </>
  );
}

/* Mobile Sidebar */
function MobileSidebar({
  currentPage,
  onNavigate,
  onClose,
}: {
  currentPage: AppPage;
  onNavigate: (page: AppPage) => void;
  onClose: () => void;
}) {
  return (
    <>
      <div className="flex items-center justify-between p-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center">
            <span className="text-white font-bold text-lg">L</span>
          </div>
          <h1 className="text-lg font-bold gradient-text">LinguaLearn</h1>
        </div>
        <button onClick={onClose} className="btn-icon btn-ghost">
          <HiX className="w-6 h-6" />
        </button>
      </div>

      <nav className="px-3 space-y-1">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
              currentPage === item.id
                ? 'bg-primary-500/10 text-primary-400'
                : 'text-surface-300 hover:text-white hover:bg-surface-700/50'
            }`}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
    </>
  );
}