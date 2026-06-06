/**
 * Centralized API client — typed, with auth header injection,
 * retry on timeout, and descriptive error messages.
 */

import type { VideoQuality, VocabularyListParams } from '@/types';

export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8080/api/v1';

export const BACKEND_ORIGIN = API_BASE.replace(/\/api\/v1\/?$/, '');

const BASE = API_BASE;

/** Normalise a user object returned from the API — make avatar_url absolute. */
function normaliseUser(u: any): any {
  if (u?.avatar_url && u.avatar_url.startsWith('/')) {
    u.avatar_url = BACKEND_ORIGIN + u.avatar_url;
  }
  return u;
}



export const tokenStore = {
  get: (): string | null => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('ll_token');
  },
  set: (token: string) => {
    if (typeof window === 'undefined') return;
    localStorage.setItem('ll_token', token);
  },
  clear: () => {
    if (typeof window === 'undefined') return;
    localStorage.removeItem('ll_token');
  },
};

export class ApiError extends Error {
  constructor(public message: string, public status: number) {
    super(message);
    this.name = 'ApiError';
  }
}

interface Opts {
  method?: string;
  body?: unknown;
  timeout?: number;
  auth?: boolean;
}

async function req<T>(endpoint: string, opts: Opts = {}): Promise<T> {
  const { method = 'GET', body, timeout = 45000, auth = true } = opts;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (auth) {
    const token = tokenStore.get();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }

  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), timeout);

  try {
    const res = await fetch(`${BASE}${endpoint}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    clearTimeout(tid);

    if (!res.ok) {
      let detail = `HTTP ${res.status}`;
      try {
        const err = await res.json();
        detail = err.detail || err.message || detail;
      } catch {}

      // Centralized session-expiry handling: if an authenticated request is
      // rejected, clear the stale token and notify the app to return to login.
      if (res.status === 401 && auth) {
        tokenStore.clear();
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('ll:unauthorized'));
        }
      }

      throw new ApiError(detail, res.status);
    }

    return res.json();
  } catch (e) {
    clearTimeout(tid);
    if (e instanceof ApiError) throw e;
    if (e instanceof DOMException && e.name === 'AbortError') {
      throw new ApiError('Request timed out — is the backend running?', 408);
    }
    throw new ApiError('Network error — start the backend with ./scripts/start_backend.sh', 0);
  }
}

function buildQuery(params: Record<string, any>) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    search.set(key, String(value));
  });
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

export const authApi = {
  register: (username: string, email: string, password: string, display_name?: string) =>
    req<any>('/auth/register', { method: 'POST', body: { username, email, password, display_name }, auth: false }),

  login: (username: string, password: string, remember = false) =>
    req<any>('/auth/login', { method: 'POST', body: { username, password, remember }, auth: false }),

  me: () => req<any>('/auth/me').then(normaliseUser),

  updateProfile: (data: any) => req<any>('/auth/me', { method: 'PATCH', body: data }),

  /** Permanently delete account + all data */
  deleteAccount: (password: string) =>
    req<any>('/auth/me', { method: 'DELETE', body: { password, confirm: 'DELETE MY ACCOUNT' } }),

  /** Clear only vocabulary + XP */
  clearVocabulary: () => req<any>('/auth/me/vocabulary', { method: 'DELETE' }),

  /** Clear only library sources */
  clearLibrary: () => req<any>('/auth/me/library', { method: 'DELETE' }),

  /** Clear only chat history */
  clearChat: () => req<any>('/auth/me/chat', { method: 'DELETE' }),

  /** Upload avatar image (JPEG/PNG/WebP, max 5MB) */
  uploadAvatar: async (file: File): Promise<{ avatar_url: string }> => {
    const token = tokenStore.get();
    const form  = new FormData();
    form.append('file', file);
    const res = await fetch(`${API_BASE}/auth/me/avatar`, {
      method: 'POST',
      headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      body: form,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new ApiError(err?.detail || `HTTP ${res.status}`, res.status);
    }
    const data = await res.json();
    // Convert relative path to full URL so <img src> works from port 3000
    if (data.avatar_url && data.avatar_url.startsWith('/')) {
      data.avatar_url = BACKEND_ORIGIN + data.avatar_url;
    }
    return data;
  },

  refresh: () => req<any>('/auth/refresh', { method: 'POST' }),

  logout: () => req<any>('/auth/logout', { method: 'POST' }),
};

export const videosApi = {
  process: (url: string, quality?: VideoQuality) =>
    req<any>('/videos/process', {
      method: 'POST',
      body: { url, quality },
      timeout: 30000,
    }),

  list: (page = 1, limit = 20) => req<any>(`/videos/list?page=${page}&limit=${limit}`),

  get: (id: string) => req<any>(`/videos/${id}`),

  delete: (id: string) => req<any>(`/videos/${id}`, { method: 'DELETE' }),
};

export const transcriptsApi = {
  extract: (videoId: string, language = 'en') =>
    req<any>(`/transcripts/extract/${videoId}?language=${language}`, {
      method: 'POST',
      timeout: 120000,
    }),

  get: (videoId: string, language = 'en') => req<any>(`/transcripts/${videoId}?language=${language}`),

  // Phase 2: poll real status (idle|processing|ready|error) instead of guessing
  // from repeated 404s on get().
  status: (videoId: string, language = 'en') =>
    req<{ status: 'idle' | 'processing' | 'ready' | 'error'; error: string; segment_count: number }>(
      `/transcripts/${videoId}/status?language=${language}`
    ),
};

export const dictionaryApi = {
  lookup: (word: string) => req<any>('/dictionary/lookup', { method: 'POST', body: { word } }),

  search: (query: string, limit = 10) => req<any>(`/dictionary/search?query=${encodeURIComponent(query)}&limit=${limit}`),

  suggest: (prefix: string) => req<any>(`/dictionary/suggest?prefix=${encodeURIComponent(prefix)}&limit=8`),

  /** Re-enrich a cached word with AI (uses user's saved Groq key). */
  enrich: (word: string) => req<any>(`/dictionary/enrich/${encodeURIComponent(word)}`, { method: 'POST', timeout: 25000 }),
};

export const vocabularyApi = {
  save: (word: string, videoId?: string, sentence?: string, context?: string) =>
    req<any>('/vocabulary/save', {
      method: 'POST',
      body: { word, video_id: videoId, sentence: sentence || '', context: context || '' },
    }),

  list: (params: VocabularyListParams = {}) =>
    req<any>(`/vocabulary/list${buildQuery({
      status: params.status,
      page: params.page ?? 1,
      limit: params.limit ?? 30,
      search: params.search,
      level: params.level,
      video_id: params.video_id,
      due_only: params.due_only,
      tag: params.tag,
      favorite_only: params.favorite_only,
      sort: params.sort,
    })}`),

  filters: () => req<any>('/vocabulary/filters'),

  update: (savedId: string, data: { tags?: string[]; notes?: string; favorite?: boolean }) =>
    req<any>(`/vocabulary/${savedId}`, { method: 'PATCH', body: data }),

  review: (savedWordId: string, quality: number) =>
    req<any>('/vocabulary/review', { method: 'POST', body: { saved_word_id: savedWordId, quality } }),

  due: (limit = 20) => req<any>(`/vocabulary/due?limit=${limit}`),

  reviewSummary: () => req<any>('/vocabulary/review/summary'),

  reviewHistory: (savedWordId: string, limit = 20) => req<any>(`/vocabulary/review/history/${savedWordId}?limit=${limit}`),

  stats: () => req<any>('/vocabulary/stats'),

  delete: (savedId: string) => req<any>(`/vocabulary/${savedId}`, { method: 'DELETE' }),

  /** Get a single saved word by ID. */
  getOne: (savedId: string) => req<any>(`/vocabulary/${savedId}`),

  // Phase 5: bulk import (looks up + adds words the user doesn't have yet).
  import: (words: { word: string; sentence?: string; context?: string }[]) =>
    req<{ added: number; skipped: number; failed: number }>('/vocabulary/import', {
      method: 'POST',
      body: { words },
      timeout: 120000,
    }),

  // Export URL (CSV/JSON) — the token is sent via fetch in downloadExport().
  exportUrl: (format: 'csv' | 'json' = 'csv') =>
    `${API_BASE}/vocabulary/export?format=${format}`,
};

/**
 * Phase 5: download a vocabulary export as a file, with the auth header attached
 * (a plain <a download> can't set Authorization, so we fetch + blob).
 */
export async function downloadVocabularyExport(format: 'csv' | 'json' = 'csv') {
  const token = tokenStore.get();
  const res = await fetch(vocabularyApi.exportUrl(format), {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (!res.ok) throw new ApiError(`Export failed (HTTP ${res.status})`, res.status);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `lingualearn-vocabulary.${format}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export const playerApi = {
  saveState: (state: any) => req<any>('/player/state', { method: 'POST', body: state }),

  getState: (videoId: string) => req<any>(`/player/state/${videoId}`),
};

export const libraryApi = {
  listSources: (page = 1, limit = 50) =>
    req<any>(`/library/sources?page=${page}&limit=${limit}`),

  addText: (title: string, content: string, source_type = 'text') =>
    req<any>('/library/text', { method: 'POST', body: { title, content, source_type } }),

  getText: (id: string) => req<any>(`/library/text/${id}`),

  deleteSource: (id: string) =>
    req<any>(`/library/source/${id}`, { method: 'DELETE' }),
};

export const xpApi = {
  addXP: (action: string, amount?: number) =>
    req<any>('/xp/add', { method: 'POST', body: { action, amount } }),

  /** Flush offline-queued XP actions in one batch request. */
  batchXP: (items: { action: string; amount: number; occurred_at: string }[]) =>
    req<any>('/xp/batch', { method: 'POST', body: { items } }),

  getStatus: () => req<any>('/xp/status'),
};

export const chatApi = {
  /**
   * Streaming message via SSE.
   * Calls onToken for each chunk, onDone({conversation_id}) at end,
   * onError(msg) on failure. Returns an AbortController for cancellation.
   */
  sendMessageStream: (
    message: string,
    conversation_id: string | undefined,
    onToken:  (token: string) => void,
    onDone:   (meta: { conversation_id: string }) => void,
    onError:  (msg: string) => void,
  ): AbortController => {
    const ctrl = new AbortController();
    const token = tokenStore.get();

    (async () => {
      try {
        const res = await fetch(`${API_BASE}/chat/message`, {
          method:  'POST',
          headers: {
            'Content-Type':  'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
          },
          body:   JSON.stringify({ message, conversation_id }),
          signal: ctrl.signal,
        });

        if (!res.ok) {
          const text = await res.text().catch(() => '');
          onError(text || `HTTP ${res.status}`);
          return;
        }

        const reader = res.body?.getReader();
        if (!reader) { onError('No response body'); return; }

        const dec = new TextDecoder();
        let buf = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          const lines = buf.split('\n');
          buf = lines.pop() ?? '';

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const payload = line.slice(6);
            if (payload === '[DONE]') { return; }
            if (payload.startsWith('[ERROR]')) { onError(payload.slice(7)); return; }
            if (payload.startsWith('[META]')) {
              try { onDone(JSON.parse(payload.slice(6))); } catch { /* noop */ }
              continue;
            }
            // Unescape newlines sent as \n
            onToken(payload.replace(/\\n/g, '\n'));
          }
        }
      } catch (e: any) {
        if (e?.name === 'AbortError') return;
        onError('Connection error — check internet');
      }
    })();

    return ctrl;
  },

  /** Non-streaming fallback */
  sendMessageSync: (message: string, conversation_id?: string) =>
    req<any>('/chat/message/sync', {
      method: 'POST',
      body:   { message, conversation_id },
      timeout: 40000,
    }),

  setKey: (api_key: string) =>
    req<any>('/chat/set-key', { method: 'POST', body: { api_key } }),

  hasKey: () => req<any>('/chat/has-key'),

  getHistory: (conversation_id?: string) =>
    req<any>(`/chat/history${conversation_id ? '?conversation_id=' + conversation_id : ''}`),

  clearHistory: () => req<any>('/chat/history', { method: 'DELETE' }),
};

// ─── Core English 3000 API ────────────────────────────────────────────────────

export const coreApi = {
  listWords: (params: {
    search?: string; level?: string; pos?: string;
    page?: number; limit?: number; sort?: string;
  } = {}) => {
    const q = buildQuery({
      search: params.search, level: params.level, pos: params.pos,
      page: params.page ?? 1, limit: params.limit ?? 50,
      sort: params.sort ?? 'freq',
    });
    return req<any>(`/core/words${q}`);
  },

  getWord: (wordId: string) =>
    req<any>(`/core/words/${wordId}`),

  getDueWords: (limit = 50, level?: string) => {
    const q = buildQuery({ limit, level });
    return req<any>(`/core/due${q}`);
  },

  review: (wordId: string, quality: number) =>
    req<any>(`/core/progress/${wordId}`, {
      method: 'POST',
      body: { quality },
    }),

  getProgress: () => req<any>('/core/progress'),

  getStats: () => req<any>('/core/stats'),

  getLevelWords: (level: string, page = 1, limit = 50) =>
    req<any>(`/core/levels?level=${level}&page=${page}&limit=${limit}`),

  /** Get words for practice: smart | new | review | random */
  getPracticeWords: (mode = 'smart', level?: string, limit = 100) => {
    const q = buildQuery({ mode, level, limit });
    return req<any>(`/core/practice${q}`);
  },
};

export const healthApi = {
  check: async () => {
    const res = await fetch(`${BACKEND_ORIGIN}/health`);
    if (!res.ok) throw new ApiError(`HTTP ${res.status}`, res.status);
    return res.json();
  },
};
