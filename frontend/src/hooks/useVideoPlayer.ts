/**
 * Hook for video player controls and transcript synchronization.
 *
 * FIXES APPLIED:
 *  - Bug #12 fix: currentTime is now written to Zustand store (setCurrentTime),
 *    so TranscriptViewer reads the same value without creating a second hook instance.
 *  - Bug #13 fix: save interval uses a ref snapshot of playerState to avoid stale closure.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { useAppStore } from '@/store/appStore';
import api from '@/services/api';
import type { TranscriptSegment } from '@/types';

export function useVideoPlayer() {
  const {
    currentVideo,
    playerState,
    updatePlayerState,
    transcript,
    setTranscript,
    setLoading,
    setError,
    // Bug #12 fix: use global currentTime
    currentTime,
    setCurrentTime,
  } = useAppStore();

  const [playerReady, setPlayerReady] = useState(false);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const playerRef = useRef<any>(null);

  // Bug #13 fix: keep a ref to the latest playerState to avoid stale closures
  const playerStateRef = useRef(playerState);
  useEffect(() => {
    playerStateRef.current = playerState;
  }, [playerState]);

  // Load transcript when video changes
  useEffect(() => {
    if (currentVideo && !transcript) {
      loadTranscript(currentVideo.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentVideo?.id]);

  const loadTranscript = async (videoId: string) => {
    try {
      const data = await api.transcripts.get(videoId);
      if (data?.segments?.length) {
        setTranscript(data);
      }
    } catch {
      // Transcript will be extracted on demand via extractTranscript()
    }
  };

  const extractTranscript = async (videoId: string) => {
    if (!videoId) {
      setError('No video selected');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await api.transcripts.extract(videoId);

      // YouTube captions found immediately
      if (data?.segments?.length) {
        setTranscript(data);
        return;
      }

      // Whisper background mode: poll until transcript is ready
      if (data?.status === 'processing') {
        const maxAttempts = 40; // 40 × 3s = 2 minutes max
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
          await new Promise((resolve) => setTimeout(resolve, 3000));
          try {
            const transcriptData = await api.transcripts.get(videoId);
            if (transcriptData?.segments?.length) {
              setTranscript(transcriptData);
              return;
            }
          } catch {
            // 404 while Whisper is still running — keep polling
          }
        }
        setError('تم بدء الاستخراج لكن لم يكتمل بعد. حاول بعد قليل.');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to extract transcript');
    } finally {
      setLoading(false);
    }
  };

  // Bug #12 fix: getCurrentSegment reads from Zustand currentTime (shared state)
  const getCurrentSegment = useCallback((): TranscriptSegment | null => {
    if (!transcript?.segments) return null;
    const t = useAppStore.getState().currentTime;
    return (
      transcript.segments.find((seg) => t >= seg.start && t <= seg.end) || null
    );
  }, [transcript]);

  // Get current word at timestamp
  const getCurrentWord = useCallback((): { word: string; start: number; end: number } | null => {
    const segment = getCurrentSegment();
    if (!segment?.words) return null;
    const t = useAppStore.getState().currentTime;
    return segment.words.find((w) => t >= w.start && t <= w.end) || null;
  }, [getCurrentSegment]);

  // Player controls
  const play = useCallback(() => {
    if (playerRef.current) {
      playerRef.current.getInternalPlayer()?.play();
      updatePlayerState({ playing: true });
    }
  }, [updatePlayerState]);

  const pause = useCallback(() => {
    if (playerRef.current) {
      playerRef.current.getInternalPlayer()?.pause();
      updatePlayerState({ playing: false });
    }
  }, [updatePlayerState]);

  const togglePlay = useCallback(() => {
    if (playerStateRef.current.playing) pause();
    else play();
  }, [play, pause]);

  const seekTo = useCallback(
    (time: number) => {
      if (playerRef.current) {
        playerRef.current.seekTo(time, 'seconds');
        updatePlayerState({ position: time });
        setCurrentTime(time);
      }
    },
    [updatePlayerState, setCurrentTime]
  );

  const setSpeed = useCallback(
    (speed: number) => {
      updatePlayerState({ speed });
    },
    [updatePlayerState]
  );

  const skipForward = useCallback(
    (seconds = 5) => {
      const t = useAppStore.getState().currentTime;
      seekTo(Math.min(t + seconds, duration));
    },
    [duration, seekTo]
  );

  const skipBackward = useCallback(
    (seconds = 5) => {
      const t = useAppStore.getState().currentTime;
      seekTo(Math.max(t - seconds, 0));
    },
    [seekTo]
  );

  // Navigate to specific segment
  const goToSegment = useCallback(
    (segment: TranscriptSegment) => {
      seekTo(segment.start);
      updatePlayerState({ current_segment: segment.index });
    },
    [seekTo, updatePlayerState]
  );

  // Loop segment
  const toggleLoop = useCallback(
    (start?: number, end?: number) => {
      const ps = playerStateRef.current;
      if (ps.loop_enabled) {
        updatePlayerState({ loop_enabled: false, loop_start: undefined, loop_end: undefined });
      } else {
        const seg = getCurrentSegment();
        const t = useAppStore.getState().currentTime;
        updatePlayerState({
          loop_enabled: true,
          loop_start: start ?? seg?.start ?? t,
          loop_end: end ?? seg?.end ?? t + 5,
        });
      }
    },
    [getCurrentSegment, updatePlayerState]
  );

  // Progress tracking — called by ReactPlayer's onProgress event
  const onProgress = useCallback(
    (state: { played: number; playedSeconds: number; loaded: number }) => {
      // Bug #12 fix: write to global store so TranscriptViewer can read it
      setCurrentTime(state.playedSeconds);
      setBuffered(state.loaded);
      updatePlayerState({ position: state.playedSeconds });

      // Update current segment index
      const seg = getCurrentSegment();
      if (seg && seg.index !== playerStateRef.current.current_segment) {
        updatePlayerState({ current_segment: seg.index });
      }

      // Handle loop
      const ps = playerStateRef.current;
      if (ps.loop_enabled && ps.loop_end != null) {
        if (state.playedSeconds >= ps.loop_end) {
          seekTo(ps.loop_start ?? 0);
        }
      }
    },
    [getCurrentSegment, updatePlayerState, setCurrentTime, seekTo]
  );

  const onDuration = useCallback((dur: number) => {
    setDuration(dur);
  }, []);

  const onReady = useCallback(() => {
    setPlayerReady(true);
  }, []);

  const onEnded = useCallback(() => {
    updatePlayerState({ playing: false });
  }, [updatePlayerState]);

  // Bug #13 fix: save player state periodically using a ref for latest state
  useEffect(() => {
    if (!currentVideo || !playerState.playing) return;

    const saveInterval = setInterval(async () => {
      try {
        // Read latest state from ref, not from closure
        await api.player.updateState(playerStateRef.current);
      } catch {
        // Silent fail — local save isn't critical
      }
    }, 10000);

    return () => clearInterval(saveInterval);
  }, [currentVideo?.id, playerState.playing]);

  return {
    // Refs
    playerRef,
    // State
    playerReady,
    currentTime,
    duration,
    buffered,
    // Transcript
    getCurrentSegment,
    getCurrentWord,
    extractTranscript,
    // Controls
    play,
    pause,
    togglePlay,
    seekTo,
    setSpeed,
    skipForward,
    skipBackward,
    goToSegment,
    toggleLoop,
    // Events
    onProgress,
    onDuration,
    onReady,
    onEnded,
    // Player state
    playing: playerState.playing,
    speed: playerState.speed,
    volume: playerState.volume,
    loopEnabled: playerState.loop_enabled,
    loopStart: playerState.loop_start,
    loopEnd: playerState.loop_end,
  };
}
