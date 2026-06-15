/**
 * WordImage — a visual association for a word (Dual Coding aids memory).
 *
 * Fetches a Creative Commons image (Openverse, no API key) via the backend,
 * which caches results. Lazy: nothing loads until tapped. Hides itself silently
 * if no image is found or the image fails to load (e.g. offline / sandbox).
 */

import React, { useState, useCallback } from 'react';
import { dictionaryApi, type WordImage as WordImageData } from '@/lib/api';

interface Props {
  word: string;
  variant?: 'sheet' | 'page';
}

export default function WordImage({ word, variant = 'page' }: Props) {
  const [data, setData]       = useState<WordImageData | null>(null);
  const [loading, setLoading] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [requested, setRequested] = useState(false);

  const fetchImage = useCallback(async () => {
    if (loading) return;
    setLoading(true); setRequested(true); setImgError(false);
    try {
      setData(await dictionaryApi.image(word));
    } catch {
      setData({ found: false, thumbnail: '', source: '', title: '', creator: '' });
    } finally {
      setLoading(false);
    }
  }, [word, loading]);

  const height = variant === 'sheet' ? 'h-40' : 'h-48';

  // Initial state: a tappable button (lazy load).
  if (!requested) {
    return (
      <button
        onClick={fetchImage}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-teal-500/30 bg-teal-500/10 text-teal-400 text-sm font-semibold hover:bg-teal-500/15 active:scale-[0.99] transition-all"
      >
        <span>🖼️</span> Show a picture
      </button>
    );
  }

  if (loading) {
    return <div className={`skeleton w-full ${height} rounded-xl`} />;
  }

  // No usable image (or it failed to load) — quiet, non-blocking notice.
  if (!data?.found || !data.thumbnail || imgError) {
    return (
      <p className="text-xs text-faint text-center py-2">
        No picture found for this word.
      </p>
    );
  }

  return (
    <figure className="rounded-xl overflow-hidden border border-default bg-card">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={data.thumbnail}
        alt={data.title || word}
        loading="lazy"
        onError={() => setImgError(true)}
        className={`w-full ${height} object-cover`}
      />
      {(data.title || data.creator || data.source) && (
        <figcaption className="px-2.5 py-1.5 text-[10px] text-faint flex items-center justify-between gap-2">
          <span className="truncate">{data.title || word}{data.creator ? ` · ${data.creator}` : ''}</span>
          {data.source && (
            <a href={data.source} target="_blank" rel="noopener noreferrer"
               className="shrink-0 text-teal-400 hover:underline">source</a>
          )}
        </figcaption>
      )}
    </figure>
  );
}
