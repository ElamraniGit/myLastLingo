/**
 * Centralized API client — typed, with auth header injection,
 * retry on timeout, and descriptive error messages.
 */

import type { VideoQuality, VocabularyListParams } from '@/types';

export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8080/api/v1';

export const BACKEND_ORIGIN = API_BASE.replace(/\/api\/v1\/?$/, '');

const BASE = API_BASE;

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

  me: () => req<any>('/auth/me'),

  updateProfile: (data: any) => req<any>('/auth/me', { method: 'PATCH', body: data }),

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
};

export const dictionaryApi = {
  lookup: (word: string) => req<any>('/dictionary/lookup', { method: 'POST', body: { word } }),

  search: (query: string, limit = 10) => req<any>(`/dictionary/search?query=${encodeURIComponent(query)}&limit=${limit}`),

  suggest: (prefix: string) => req<any>(`/dictionary/suggest?prefix=${encodeURIComponent(prefix)}&limit=8`),
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
};

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

  getStatus: () => req<any>('/xp/status'),
};

export const chatApi = {
  sendMessage: (message: string, conversation_id?: string) =>
    req<any>('/chat/message', {
      method: 'POST',
      body: { message, conversation_id },
      timeout: 35000,
    }),

  setKey: (api_key: string) =>
    req<any>('/chat/set-key', { method: 'POST', body: { api_key } }),

  hasKey: () => req<any>('/chat/has-key'),

  getHistory: (conversation_id?: string) =>
    req<any>(`/chat/history${conversation_id ? '?conversation_id=' + conversation_id : ''}`),

  clearHistory: () => req<any>('/chat/history', { method: 'DELETE' }),
};

export const healthApi = {
  check: async () => {
    const res = await fetch(`${BACKEND_ORIGIN}/health`);
    if (!res.ok) throw new ApiError(`HTTP ${res.status}`, res.status);
    return res.json();
  },
};
