/**
 * API service for LinguaLearn.
 * Communicates with local backend at 127.0.0.1:8080
 *
 * No changes to logic — cleaned up types and added retry for mobile networks.
 */

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8080/api/v1';

interface RequestOptions {
  method?: string;
  body?: any;
  headers?: Record<string, string>;
  timeout?: number;
  retries?: number;
}

class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = 'ApiError';
  }
}

async function request<T>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const { method = 'GET', body, headers = {}, timeout = 30000, retries = 1 } = options;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(`${API_BASE}${endpoint}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new ApiError(
          (errorData as any).detail ||
            (errorData as any).message ||
            `HTTP ${response.status}`,
          response.status
        );
      }

      return await response.json();
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof ApiError) throw error;
      if (error instanceof DOMException && error.name === 'AbortError') {
        if (attempt < retries) {
          await new Promise((r) => setTimeout(r, 1000));
          continue;
        }
        throw new ApiError('Request timeout — الخادم لا يستجيب', 408);
      }
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 1000));
        continue;
      }
      throw new ApiError(
        'Network error — هل الخادم المحلي يعمل؟ تأكد من تشغيل ./scripts/start_backend.sh',
        0
      );
    }
  }

  throw new ApiError('All retries failed', 0);
}

// API methods
export const api = {
  // Health check
  health: () =>
    request<{ status: string; version: string; mode: string }>('/health'),

  // Videos
  videos: {
    process: (url: string, quality?: string) =>
      request<any>('/videos/process', {
        method: 'POST',
        body: { url, quality },
      }),
    list: (page = 1, limit = 20) =>
      request<any>(`/videos/list?page=${page}&limit=${limit}`),
    get: (id: string) => request<any>(`/videos/${id}`),
    delete: (id: string) =>
      request<any>(`/videos/${id}`, { method: 'DELETE' }),
  },

  // Transcripts
  transcripts: {
    extract: (videoId: string, language = 'en') =>
      request<any>(`/transcripts/extract/${videoId}?language=${language}`, {
        method: 'POST',
        timeout: 90000, // 90s for VTT download + parse
      }),
    get: (videoId: string, language = 'en') =>
      request<any>(`/transcripts/${videoId}?language=${language}`),
    getSegments: (videoId: string, language = 'en') =>
      request<any>(
        `/transcripts/${videoId}/segments?language=${language}`
      ),
  },

  // Dictionary
  dictionary: {
    lookup: (word: string) =>
      request<any>('/dictionary/lookup', {
        method: 'POST',
        body: { word },
      }),
    search: (query: string, limit = 10) =>
      request<any>(
        `/dictionary/search?query=${encodeURIComponent(query)}&limit=${limit}`
      ),
    suggest: (prefix: string, limit = 10) =>
      request<any>(
        `/dictionary/suggest?prefix=${encodeURIComponent(prefix)}&limit=${limit}`
      ),
    popular: (limit = 50) =>
      request<any>(`/dictionary/popular?limit=${limit}`),
    level: (word: string) =>
      request<any>(`/dictionary/level/${encodeURIComponent(word)}`),
  },

  // Vocabulary
  vocabulary: {
    save: (
      word: string,
      videoId?: string,
      sentence?: string,
      context?: string
    ) =>
      request<any>('/vocabulary/save', {
        method: 'POST',
        body: { word, video_id: videoId, sentence, context },
      }),
    list: (status?: string, page = 1, limit = 20) => {
      let url = `/vocabulary/list?page=${page}&limit=${limit}`;
      if (status) url += `&status=${status}`;
      return request<any>(url);
    },
    review: (savedWordId: string, quality: number) =>
      request<any>('/vocabulary/review', {
        method: 'POST',
        body: { saved_word_id: savedWordId, quality },
      }),
    due: (limit = 20) => request<any>(`/vocabulary/due?limit=${limit}`),
    stats: () => request<any>('/vocabulary/stats'),
    delete: (savedId: string) =>
      request<any>(`/vocabulary/${savedId}`, { method: 'DELETE' }),
  },

  // Player
  player: {
    updateState: (state: any) =>
      request<any>('/player/state', {
        method: 'POST',
        body: state,
      }),
    getState: (videoId: string) => request<any>(`/player/state/${videoId}`),
    stream: (videoId: string) => request<any>(`/player/stream/${videoId}`),
  },
};

export default api;
