/**
 * MnemonicSection — AI-generated memory hook to make a word stick.
 *
 * Calls /practice/mnemonic (cached + shared). Shows a vivid sound-link image and
 * an Arabic memory line, which is the most effective recall aid for Arabic
 * speakers. Lazy: nothing is fetched until the learner taps "Create memory hook".
 */

import React, { useState, useCallback } from 'react';
import { practiceApi, type Mnemonic, ApiError } from '@/lib/api';
import { speak as ttsSpeak } from '@/lib/tts';

interface Props {
  word: string;
  meaningAr?: string;
  meaningEn?: string;
  /** 'sheet' = compact (popup), 'page' = roomier (detail view) */
  variant?: 'sheet' | 'page';
}

export default function MnemonicSection({ word, meaningAr, meaningEn, variant = 'page' }: Props) {
  const [data, setData]       = useState<Mnemonic | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const fetchHook = useCallback(async (refresh = false) => {
    if (loading) return;
    setLoading(true); setError('');
    try {
      const m = await practiceApi.mnemonic(word, meaningAr, meaningEn, refresh);
      setData(m);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not create a memory hook.');
    } finally {
      setLoading(false);
    }
  }, [word, meaningAr, meaningEn, loading]);

  const textSize = variant === 'sheet' ? 'text-sm' : 'text-base';

  return (
    <div className="space-y-2">
      {!data && (
        <button
          onClick={() => fetchHook(false)}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-purple-500/30 bg-purple-500/10 text-purple-400 text-sm font-semibold hover:bg-purple-500/15 active:scale-[0.99] disabled:opacity-60 transition-all"
        >
          {loading ? (
            <><span className="w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" /> Creating…</>
          ) : (
            <><span>🧠</span> Create a memory hook</>
          )}
        </button>
      )}

      {error && <p className="text-xs text-red-400">{error}</p>}

      {data && (
        <div className="rounded-2xl border border-purple-500/25 bg-purple-500/8 p-4 space-y-3 animate-fade-in">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-purple-400 uppercase tracking-wide flex items-center gap-1.5">
              <span>🧠</span> Memory hook
            </span>
            <button
              onClick={() => fetchHook(true)}
              disabled={loading}
              title="Generate another"
              className="text-xs text-muted hover:text-body disabled:opacity-50 flex items-center gap-1"
            >
              {loading ? '…' : '↻ Another'}
            </button>
          </div>

          {/* Arabic memory line — the key recall aid */}
          {data.hook_ar && (
            <p dir="rtl" className={`${textSize} text-heading leading-relaxed font-medium`}>
              {data.hook_ar}
            </p>
          )}

          {/* English hook + listen */}
          {data.hook && (
            <div className="flex items-start gap-2">
              <p className={`${textSize} text-body leading-relaxed flex-1`}>{data.hook}</p>
              <button
                onClick={() => ttsSpeak(data.hook, { rate: 0.9 })}
                aria-label="Listen"
                className="shrink-0 w-7 h-7 rounded-lg bg-purple-500/15 text-purple-400 hover:bg-purple-500/25 active:scale-95 flex items-center justify-center transition-all"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
                  <path d="M11 5L6 9H2v6h4l5 4V5z" /><path d="M15.5 8.5a5 5 0 0 1 0 7" />
                </svg>
              </button>
            </div>
          )}

          {data.sound_link && (
            <div className="text-xs text-muted">
              <span className="text-faint">Sounds like:</span> <span className="text-purple-300 font-medium">{data.sound_link}</span>
            </div>
          )}

          {data.image && (
            <div className="flex items-start gap-1.5 text-xs text-muted">
              <span>🖼️</span><span className="leading-relaxed">{data.image}</span>
            </div>
          )}

          {data.tip && (
            <p className="text-xs text-muted bg-card/60 rounded-lg p-2 leading-relaxed">💡 {data.tip}</p>
          )}
        </div>
      )}
    </div>
  );
}
