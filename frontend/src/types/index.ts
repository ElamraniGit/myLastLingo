// Core types for LinguaLearn application

export interface Video {
  id: string;
  youtube_id: string;
  title: string;
  channel: string;
  duration: number;
  thumbnail_url: string;
  description: string;
  status: 'pending' | 'processing' | 'downloaded' | 'ready' | 'error';
  created_at: string;
  updated_at: string;
}

export interface WordTiming {
  word: string;
  start: number;
  end: number;
  probability?: number;
}

export interface TranscriptSegment {
  index: number;
  start: number;
  end: number;
  text: string;
  duration: number;
  words: WordTiming[];
}

export interface Transcript {
  id: string;
  video_id: string;
  language: string;
  source: 'youtube' | 'whisper';
  segments: TranscriptSegment[];
  full_text: string;
  word_timings: Record<string, { start: number; end: number; segment_index: number }>;
  word_count?: number;
  segment_count?: number;
}

export interface Word {
  id: string;
  word: string;
  pronunciation: string;
  part_of_speech: string;
  level: CEFRLevel;
  meaning_ar: string;
  meaning_en: string;
  examples: string[];
  synonyms: string[];
  antonyms: string[];
  root_form: string;
  conjugations: Record<string, string>;
  related_words: string[];
  frequency: number;
}

export type CEFRLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';

export interface SavedWord {
  id: string;
  word_id: string;
  word: string;
  pronunciation: string;
  part_of_speech: string;
  meaning_ar: string;
  meaning_en: string;
  level: CEFRLevel;
  examples: string[];
  video_id?: string;
  sentence: string;
  context: string;
  status: 'learning' | 'reviewing' | 'learned';
  ease_factor: number;
  interval: number;
  repetitions: number;
  next_review: string;
  last_reviewed?: string;
  created_at: string;
}

export interface PlayerState {
  video_id: string;
  position: number;
  playing: boolean;
  speed: number;
  volume: number;
  current_segment: number;
  loop_enabled: boolean;
  loop_start?: number;
  loop_end?: number;
}

export interface UserProgress {
  total_videos: number;
  total_words_saved: number;
  total_words_learned: number;
  total_study_time: number;
  streak_days: number;
  vocabulary_level: CEFRLevel;
  total_saved_words: number;
  learned_words: number;
  due_reviews: number;
  reviewed_today: number;
  active_days_30: number;
  level_distribution: Record<string, number>;
}

export interface VideoInput {
  url: string;
  quality?: string;
}

export interface SaveWordRequest {
  word: string;
  video_id?: string;
  sentence: string;
  context: string;
}

export interface ReviewRequest {
  saved_word_id: string;
  quality: number;
}

// API Response types
export interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  pages: number;
}

// WebSocket message types
export interface WSMessage {
  type: 'sync' | 'word_click' | 'segment_change' | 'word_info_request' | 'segment_updated';
  [key: string]: any;
}

// App navigation
export type AppPage = 'player' | 'vocabulary' | 'flashcards' | 'stats' | 'settings';

// Theme
export type Theme = 'dark' | 'light';