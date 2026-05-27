/**
 * Video player hook — controls, transcript sync, word detection.
 * currentTime lives in Zustand so TranscriptViewer reads the same value.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { useAppStore } from '@/store/appStore';
import { transcriptsApi, playerApi } from '@/lib/api';
import type { TranscriptSegment } from '@/types';

export function useVideoPlayer() {
  const {
    currentVideo,
    playerState, updatePlayerState,
    currentTime, setCurrentTime,
    transcript, setTranscript,
    transcriptStatus, setTranscriptStatus,
    autoPauseOnWord,
  } = useAppStore();

  const [duration, setDuration] = useState(0);
  const playerRef = useRef<any>(null);

  // Keep a ref of latest playerState to avoid stale closures
  const playerStateRef = useRef(playerState);
  useEffect(() => { playerStateRef.current = playerState; }, [playerState]);

  // ── Load transcript when video changes ──────────────────────────────────────
  useEffect(() => {
    if (!currentVideo) return;
    // Reset on new video
    useAppStore.getState().setTranscriptStatus('idle');
    useAppStore.getState().setTranscript(null);

    transcriptsApi.get(currentVideo.id)
      .then((data) => {
        if (data?.segments?.length) {
          setTranscript(data);
          setTranscriptStatus('ready');
        }
      })
      .catch(() => {/* will extract on demand */});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentVideo?.id]);

  // ── Extract transcript ──────────────────────────────────────────────────────
  const extractTranscript = useCallback(async () => {
    if (!currentVideo) return;
    setTranscriptStatus('loading');
    try {
      const data = await transcriptsApi.extract(currentVideo.id);

      if (data?.segments?.length) {
        setTranscript(data);
        setTranscriptStatus('ready');
        return;
      }

      if (data?.status === 'processing') {
        setTranscriptStatus('processing');
        // Poll until ready
        for (let i = 0; i < 50; i++) {
          await new Promise((r) => setTimeout(r, 3000));
          try {
            const t = await transcriptsApi.get(currentVideo.id);
            if (t?.segments?.length) {
              setTranscript(t);
              setTranscriptStatus('ready');
              return;
            }
          } catch { /* still processing */ }
        }
        setTranscriptStatus('error');
      } else {
        setTranscriptStatus('error');
      }
    } catch {
      setTranscriptStatus('error');
    }
  }, [currentVideo, setTranscript, setTranscriptStatus]);

  // ── Segment lookup ──────────────────────────────────────────────────────────
  const getCurrentSegment = useCallback((): TranscriptSegment | null => {
    const { transcript: t, currentTime: ct } = useAppStore.getState();
    if (!t?.segments) return null;
    return t.segments.find((s) => ct >= s.start && ct <= s.end) ?? null;
  }, []);

  const getCurrentWord = useCallback(() => {
    const seg = getCurrentSegment();
    if (!seg?.words?.length) return null;
    const ct = useAppStore.getState().currentTime;
    return seg.words.find((w) => ct >= w.start && ct <= w.end) ?? null;
  }, [getCurrentSegment]);

  // ── Player controls ─────────────────────────────────────────────────────────
  const seekTo = useCallback((time: number) => {
    playerRef.current?.seekTo(time, 'seconds');
    updatePlayerState({ position: time });
    setCurrentTime(time);
  }, [updatePlayerState, setCurrentTime]);

  const setSpeed  = useCallback((speed: number)  => updatePlayerState({ speed }),  [updatePlayerState]);
  const setVolume = useCallback((volume: number) => updatePlayerState({ volume }), [updatePlayerState]);

  const togglePlay = useCallback(() => {
    updatePlayerState({ playing: !playerStateRef.current.playing });
  }, [updatePlayerState]);

  const pause = useCallback(() => updatePlayerState({ playing: false }), [updatePlayerState]);
  const play  = useCallback(() => updatePlayerState({ playing: true  }), [updatePlayerState]);

  const skipForward = useCallback((s = 5) => {
    const t = useAppStore.getState().currentTime;
    seekTo(Math.min(t + s, duration));
  }, [duration, seekTo]);

  const skipBackward = useCallback((s = 5) => {
    const t = useAppStore.getState().currentTime;
    seekTo(Math.max(t - s, 0));
  }, [seekTo]);

  const goToSegment = useCallback((seg: TranscriptSegment) => {
    seekTo(seg.start);
    updatePlayerState({ current_segment: seg.index });
  }, [seekTo, updatePlayerState]);

  const repeatCurrentSegment = useCallback(() => {
    const seg = getCurrentSegment();
    if (seg) seekTo(seg.start);
  }, [getCurrentSegment, seekTo]);

  const toggleLoop = useCallback((start?: number, end?: number) => {
    const ps = playerStateRef.current;
    if (ps.loop_enabled) {
      updatePlayerState({ loop_enabled: false, loop_start: undefined, loop_end: undefined });
    } else {
      const seg = getCurrentSegment();
      const t = useAppStore.getState().currentTime;
      updatePlayerState({
        loop_enabled: true,
        loop_start: start ?? seg?.start ?? t,
        loop_end:   end   ?? seg?.end   ?? t + 5,
      });
    }
  }, [getCurrentSegment, updatePlayerState]);

  // ── ReactPlayer event handlers ──────────────────────────────────────────────
  const onProgress = useCallback((state: { playedSeconds: number; loaded: number }) => {
    setCurrentTime(state.playedSeconds);
    updatePlayerState({ position: state.playedSeconds });

    const seg = getCurrentSegment();
    if (seg && seg.index !== playerStateRef.current.current_segment) {
      updatePlayerState({ current_segment: seg.index });
    }

    // Loop enforcement
    const ps = playerStateRef.current;
    if (ps.loop_enabled && ps.loop_end != null && state.playedSeconds >= ps.loop_end) {
      seekTo(ps.loop_start ?? 0);
    }
  }, [setCurrentTime, updatePlayerState, getCurrentSegment, seekTo]);

  const onDuration = useCallback((d: number) => setDuration(d), []);
  const onReady    = useCallback(() => {}, []);
  const onEnded    = useCallback(() => updatePlayerState({ playing: false }), [updatePlayerState]);

  // ── Periodic state save ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!currentVideo || !playerState.playing) return;
    const iv = setInterval(() => {
      playerApi.saveState(playerStateRef.current).catch(() => {});
    }, 15000);
    return () => clearInterval(iv);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentVideo?.id, playerState.playing]);

  return {
    playerRef,
    duration,
    currentTime,
    playing:            playerState.playing,
    speed:              playerState.speed,
    volume:             playerState.volume,
    loopEnabled:        playerState.loop_enabled,
    loopStart:          playerState.loop_start,
    loopEnd:            playerState.loop_end,
    currentSegmentIndex: playerState.current_segment,
    // Transcript
    extractTranscript,
    getCurrentSegment,
    getCurrentWord,
    // Controls
    play, pause, togglePlay,
    seekTo, setSpeed, setVolume,
    skipForward, skipBackward,
    goToSegment, repeatCurrentSegment,
    toggleLoop,
    // Events
    onProgress, onDuration, onReady, onEnded,
  };
}
