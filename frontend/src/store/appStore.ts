/**
 * Global state management using Zustand.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  Video,
  Transcript,
  PlayerState,
  SavedWord,
  UserProgress,
  Word,
  AppPage,
  Theme,
} from '@/types';

interface AppState {
  // Navigation
  currentPage: AppPage;
  setCurrentPage: (page: AppPage) => void;

  // Theme
  theme: Theme;
  toggleTheme: () => void;

  // Video & Player
  currentVideo: Video | null;
  setCurrentVideo: (video: Video | null) => void;
  playerState: PlayerState;
  updatePlayerState: (state: Partial<PlayerState>) => void;
  transcript: Transcript | null;
  setTranscript: (transcript: Transcript | null) => void;

  // Current word lookup
  selectedWord: Word | null;
  setSelectedWord: (word: Word | null) => void;
  wordModalOpen: boolean;
  setWordModalOpen: (open: boolean) => void;

  // Video list
  videos: Video[];
  setVideos: (videos: Video[]) => void;
  addVideo: (video: Video) => void;

  // Vocabulary
  savedWords: SavedWord[];
  setSavedWords: (words: SavedWord[]) => void;
  addSavedWord: (word: SavedWord) => void;
  dueWords: SavedWord[];
  setDueWords: (words: SavedWord[]) => void;

  // Progress
  progress: UserProgress | null;
  setProgress: (progress: UserProgress | null) => void;

  // UI state
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  playerFloating: boolean;
  setPlayerFloating: (floating: boolean) => void;
  loading: boolean;
  setLoading: (loading: boolean) => void;
  error: string | null;
  setError: (error: string | null) => void;

  // Actions
  clearError: () => void;
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
};

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Navigation
      currentPage: 'player',
      setCurrentPage: (page) => set({ currentPage: page }),

      // Theme
      theme: 'dark',
      toggleTheme: () =>
        set((state) => ({
          theme: state.theme === 'dark' ? 'light' : 'dark',
        })),

      // Video & Player
      currentVideo: null,
      setCurrentVideo: (video) => set({ currentVideo: video }),
      playerState: initialPlayerState,
      updatePlayerState: (state) =>
        set((prev) => ({
          playerState: { ...prev.playerState, ...state },
        })),
      transcript: null,
      setTranscript: (transcript) => set({ transcript }),

      // Current word lookup
      selectedWord: null,
      setSelectedWord: (word) => set({ selectedWord: word }),
      wordModalOpen: false,
      setWordModalOpen: (open) => set({ wordModalOpen: open }),

      // Video list
      videos: [],
      setVideos: (videos) => set({ videos }),
      addVideo: (video) =>
        set((state) => ({
          videos: [video, ...state.videos.filter((v) => v.id !== video.id)],
        })),

      // Vocabulary
      savedWords: [],
      setSavedWords: (words) => set({ savedWords: words }),
      addSavedWord: (word) =>
        set((state) => ({
          savedWords: [word, ...state.savedWords],
        })),
      dueWords: [],
      setDueWords: (words) => set({ dueWords: words }),

      // Progress
      progress: null,
      setProgress: (progress) => set({ progress }),

      // UI state
      sidebarOpen: false,
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      playerFloating: false,
      setPlayerFloating: (floating) => set({ playerFloating: floating }),
      loading: false,
      setLoading: (loading) => set({ loading }),
      error: null,
      setError: (error) => set({ error }),

      // Actions
      clearError: () => set({ error: null }),
      resetPlayer: () =>
        set({
          currentVideo: null,
          playerState: initialPlayerState,
          transcript: null,
        }),
    }),
    {
      name: 'lingualearn-storage',
      partialize: (state) => ({
        theme: state.theme,
        savedWords: state.savedWords,
        progress: state.progress,
        videos: state.videos,
      }),
    }
  )
);