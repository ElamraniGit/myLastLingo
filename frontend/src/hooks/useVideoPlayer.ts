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
import type { TranscriptSegment, VideoQuality } from '@/types';

const sharedPlayerRef: { current: any } = { current: null };
let transcriptProbeVideoId: string | null = null;
let sessionRestoreVideoId: string | null = null;

const VIDEO_QUALITY_ORDER: VideoQuality[] = [
  'auto',
  'highres',
  'hd1080',
  'hd720',
  'large',
  'medium',
  'small',
  'tiny',
];

function normalizeQualityFromYoutube(value?: string | null): VideoQuality {
  if (!value || value === 'default') return 'auto';
  if (VIDEO_QUALITY_ORDER.includes(value as VideoQuality)) {
    return value as VideoQuality;
  }
  return 'auto';
}

function normalizeQualityForYoutube(value: VideoQuality): string {
  return value === 'auto' ? 'default' : value;
}

function getInternalPlayer(playerRef: { current: any }) {
  return playerRef.current?.getInternalPlayer?.() ?? null;
}

function sortQualities(values: VideoQuality[]): VideoQuality[] {
  return [...new Set(values)].sort(
    (a, b) => VIDEO_QUALITY_ORDER.indexOf(a) - VIDEO_QUALITY_ORDER.indexOf(b)
  );
}

export function useVideoPlayer() {
  const {
    currentVideo,
    playerState, updatePlayerState,
    currentTime, setCurrentTime,
    setTranscript,
    setTranscriptStatus,
    defaultSpeed,
    defaultVideoQuality,
  } = useAppStore();

  const [duration, setDuration] = useState(0);
  const [availableQualities, setAvailableQualities] = useState<VideoQuality[]>(['auto', 'hd720', 'medium']);
  const playerRef = sharedPlayerRef;
  const restoredSeekForVideoRef = useRef<string | null>(null);

  const playerStateRef = useRef(playerState);
  useEffect(() => { playerStateRef.current = playerState; }, [playerState]);

  const currentQuality: VideoQuality = playerState.quality ?? defaultVideoQuality;

  const refreshAvailableQualities = useCallback(() => {
    const internal = getInternalPlayer(playerRef);
    const levels = internal?.getAvailableQualityLevels?.();
    if (!Array.isArray(levels) || levels.length === 0) {
      setAvailableQualities(sortQualities(['auto', currentQuality, defaultVideoQuality]));
      return;
    }

    const normalized = levels.map((q: string) => normalizeQualityFromYoutube(q));
    setAvailableQualities(sortQualities(['auto', ...normalized]));
  }, [playerRef, currentQuality, defaultVideoQuality]);

  const applyQualityPreference = useCallback((quality: VideoQuality) => {
    const internal = getInternalPlayer(playerRef);
    if (!internal) return;

    const ytQuality = normalizeQualityForYoutube(quality);
    try {
      if (typeof internal.setPlaybackQualityRange === 'function') {
        internal.setPlaybackQualityRange(ytQuality);
      }
      if (typeof internal.setPlaybackQuality === 'function') {
        internal.setPlaybackQuality(ytQuality);
      }
    } catch {
      // Ignore unsupported environments safely.
    }
  }, [playerRef]);

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
      quality: defaultVideoQuality,
    });
    setCurrentTime(0);
    restoredSeekForVideoRef.current = null;
  }, [currentVideo?.id, defaultSpeed, defaultVideoQuality, updatePlayerState, setCurrentTime]);

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
          quality: useAppStore.getState().playerState.quality ?? defaultVideoQuality,
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
  }, [currentVideo?.id, defaultSpeed, defaultVideoQuality, playerRef, setCurrentTime, updatePlayerState]);

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

  useEffect(() => {
    if (!currentVideo) return;
    const timer = setTimeout(() => {
      applyQualityPreference(currentQuality);
      refreshAvailableQualities();
    }, 250);
    return () => clearTimeout(timer);
  }, [currentVideo?.id, currentQuality, applyQualityPreference, refreshAvailableQualities]);

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

  const getCurrentSegment = useCallback((time?: number): TranscriptSegment | null => {
    const state = useAppStore.getState();
    const ct = typeof time === 'number' ? time : state.currentTime;
    const transcript = state.transcript;
    if (!transcript?.segments) return null;
    return transcript.segments.find((s) => ct >= s.start && ct <= s.end) ?? null;
  }, []);

  const getCurrentWord = useCallback((time?: number) => {
    const seg = getCurrentSegment(time);
    if (!seg?.words?.length) return null;
    const ct = typeof time === 'number' ? time : useAppStore.getState().currentTime;
    return seg.words.find((w) => ct >= w.start - 0.05 && ct <= w.end + 0.06) ?? null;
  }, [getCurrentSegment]);

  const syncPlaybackState = useCallback((time: number) => {
    if (!Number.isFinite(time)) return;
    const rounded = Math.max(0, time);
    setCurrentTime(rounded);
    updatePlayerState({ position: rounded });

    const seg = getCurrentSegment(rounded);
    if (seg && seg.index !== playerStateRef.current.current_segment) {
      updatePlayerState({ current_segment: seg.index });
    }

    const ps = playerStateRef.current;
    if (ps.loop_enabled && ps.loop_end != null && rounded >= ps.loop_end) {
      const loopStart = ps.loop_start ?? 0;
      playerRef.current?.seekTo(loopStart, 'seconds');
      setCurrentTime(loopStart);
      updatePlayerState({ position: loopStart });
    }
  }, [getCurrentSegment, playerRef, setCurrentTime, updatePlayerState]);

  const seekTo = useCallback((time: number) => {
    playerRef.current?.seekTo(time, 'seconds');
    syncPlaybackState(time);
  }, [playerRef, syncPlaybackState]);

  const setSpeed = useCallback((speed: number) => updatePlayerState({ speed }), [updatePlayerState]);
  const setVolume = useCallback((volume: number) => updatePlayerState({ volume }), [updatePlayerState]);
  const setQuality = useCallback((quality: VideoQuality) => {
    updatePlayerState({ quality });
    applyQualityPreference(quality);
    refreshAvailableQualities();
  }, [updatePlayerState, applyQualityPreference, refreshAvailableQualities]);

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

  const onProgress = useCallback((state: { playedSeconds: number; loaded: number }) => {
    syncPlaybackState(state.playedSeconds);
  }, [syncPlaybackState]);

  const onDuration = useCallback((d: number) => setDuration(d), []);

  const onReady = useCallback(() => {
    if (!currentVideo) return;

    setTimeout(() => {
      refreshAvailableQualities();
      applyQualityPreference(useAppStore.getState().playerState.quality ?? defaultVideoQuality);

      if (restoredSeekForVideoRef.current === currentVideo.id) return;
      const pos = Number(useAppStore.getState().playerState.position || 0);
      if (playerRef.current && pos > 0.25) {
        playerRef.current.seekTo(pos, 'seconds');
        restoredSeekForVideoRef.current = currentVideo.id;
      }
    }, 250);
  }, [currentVideo?.id, defaultVideoQuality, playerRef, applyQualityPreference, refreshAvailableQualities]);

  const onEnded = useCallback(() => updatePlayerState({ playing: false }), [updatePlayerState]);

  // High-frequency sync loop for accurate word highlighting.
  useEffect(() => {
    if (!currentVideo || !playerState.playing) return;
    const iv = setInterval(() => {
      const current = Number(playerRef.current?.getCurrentTime?.());
      if (Number.isFinite(current)) syncPlaybackState(current);
    }, 80);
    return () => clearInterval(iv);
  }, [currentVideo?.id, playerState.playing, playerRef, syncPlaybackState]);

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
    currentQuality,
    availableQualities,
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
    setQuality,
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
