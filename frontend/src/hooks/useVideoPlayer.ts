/**
 * Video player hook — controls, transcript sync, word detection.
 * currentTime lives in Zustand so TranscriptViewer reads the same value.
 *
 * Important: the ReactPlayer ref is shared at module level so calling this hook
 * from TranscriptViewer (seek) and VideoPlayer (attach ref) controls the SAME
 * player instance.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { useAppStore } from '@/store/appStore';
import { transcriptsApi, playerApi } from '@/lib/api';
import type { TranscriptSegment } from '@/types';

const sharedPlayerRef: { current: any } = { current: null };
let transcriptProbeVideoId: string | null = null;
let sessionRestoreVideoId: string | null = null;

export function useVideoPlayer() {
  const {
    currentVideo,
    playerState, updatePlayerState,
    currentTime, setCurrentTime,
    transcript, setTranscript,
    setTranscriptStatus,
    defaultSpeed,
  } = useAppStore();

  const [duration, setDuration] = useState(0);
  const playerRef = sharedPlayerRef;
  const restoredSeekForVideoRef = useRef<string | null>(null);

  // Keep a ref of latest playerState to avoid stale closures
  const playerStateRef = useRef(playerState);
  useEffect(() => { playerStateRef.current = playerState; }, [playerState]);

  // ── Initialize local player state for each newly selected video ─────────────
  useEffect(() => {
    if (!currentVideo) return;

    const state = useAppStore.getState();
    if (state.playerState.video_id === currentVideo.id) return;

    updatePlayerState({
      video_id: currentVideo.id,
      position: 0,
      playing: false,
      speed: defaultSpeed,
      volume: 1,
      current_segment: 0,
      loop_enabled: false,
      loop_start: undefined,
      loop_end: undefined,
    });
    setCurrentTime(0);
    restoredSeekForVideoRef.current = null;
  }, [currentVideo?.id, defaultSpeed, updatePlayerState, setCurrentTime]);

  // ── Restore saved player session (position / speed / volume) ───────────────
  useEffect(() => {
    if (!currentVideo) return;
    if (sessionRestoreVideoId === currentVideo.id) return;

    sessionRestoreVideoId = currentVideo.id;

    playerApi.getState(currentVideo.id)
      .then((saved) => {
        const position = Number(saved?.position ?? saved?.last_position ?? 0);
        const speed = Number(saved?.speed ?? saved?.playback_speed ?? defaultSpeed);
        const volume = Number(saved?.volume ?? 1);

        const safePosition = Number.isFinite(position) && position > 0 ? position : 0;
        const safeSpeed = Number.isFinite(speed) && speed > 0 ? speed : defaultSpeed;
        const safeVolume = Number.isFinite(volume) && volume >= 0 ? volume : 1;

        updatePlayerState({
          video_id: currentVideo.id,
          position: safePosition,
          speed: safeSpeed,
          volume: safeVolume,
        });
        setCurrentTime(safePosition);
        restoredSeekForVideoRef.current = null;

        if (playerRef.current && safePosition > 0.25) {
          playerRef.current.seekTo(safePosition, 'seconds');
          restoredSeekForVideoRef.current = currentVideo.id;
        }
      })
      .catch(() => {
        // Fresh session — keep defaults.
      });
  }, [currentVideo?.id, defaultSpeed, playerRef, setCurrentTime, updatePlayerState]);

  // ── Reset transcript state when switching videos ────────────────────────────
  useEffect(() => {
    if (!currentVideo) return;
    const state = useAppStore.getState();
    if (state.transcript?.video_id === currentVideo.id) return;

    setTranscript(null);
    setTranscriptStatus('idle');
  }, [currentVideo?.id, setTranscript, setTranscriptStatus]);

  // ── Probe existing transcript once per video (shared across hook instances) ─
  useEffect(() => {
    if (!currentVideo) return;
    const state = useAppStore.getState();

    if (state.transcript?.video_id === currentVideo.id && state.transcript?.segments?.length) {
      setTranscriptStatus('ready');
      return;
    }

    if (transcriptProbeVideoId === currentVideo.id) return;
    transcriptProbeVideoId = currentVideo.id;
    setTranscriptStatus('loading');

    transcriptsApi.get(currentVideo.id)
      .then((data) => {
        if (data?.segments?.length) {
          setTranscript(data);
          setTranscriptStatus('ready');
        } else {
          setTranscriptStatus('idle');
        }
      })
      .catch(() => {
        setTranscriptStatus('idle');
      })
      .finally(() => {
        if (transcriptProbeVideoId === currentVideo.id) {
          transcriptProbeVideoId = null;
        }
      });
  }, [currentVideo?.id, setTranscript, setTranscriptStatus]);

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
        for (let i = 0; i < 50; i++) {
          await new Promise((r) => setTimeout(r, 3000));
          try {
            const t = await transcriptsApi.get(currentVideo.id);
            if (t?.segments?.length) {
              setTranscript(t);
              setTranscriptStatus('ready');
              return;
            }
          } catch {
            // still processing
          }
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
  }, [playerRef, updatePlayerState, setCurrentTime]);

  const setSpeed = useCallback((speed: number) => updatePlayerState({ speed }), [updatePlayerState]);
  const setVolume = useCallback((volume: number) => updatePlayerState({ volume }), [updatePlayerState]);

  const togglePlay = useCallback(() => {
    updatePlayerState({ playing: !playerStateRef.current.playing });
  }, [updatePlayerState]);

  const pause = useCallback(() => updatePlayerState({ playing: false }), [updatePlayerState]);
  const play = useCallback(() => updatePlayerState({ playing: true }), [updatePlayerState]);

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
        loop_end: end ?? seg?.end ?? t + 5,
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

    const ps = playerStateRef.current;
    if (ps.loop_enabled && ps.loop_end != null && state.playedSeconds >= ps.loop_end) {
      seekTo(ps.loop_start ?? 0);
    }
  }, [setCurrentTime, updatePlayerState, getCurrentSegment, seekTo]);

  const onDuration = useCallback((d: number) => setDuration(d), []);

  const onReady = useCallback(() => {
    if (!currentVideo || restoredSeekForVideoRef.current === currentVideo.id) return;

    const pos = Number(useAppStore.getState().playerState.position || 0);
    if (playerRef.current && pos > 0.25) {
      playerRef.current.seekTo(pos, 'seconds');
      restoredSeekForVideoRef.current = currentVideo.id;
    }
  }, [currentVideo?.id, playerRef]);

  const onEnded = useCallback(() => updatePlayerState({ playing: false }), [updatePlayerState]);

  // ── Periodic state save ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!currentVideo || !playerState.playing) return;
    const iv = setInterval(() => {
      playerApi.saveState({
        ...playerStateRef.current,
        video_id: currentVideo.id,
      }).catch(() => {});
    }, 15000);
    return () => clearInterval(iv);
  }, [currentVideo?.id, playerState.playing]);

  return {
    playerRef,
    duration,
    currentTime,
    playing: playerState.playing,
    speed: playerState.speed,
    volume: playerState.volume,
    loopEnabled: playerState.loop_enabled,
    loopStart: playerState.loop_start,
    loopEnd: playerState.loop_end,
    currentSegmentIndex: playerState.current_segment,
    extractTranscript,
    getCurrentSegment,
    getCurrentWord,
    play,
    pause,
    togglePlay,
    seekTo,
    setSpeed,
    setVolume,
    skipForward,
    skipBackward,
    goToSegment,
    repeatCurrentSegment,
    toggleLoop,
    onProgress,
    onDuration,
    onReady,
    onEnded,
  };
}
