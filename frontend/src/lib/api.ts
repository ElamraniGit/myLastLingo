/**
 * Centralized API client — typed, with auth header injection,
 * retry on timeout, and descriptive error messages.
 */

export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8080/api/v1';

export const BACKEND_ORIGIN = API_BASE.replace(/\/api\/v1\/?$/, '');

const BASE = API_BASE;

// ─── Token storage (localStorage, SSR-safe) ───────────────────────────────────
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

// ─── Error class ─────────────────────────────────────────────────────────────
export class ApiError extends Error {
  constructor(public message: string, public status: number) {
    super(message);
    this.name = 'ApiError';
  }
}

// ─── Core fetch ──────────────────────────────────────────────────────────────
interface Opts {
  method?: string;
  body?: unknown;
  timeout?: number;
  auth?: boolean; // default true
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

// ─── Auth ─────────────────────────────────────────────────────────────────────
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

// ─── Videos ───────────────────────────────────────────────────────────────────
export const videosApi = {
  process: (url: string) =>
    req<any>('/videos/process', { method: 'POST', body: { url }, timeout: 30000 }),

  list: (page = 1, limit = 20) =>
    req<any>(`/videos/list?page=${page}&limit=${limit}`),

  get: (id: string) => req<any>(`/videos/${id}`),

  delete: (id: string) => req<any>(`/videos/${id}`, { method: 'DELETE' }),
};

// ─── Transcripts ──────────────────────────────────────────────────────────────
export const transcriptsApi = {
  extract: (videoId: string, language = 'en') =>
    req<any>(`/transcripts/extract/${videoId}?language=${language}`, {
      method: 'POST',
      timeout: 120000,
    }),

  get: (videoId: string, language = 'en') =>
    req<any>(`/transcripts/${videoId}?language=${language}`),
};

// ─── Dictionary ───────────────────────────────────────────────────────────────
export const dictionaryApi = {
  lookup: (word: string) =>
    req<any>('/dictionary/lookup', { method: 'POST', body: { word } }),

  search: (query: string, limit = 10) =>
    req<any>(`/dictionary/search?query=${encodeURIComponent(query)}&limit=${limit}`),

  suggest: (prefix: string) =>
    req<any>(`/dictionary/suggest?prefix=${encodeURIComponent(prefix)}&limit=8`),
};

// ─── Vocabulary ───────────────────────────────────────────────────────────────
export const vocabularyApi = {
  save: (word: string, videoId?: string, sentence?: string, context?: string) =>
    req<any>('/vocabulary/save', {
      method: 'POST',
      body: { word, video_id: videoId, sentence: sentence || '', context: context || '' },
    }),

  list: (status?: string, page = 1, limit = 30) => {
    let url = `/vocabulary/list?page=${page}&limit=${limit}`;
    if (status) url += `&status=${status}`;
    return req<any>(url);
  },

  review: (savedWordId: string, quality: number) =>
    req<any>('/vocabulary/review', { method: 'POST', body: { saved_word_id: savedWordId, quality } }),

  due: (limit = 20) => req<any>(`/vocabulary/due?limit=${limit}`),

  stats: () => req<any>('/vocabulary/stats'),

  delete: (savedId: string) => req<any>(`/vocabulary/${savedId}`, { method: 'DELETE' }),
};

// ─── Player ───────────────────────────────────────────────────────────────────
export const playerApi = {
  saveState: (state: any) =>
    req<any>('/player/state', { method: 'POST', body: state }),

  getState: (videoId: string) => req<any>(`/player/state/${videoId}`),
};

// ─── Health ───────────────────────────────────────────────────────────────────
export const healthApi = {
  check: async () => {
    const res = await fetch(`${BACKEND_ORIGIN}/health`);
    if (!res.ok) throw new ApiError(`HTTP ${res.status}`, res.status);
    return res.json();
  },
};
