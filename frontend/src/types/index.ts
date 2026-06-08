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
export type TranscriptHighlightMode = 'sentence' | 'word' | 'smart';

export interface User {
  id: string;
  username: string;
  email?: string;
  display_name: string;
  avatar_color: string;
  avatar_url?: string | null;
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

export interface WordDefinition {
  part_of_speech: string;
  definition: string;
  example: string;
}

export interface AIGrammarBreakdownItem {
  label: string;
  value: string;
}

export interface AIMeaningItem {
  rank: number;
  arabic: string;
  english_simple: string;
  english_advanced: string;
  context: string;
  register: string;
}

export interface AIGrammarAnalysis {
  summary: string;
  base_form: string;
  form_type: string;
  tense: string;
  aspect: string;
  voice: string;
  sentence_type: string;
  subject: string;
  verb: string;
  object: string;
  number: string;
  comparison_type: string;
  irregularity: string;
  used_with: string[];
  notes: string[];
  inflected_forms: Record<string, string>;
  breakdown: AIGrammarBreakdownItem[];
}

export interface AIRelationItem {
  term: string;
  short_definition: string;
  commonness: string;
}

export interface AIExampleItem {
  english: string;
  arabic: string;
  difficulty: CEFRLevel;
  register: string;
  focus: string;
}

export interface AICommonPhraseItem {
  expression: string;
  meaning: string;
  translation: string;
  example: string;
}

export interface AIPhrasalVerbItem {
  phrasal_verb: string;
  meaning: string;
  translation: string;
  example: string;
}

export interface AICollocationItem {
  expression: string;
  pattern: string;
  meaning: string;
  translation: string;
}

export interface AIWordFamilyItem {
  term: string;
  part_of_speech: string;
  meaning: string;
}

export interface AICommonMistakeItem {
  mistake: string;
  correction: string;
  explanation: string;
}

export interface AIEntryPayload {
  term: string;
  language?: string;
  entry_type?: 'word' | 'phrase' | 'expression' | 'idiom' | 'sentence';
  translation?: string;
  pronunciation?: string;
  part_of_speech?: string;
  part_of_speech_explanation?: string;
  cefr_level?: CEFRLevel;
  frequency_score?: number;
  frequency_label?: string;
  meanings?: AIMeaningItem[];
  word_explanation?: string;
  grammar_analysis?: AIGrammarAnalysis;
  example_details?: AIExampleItem[];
  synonym_details?: AIRelationItem[];
  antonym_details?: AIRelationItem[];
  collocation_details?: AICollocationItem[];
  common_phrases?: AICommonPhraseItem[];
  phrasal_verbs?: AIPhrasalVerbItem[];
  word_family?: AIWordFamilyItem[];
  common_mistakes?: AICommonMistakeItem[];
  teaching_notes?: string[];
  confidence?: number;
}

export interface Word {
  id: string;
  word: string;
  pronunciation: string;
  part_of_speech: string;
  level: CEFRLevel;
  meaning_ar: string;
  meaning_en: string;
  definitions?: WordDefinition[];
  how_to_use?: string[];
  usage_notes?: string;
  grammar_notes?: string | string[];
  examples: string[];
  synonyms: string[];
  antonyms: string[];
  collocations?: string[];
  root_form?: string;
  conjugations?: Record<string, string>;
  related_words?: string[];
  entry_type?: 'word' | 'phrase' | 'expression' | 'idiom' | 'sentence';
  difficulty_score?: number;
  priority_score?: number;
  frequency?: number;
  ai_enriched?: boolean;
  _ai_entry?: AIEntryPayload;
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
  synonyms?: string[];
  antonyms?: string[];
  definitions?: WordDefinition[];
  how_to_use?: string[];
  usage_notes?: string;
  grammar_notes?: string;
  collocations?: string[];
  conjugations?: Record<string, string>;
  root_form?: string;
  related_words?: string[];
  entry_type?: 'word' | 'phrase' | 'expression' | 'idiom' | 'sentence';
  difficulty_score?: number;
  priority_score?: number;
  video_id?: string;
  source_video_title?: string;
  source_video_channel?: string;
  sentence?: string;
  context?: string;
  notes?: string;
  tags?: string[];
  favorite?: boolean;
  status: 'learning' | 'reviewing' | 'learned';
  ease_factor?: number;
  interval?: number;
  repetitions?: number;
  learning_step?: number;
  lapses?: number;
  reviewed_count?: number;
  last_quality?: number;
  next_review?: string;
  last_reviewed?: string;
  created_at?: string;
  ai_enriched?: boolean;
  _ai_entry?: AIEntryPayload;
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

export interface VocabularyListParams {
  status?: 'learning' | 'reviewing' | 'learned';
  page?: number;
  limit?: number;
  search?: string;
  level?: string;
  video_id?: string;
  due_only?: boolean;
  tag?: string;
  favorite_only?: boolean;
  sort?: 'next_review' | 'newest' | 'oldest' | 'alphabetical' | 'level' | 'difficulty';
}

export interface VocabularyFacetData {
  levels: Array<{ level: string; count: number }>;
  videos: Array<{ video_id: string; title: string; channel?: string; count: number }>;
  tags: Array<{ tag: string; count: number }>;
}

export interface UserProgress {
  total: number;
  learning: number;
  reviewing?: number;
  learned: number;
  due: number;
  never_reviewed?: number;
  favorite_count?: number;
  total_reviews?: number;
  total_lapses?: number;
  avg_ease?: number;
  reviewed_today: number;
  active_days_30: number;
  level_distribution?: Record<string, number>;
  recent_quality_breakdown?: Record<string, number>;
  upcoming_review_days?: Record<string, number>;
  hardest_words?: Array<{
    word: string;
    status: string;
    lapses: number;
    reviewed_count: number;
    next_review?: string;
  }>;
  top_tags?: Array<{ tag: string; count: number }>;
  streak_days?: number;
}

export interface ReviewSummary {
  total_saved: number;
  learning: number;
  reviewing: number;
  learned: number;
  never_reviewed: number;
  due_now: number;
}

export interface ReviewHistoryItem {
  id: string;
  saved_word_id: string;
  quality: number;
  reviewed_at: string;
}

// ─── App Navigation ───────────────────────────────────────────────────────────
export type AppPage =
  | 'home'
  | 'player'
  | 'vocabulary'
  | 'flashcards'
  | 'games'
  | 'worddetail'
  | 'stats'
  | 'core'
  | 'settings'
  | 'library'
  | 'chat'
  | 'textreader'
  | 'profile'
  | 'login'
  | 'register';

export type Theme = 'auto' | 'dark' | 'light';

// ─── Auth ─────────────────────────────────────────────────────────────────────
export interface AuthResponse {
  token: string;
  user: User;
}
