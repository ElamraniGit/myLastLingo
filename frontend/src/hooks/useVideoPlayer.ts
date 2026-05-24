/**
 * Hook for video player controls and transcript synchronization.
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
    setCurrentPage,
  } = useAppStore();

  const [playerReady, setPlayerReady] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const playerRef = useRef<any>(null);
  const progressInterval = useRef<NodeJS.Timeout | null>(null);

  // Load transcript when video changes
  useEffect(() => {
    if (currentVideo && !transcript) {
      loadTranscript(currentVideo.id);
    }
  }, [currentVideo?.id]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (progressInterval.current) {
        clearInterval(progressInterval.current);
      }
    };
  }, []);

  const loadTranscript = async (videoId: string) => {
    try {
      const data = await api.transcripts.get(videoId);
      setTranscript(data);
    } catch {
      // Transcript will be extracted on demand
      console.log('No transcript yet, extract when playing');
    }
  };

  const extractTranscript = async (videoId: string) => {
    setLoading(true);
    try {
      const data = await api.transcripts.extract(videoId);
      if (data.segments) {
        setTranscript(data);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to extract transcript');
    } finally {
      setLoading(false);
    }
  };

  // Get current segment based on time
  const getCurrentSegment = useCallback((): TranscriptSegment | null => {
    if (!transcript?.segments) return null;
    return (
      transcript.segments.find(
        (seg) => currentTime >= seg.start && currentTime <= seg.end
      ) || null
    );
  }, [transcript, currentTime]);

  // Get current word at timestamp
  const getCurrentWord = useCallback((): { word: string; start: number; end: number } | null => {
    const segment = getCurrentSegment();
    if (!segment?.words) return null;

    return (
      segment.words.find(
        (w) => currentTime >= w.start && currentTime <= w.end
      ) || null
    );
  }, [getCurrentSegment, currentTime]);

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
    if (playerState.playing) pause();
    else play();
  }, [playerState.playing, play, pause]);

  const seekTo = useCallback(
    (time: number) => {
      if (playerRef.current) {
        playerRef.current.seekTo(time, 'seconds');
        updatePlayerState({ position: time });
        setCurrentTime(time);
      }
    },
    [updatePlayerState]
  );

  const setSpeed = useCallback(
    (speed: number) => {
      updatePlayerState({ speed });
    },
    [updatePlayerState]
  );

  const skipForward = useCallback(
    (seconds = 5) => {
      seekTo(Math.min(currentTime + seconds, duration));
    },
    [currentTime, duration, seekTo]
  );

  const skipBackward = useCallback(
    (seconds = 5) => {
      seekTo(Math.max(currentTime - seconds, 0));
    },
    [currentTime, seekTo]
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
      if (playerState.loop_enabled) {
        updatePlayerState({
          loop_enabled: false,
          loop_start: undefined,
          loop_end: undefined,
        });
      } else {
        const seg = getCurrentSegment();
        updatePlayerState({
          loop_enabled: true,
          loop_start: start || seg?.start || currentTime,
          loop_end: end || seg?.end || currentTime + 5,
        });
      }
    },
    [playerState.loop_enabled, getCurrentSegment, currentTime, updatePlayerState]
  );

  // Progress tracking
  const onProgress = useCallback(
    (state: { played: number; playedSeconds: number; loaded: number }) => {
      setCurrentTime(state.playedSeconds);
      setBuffered(state.loaded);
      updatePlayerState({ position: state.playedSeconds });

      // Update current segment
      const seg = getCurrentSegment();
      if (seg && seg.index !== playerState.current_segment) {
        updatePlayerState({ current_segment: seg.index });
      }

      // Handle loop
      if (playerState.loop_enabled && playerState.loop_end) {
        if (state.playedSeconds >= playerState.loop_end) {
          seekTo(playerState.loop_start || 0);
        }
      }
    },
    [getCurrentSegment, playerState.current_segment, playerState.loop_enabled, playerState.loop_start, playerState.loop_end, updatePlayerState, seekTo]
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

  // Save player state periodically
  useEffect(() => {
    if (!currentVideo || !playerState.playing) return;

    const saveInterval = setInterval(async () => {
      try {
        await api.player.updateState(playerState);
      } catch {
        // Silent fail
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