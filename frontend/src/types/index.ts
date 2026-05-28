// ─── Core Domain Types ────────────────────────────────────────────────────────

export type VideoQuality =
  | 'auto'
  | 'tiny'
  | 'small'
  | 'medium'
  | 'large'
  | 'hd720'
  | 'hd1080'
  | 'highres';

export type TranscriptFontSize = 'sm' | 'md' | 'lg' | 'xl';

export interface User {
  id: string;
  username: string;
  email?: string;
  display_name: string;
  avatar_color: string;
  streak_days: number;
  created_at?: string;
  last_login?: string;
}

export interface Video {
  id: string;
  youtube_id: string;
  title: string;
  channel: string;
  duration: number;
  thumbnail_url: string;
  description?: string;
  status: 'pending' | 'processing' | 'downloaded' | 'ready' | 'error';
  created_at?: string;
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
  word_timings?: Record<string, { start: number; end: number; segment_index: number }>;
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
  root_form?: string;
  conjugations?: Record<string, string>;
  related_words?: string[];
  frequency?: number;
}

export type CEFRLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';

export interface SavedWord {
  id: string;
  word_id: string;
  word: string;
  pronunciation?: string;
  part_of_speech?: string;
  meaning_ar?: string;
  meaning_en?: string;
  level?: CEFRLevel;
  examples?: string[];
  video_id?: string;
  sentence?: string;
  context?: string;
  status: 'learning' | 'reviewing' | 'learned';
  ease_factor?: number;
  interval?: number;
  repetitions?: number;
  next_review?: string;
  last_reviewed?: string;
  created_at?: string;
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
  quality?: VideoQuality;
}

export interface UserProgress {
  total: number;
  learning: number;
  learned: number;
  due: number;
  reviewed_today: number;
  active_days_30: number;
  level_distribution?: Record<string, number>;
  streak_days?: number;
}

// ─── App Navigation ───────────────────────────────────────────────────────────
export type AppPage =
  | 'home'
  | 'player'
  | 'vocabulary'
  | 'flashcards'
  | 'stats'
  | 'settings'
  | 'profile'
  | 'login'
  | 'register';

export type Theme = 'dark' | 'light';

// ─── Auth ─────────────────────────────────────────────────────────────────────
export interface AuthResponse {
  token: string;
  user: User;
}
