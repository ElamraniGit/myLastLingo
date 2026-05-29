/**
 * Global Zustand store — single source of truth.
 * Exported as both `useStore` (new name used by all components)
 * and `useAppStore` (alias for backward compat with useVideoPlayer.ts).
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type {
  User,
  Video,
  Transcript,
  PlayerState,
  SavedWord,
  Word,
  AppPage,
  Theme,
  UserProgress,
  VideoQuality,
  TranscriptFontSize,
} from '@/types';

interface AppState {
  // ── Auth ──────────────────────────────────────────────────────────────────
  user: User | null;
  isAuthenticated: boolean;
  setUser: (user: User | null) => void;
  logout: () => void;

  // ── Navigation ────────────────────────────────────────────────────────────
  currentPage: AppPage;
  setPage: (page: AppPage) => void;
  /** @deprecated use setPage */
  setCurrentPage: (page: AppPage) => void;

  // ── Theme ─────────────────────────────────────────────────────────────────
  theme: Theme;
  toggleTheme: () => void;

  // ── Video / Player ────────────────────────────────────────────────────────
  currentVideo: Video | null;
  setCurrentVideo: (video: Video | null) => void;

  recentVideos: Video[];
  addRecentVideo: (video: Video) => void;

  /** @deprecated use recentVideos */
  videos: Video[];
  setVideos: (videos: Video[]) => void;
  addVideo: (video: Video) => void;

  playerState: PlayerState;
  updatePlayerState: (patch: Partial<PlayerState>) => void;

  /** Shared playback time — written by player, read by TranscriptViewer */
  currentTime: number;
  setCurrentTime: (t: number) => void;

  transcript: Transcript | null;
  setTranscript: (t: Transcript | null) => void;

  transcriptLoading: boolean;
  setTranscriptLoading: (v: boolean) => void;

  transcriptStatus: 'idle' | 'loading' | 'processing' | 'ready' | 'error';
  setTranscriptStatus: (s: AppState['transcriptStatus']) => void;

  // ── Word popup ────────────────────────────────────────────────────────────
  selectedWord: Word | null;
  setSelectedWord: (w: Word | null) => void;

  wordPopupOpen: boolean;
  setWordPopupOpen: (v: boolean) => void;

  /** Whether the player should resume automatically after closing the popup */
  resumeAfterWordPopup: boolean;
  setResumeAfterWordPopup: (v: boolean) => void;

  /** @deprecated use wordPopupOpen */
  wordModalOpen: boolean;
  setWordModalOpen: (v: boolean) => void;

  wordPopupSentence: string;
  setWordPopupSentence: (s: string) => void;

  // ── Vocabulary ────────────────────────────────────────────────────────────
  savedWords: SavedWord[];
  setSavedWords: (words: SavedWord[]) => void;
  addSavedWord: (word: SavedWord) => void;

  dueWords: SavedWord[];
  setDueWords: (words: SavedWord[]) => void;

  progress: UserProgress | null;
  setProgress: (p: UserProgress | null) => void;

  // ── UI ────────────────────────────────────────────────────────────────────
  loading: boolean;
  setLoading: (v: boolean) => void;

  error: string | null;
  setError: (e: string | null) => void;
  clearError: () => void;

  sidebarOpen: boolean;
  setSidebarOpen: (v: boolean) => void;

  navOpen: boolean;
  setNavOpen: (v: boolean) => void;

  playerFloating: boolean;
  setPlayerFloating: (v: boolean) => void;

  // ── Settings ──────────────────────────────────────────────────────────────
  defaultSpeed: number;
  setDefaultSpeed: (s: number) => void;

  defaultVideoQuality: VideoQuality;
  setDefaultVideoQuality: (q: VideoQuality) => void;

  transcriptFontSize: TranscriptFontSize;
  setTranscriptFontSize: (s: TranscriptFontSize) => void;

  autoPauseOnWord: boolean;
  setAutoPauseOnWord: (v: boolean) => void;

  // ── Actions ───────────────────────────────────────────────────────────────
  resetPlayer: () => void;
}

const initialPlayerState: PlayerState = {
  video_id: '',
  position: 0,
  playing: false,
  speed: 1.0,
  volume: 1.0,
  current_segment: 0,
  loop_enabled: false,
  quality: 'auto',
};

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      // ── Auth ────────────────────────────────────────────────────────────
      user: null,
      isAuthenticated: false,
      setUser: (user) => set({ user, isAuthenticated: !!user }),
      logout: () => {
        if (typeof window !== 'undefined') localStorage.removeItem('ll_token');
        set({ user: null, isAuthenticated: false, currentPage: 'login' });
      },

      // ── Navigation ──────────────────────────────────────────────────────
      currentPage: 'login',
      setPage: (page) => set({ currentPage: page }),
      setCurrentPage: (page) => set({ currentPage: page }),

      // ── Theme ────────────────────────────────────────────────────────────
      theme: 'auto',
      toggleTheme: () =>
        set((s) => ({
          theme: s.theme === 'auto' ? 'dark' : s.theme === 'dark' ? 'light' : 'auto',
        })),

      // ── Video / Player ───────────────────────────────────────────────────
      currentVideo: null,
      setCurrentVideo: (video) => set({ currentVideo: video }),

      recentVideos: [],
      addRecentVideo: (video) =>
        set((s) => ({
          recentVideos: [
            video,
            ...s.recentVideos.filter((v) => v.id !== video.id),
          ].slice(0, 20),
        })),

      videos: [],
      setVideos: (videos) => set({ videos }),
      addVideo: (video) =>
        set((s) => ({
          videos: [video, ...s.videos.filter((v) => v.id !== video.id)],
        })),

      playerState: initialPlayerState,
      updatePlayerState: (patch) =>
        set((s) => ({ playerState: { ...s.playerState, ...patch } })),

      currentTime: 0,
      setCurrentTime: (t) => set({ currentTime: t }),

      transcript: null,
      setTranscript: (t) => set({ transcript: t }),

      transcriptLoading: false,
      setTranscriptLoading: (v) => set({ transcriptLoading: v }),

      transcriptStatus: 'idle',
      setTranscriptStatus: (s) => set({ transcriptStatus: s }),

      // ── Word popup ───────────────────────────────────────────────────────
      selectedWord: null,
      setSelectedWord: (w) => set({ selectedWord: w }),

      wordPopupOpen: false,
      setWordPopupOpen: (v) => set({ wordPopupOpen: v, wordModalOpen: v }),

      resumeAfterWordPopup: false,
      setResumeAfterWordPopup: (v) => set({ resumeAfterWordPopup: v }),

      wordModalOpen: false,
      setWordModalOpen: (v) => set({ wordModalOpen: v, wordPopupOpen: v }),

      wordPopupSentence: '',
      setWordPopupSentence: (s) => set({ wordPopupSentence: s }),

      // ── Vocabulary ───────────────────────────────────────────────────────
      savedWords: [],
      setSavedWords: (words) => set({ savedWords: words }),
      addSavedWord: (word) =>
        set((s) => ({ savedWords: [word, ...s.savedWords] })),

      dueWords: [],
      setDueWords: (words) => set({ dueWords: words }),

      progress: null,
      setProgress: (p) => set({ progress: p }),

      // ── UI ───────────────────────────────────────────────────────────────
      loading: false,
      setLoading: (v) => set({ loading: v }),

      error: null,
      setError: (e) => set({ error: e }),
      clearError: () => set({ error: null }),

      sidebarOpen: false,
      setSidebarOpen: (v) => set({ sidebarOpen: v }),

      navOpen: false,
      setNavOpen: (v) => set({ navOpen: v }),

      playerFloating: false,
      setPlayerFloating: (v) => set({ playerFloating: v }),

      // ── Settings ─────────────────────────────────────────────────────────
      defaultSpeed: 1.0,
      setDefaultSpeed: (s) => set({ defaultSpeed: s }),

      defaultVideoQuality: 'auto',
      setDefaultVideoQuality: (q) => set({ defaultVideoQuality: q }),

      transcriptFontSize: 'md',
      setTranscriptFontSize: (s) => set({ transcriptFontSize: s }),

      autoPauseOnWord: true,
      setAutoPauseOnWord: (v) => set({ autoPauseOnWord: v }),

      // ── Actions ──────────────────────────────────────────────────────────
      resetPlayer: () =>
        set({
          currentVideo: null,
          playerState: initialPlayerState,
          transcript: null,
          currentTime: 0,
          transcriptStatus: 'idle',
          resumeAfterWordPopup: false,
        }),
    }),
    {
      name: 'll-store-v2',
      storage: createJSONStorage(() =>
        typeof window !== 'undefined' ? localStorage : ({} as Storage)
      ),
      partialize: (s) => ({
        user: s.user,
        isAuthenticated: s.isAuthenticated,
        theme: s.theme,
        recentVideos: s.recentVideos,
        savedWords: s.savedWords,
        progress: s.progress,
        defaultSpeed: s.defaultSpeed,
        defaultVideoQuality: s.defaultVideoQuality,
        transcriptFontSize: s.transcriptFontSize,
        autoPauseOnWord: s.autoPauseOnWord,
      }),
    }
  )
);

/** Backward-compat alias — useVideoPlayer.ts uses this name */
export const useAppStore = useStore;
