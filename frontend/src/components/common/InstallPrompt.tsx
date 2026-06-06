/**
 * PWA Install Prompt — shows a banner after 3 seconds inviting the
 * user to install the app on their device.
 *
 * - Listens for the browser's `beforeinstallprompt` event
 * - Shows a dismissible banner at the bottom
 * - Remembers dismissal for 7 days
 * - Works on Chrome, Edge, Samsung Browser, Opera (Android)
 * - On iOS Safari shows manual instructions
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';

const DISMISS_KEY = 'll-install-dismissed';
const DISMISS_DAYS = 7;

function wasDismissedRecently(): boolean {
  if (typeof window === 'undefined') return true;
  const ts = localStorage.getItem(DISMISS_KEY);
  if (!ts) return false;
  const diff = Date.now() - Number(ts);
  return diff < DISMISS_DAYS * 86400000;
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true
  );
}

function isIOS(): boolean {
  if (typeof window === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
}

export default function InstallPrompt() {
  const [show, setShow] = useState(false);
  const [iosMode, setIosMode] = useState(false);
  const deferredPrompt = useRef<any>(null);

  useEffect(() => {
    // Don't show if already installed or recently dismissed
    if (isStandalone() || wasDismissedRecently()) return;

    // iOS — show manual instructions after delay
    if (isIOS()) {
      const timer = setTimeout(() => {
        setIosMode(true);
        setShow(true);
      }, 4000);
      return () => clearTimeout(timer);
    }

    // Android/Desktop — listen for beforeinstallprompt
    const handler = (e: Event) => {
      e.preventDefault();
      deferredPrompt.current = e;
      // Show banner after a short delay
      setTimeout(() => setShow(true), 3000);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt.current) return;
    deferredPrompt.current.prompt();
    const result = await deferredPrompt.current.userChoice;
    if (result.outcome === 'accepted') {
      setShow(false);
    }
    deferredPrompt.current = null;
  }, []);

  const handleDismiss = useCallback(() => {
    setShow(false);
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
  }, []);

  if (!show) return null;

  return (
    <div className="fixed bottom-16 left-3 right-3 z-50 animate-slide-up lg:left-auto lg:right-4 lg:bottom-4 lg:max-w-sm">
      <div className="bg-card border border-line rounded-2xl shadow-2xl p-4">
        <div className="flex items-start gap-3">
          {/* Icon */}
          <div className="w-11 h-11 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg">
            <span className="text-white font-black text-lg">L</span>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-heading">Install LinguaLearn</p>
            <p className="text-xs text-muted mt-0.5">
              {iosMode
                ? 'Tap the share button ⎋ then "Add to Home Screen"'
                : 'Add to your home screen for faster access'}
            </p>
          </div>

          {/* Close */}
          <button onClick={handleDismiss} className="p-1 text-faint hover:text-body flex-shrink-0">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Buttons */}
        {!iosMode && (
          <div className="flex gap-2 mt-3">
            <button onClick={handleDismiss}
              className="flex-1 px-3 py-2 rounded-xl text-xs font-medium text-muted bg-surface border border-line hover:text-body transition-colors">
              Not now
            </button>
            <button onClick={handleInstall}
              className="flex-1 px-3 py-2 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-500/20 transition-colors">
              Install
            </button>
          </div>
        )}

        {/* iOS manual steps */}
        {iosMode && (
          <div className="mt-3 flex items-center gap-3 text-xs text-body">
            <div className="flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-surface flex items-center justify-center text-xs font-bold text-heading">1</span>
              <span>Tap</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-blue-400">
                <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8" /><polyline points="16 6 12 2 8 6" /><line x1="12" y1="2" x2="12" y2="15" />
              </svg>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-surface flex items-center justify-center text-xs font-bold text-heading">2</span>
              <span>"Add to Home Screen"</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
