import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { resolveApiUrl, resolveMediaUrl } from '../services/api';
import {
  decodeAudioToWavBlob,
  extractAudioExtension,
  getCachedDecodedAudio,
  resolveAudioMimeType,
  setCachedDecodedAudio,
  shouldTranscodeDirectly,
} from '../services/audioFormatResolver';
import { getOfflineMediaBlob } from '../services/offlineManager';
import type { ContentItem } from '../types/content';
import { useApp } from './AppContext';

export type RepeatMode = 'off' | 'all' | 'one';

interface AudioContextValue {
  currentTrack: ContentItem | null;
  queue: ContentItem[];
  isPlaying: boolean;
  isBuffering: boolean;
  loadingStatus: string | null;
  audioError: string | null;
  currentTime: number;
  duration: number;
  playbackRate: number;
  repeatMode: RepeatMode;
  isExpanded: boolean;
  isPlayingOffline: boolean;
  setIsExpanded: (v: boolean) => void;
  playItem: (item: ContentItem, queueItems?: ContentItem[], startAtSeconds?: number) => Promise<void>;
  togglePlayPause: () => void;
  seek: (seconds: number) => void;
  skipBy: (deltaSeconds: number) => void;
  nextTrack: () => void;
  prevTrack: () => void;
  setPlaybackRate: (rate: number) => void;
  cycleRepeat: () => void;
  addToQueue: (item: ContentItem) => void;
  closePlayer: () => void;
}

const AudioContext = createContext<AudioContextValue | null>(null);

export const AudioProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { recordListeningProgress, listeningHistory, showToast, isOnline } = useApp();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const activeBlobUrlRef = useRef<string | null>(null);
  const lastSyncRef = useRef<number>(0);
  const playRequestIdRef = useRef<number>(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const currentTrackRef = useRef<ContentItem | null>(null);
  const activeMetaRef = useRef<{
    reqId: number;
    item: ContentItem;
    mediaUrl: string;
    ext: string;
    mime: string;
    offlineBlob: Blob | null;
    fallbackTried: boolean;
    initialPos: number;
  } | null>(null);

  const [currentTrack, setCurrentTrack] = useState<ContentItem | null>(null);
  const [queue, setQueue] = useState<ContentItem[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState<string | null>(null);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRateState] = useState(1);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>('off');
  const [isExpanded, setIsExpanded] = useState(false);
  const [isPlayingOffline, setIsPlayingOffline] = useState(false);

  const cleanupBlob = () => {
    if (activeBlobUrlRef.current) {
      URL.revokeObjectURL(activeBlobUrlRef.current);
      activeBlobUrlRef.current = null;
    }
  };

  useEffect(() => {
    currentTrackRef.current = currentTrack;
  }, [currentTrack]);

  useEffect(() => {
    const audio = new Audio();
    audio.preload = 'metadata';
    audioRef.current = audio;

    return () => {
      abortControllerRef.current?.abort();
      audio.pause();
      audio.removeAttribute('src');
      cleanupBlob();
    };
  }, []);

  const attachMetadataAndResume = useCallback(
    (audio: HTMLAudioElement, item: ContentItem, reqId: number, initialPos: number) => {
      let resumed = false;
      const applyMeta = () => {
        if (playRequestIdRef.current !== reqId) return;
        const finiteDur = audio.duration && Number.isFinite(audio.duration) ? audio.duration : 0;
        if (finiteDur > 0) {
          setDuration(finiteDur);
          if (!resumed && initialPos > 0 && initialPos < finiteDur - 1) {
            resumed = true;
            audio.currentTime = initialPos;
            setCurrentTime(initialPos);
          }
        } else if (item.audio?.durationSeconds) {
          setDuration(item.audio.durationSeconds);
        }
      };

      const onMeta = () => applyMeta();
      const onDurChange = () => applyMeta();
      audio.addEventListener('loadedmetadata', onMeta);
      audio.addEventListener('durationchange', onDurChange);

      return () => {
        audio.removeEventListener('loadedmetadata', onMeta);
        audio.removeEventListener('durationchange', onDurChange);
      };
    },
    []
  );

  const metaCleanupRef = useRef<(() => void) | null>(null);

  const transcodeAndAssignSrc = useCallback(
    async (
      audio: HTMLAudioElement,
      mediaUrl: string,
      ext: string,
      mime: string,
      offlineBlob: Blob | null,
      reqId: number,
      signal: AbortSignal
    ) => {
      const cached = getCachedDecodedAudio(mediaUrl);
      if (cached) {
        if (playRequestIdRef.current !== reqId || signal.aborted) return false;
        cleanupBlob();
        const wavUrl = URL.createObjectURL(cached.wavBlob);
        activeBlobUrlRef.current = wavUrl;
        audio.src = wavUrl;
        if (cached.durationSeconds > 0) setDuration(cached.durationSeconds);
        return true;
      }

      const formatLabel = (ext || 'audio').toUpperCase();
      setLoadingStatus(`Decoding ${formatLabel} audio...`);

      let bytes: Uint8Array;
      if (offlineBlob) {
        bytes = new Uint8Array(await offlineBlob.arrayBuffer());
      } else {
        if (!isOnline) {
          throw new Error('This audio is not downloaded and you are currently offline.');
        }
        const response = await fetch(mediaUrl, { signal });
        if (!response.ok) {
          throw new Error(`Unable to fetch audio (${response.status}).`);
        }
        bytes = new Uint8Array(await response.arrayBuffer());
      }

      if (playRequestIdRef.current !== reqId || signal.aborted) return false;

      const decoded = await decodeAudioToWavBlob(bytes, ext, mime);
      if (playRequestIdRef.current !== reqId || signal.aborted) return false;

      setCachedDecodedAudio(mediaUrl, {
        wavBlob: decoded.wavBlob,
        durationSeconds: decoded.durationSeconds,
      });

      cleanupBlob();
      const wavUrl = URL.createObjectURL(decoded.wavBlob);
      activeBlobUrlRef.current = wavUrl;
      audio.src = wavUrl;
      if (decoded.durationSeconds > 0) {
        setDuration(decoded.durationSeconds);
      }
      return true;
    },
    [isOnline]
  );

  const loadAndPlay = useCallback(
    async (item: ContentItem, resumeAt?: number) => {
      if (!item.audio?.url || !audioRef.current) return;
      const audio = audioRef.current;

      const reqId = ++playRequestIdRef.current;
      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;

      metaCleanupRef.current?.();
      metaCleanupRef.current = null;

      audio.pause();
      setAudioError(null);
      setLoadingStatus(null);
      setIsBuffering(true);
      setIsPlaying(false);
      setCurrentTrack(item);
      setCurrentTime(0);
      setDuration(item.audio.durationSeconds || 0);

      cleanupBlob();

      const offlineBlob = await getOfflineMediaBlob(item.audio.url, item.audio.format);
      if (playRequestIdRef.current !== reqId || controller.signal.aborted) return;

      if (!offlineBlob && !isOnline) {
        setIsBuffering(false);
        setIsPlaying(false);
        setIsPlayingOffline(false);
        setAudioError('This audio is not downloaded and you are currently offline.');
        return;
      }

      const mediaUrl = resolveMediaUrl(item.audio.url);
      const ext = extractAudioExtension(item.audio.url, item.audio.format);
      const mime = resolveAudioMimeType({
        url: item.audio.url,
        formatHint: item.audio.format,
        serverContentType: offlineBlob?.type,
      });

      setIsPlayingOffline(Boolean(offlineBlob));

      // Determine resume position
      let initialPos = resumeAt ?? 0;
      if (resumeAt === undefined) {
        const hist = listeningHistory.find((h) => h.contentId === item.id);
        if (hist?.positionSeconds && hist.positionSeconds > 3) {
          const total = hist.durationSeconds || item.audio.durationSeconds || 0;
          if (!total || hist.positionSeconds < total - 3) {
            initialPos = hist.positionSeconds;
          }
        }
      }

      activeMetaRef.current = {
        reqId,
        item,
        mediaUrl,
        ext,
        mime,
        offlineBlob,
        fallbackTried: false,
        initialPos,
      };

      metaCleanupRef.current = attachMetadataAndResume(audio, item, reqId, initialPos);

      try {
        const directTranscode = shouldTranscodeDirectly(audio, ext, mime) || Boolean(getCachedDecodedAudio(mediaUrl));

        if (directTranscode) {
          activeMetaRef.current.fallbackTried = true;
          const ready = await transcodeAndAssignSrc(
            audio,
            mediaUrl,
            ext,
            mime,
            offlineBlob,
            reqId,
            controller.signal
          );
          if (!ready || playRequestIdRef.current !== reqId) return;
        } else if (offlineBlob) {
          const blobUrl = URL.createObjectURL(offlineBlob);
          activeBlobUrlRef.current = blobUrl;
          audio.src = blobUrl;
        } else {
          audio.src = mediaUrl;
        }

        audio.playbackRate = playbackRate;
        setLoadingStatus(null);
        await audio.play();

        if (playRequestIdRef.current !== reqId) return;
        setIsPlaying(true);
        setIsBuffering(false);

        if (isOnline) {
          fetch(resolveApiUrl(`/api/content/${item.id}/track`), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'play' }),
          }).catch(() => {});
        }
      } catch (err: unknown) {
        if (playRequestIdRef.current !== reqId || controller.signal.aborted) return;

        // If direct native playback failed (e.g. 3GP with AMR track or unsupported browser container), auto-fallback to WASM/WebAudio decoder
        const meta = activeMetaRef.current;
        if (meta && meta.reqId === reqId && !meta.fallbackTried) {
          meta.fallbackTried = true;
          try {
            const ready = await transcodeAndAssignSrc(
              audio,
              mediaUrl,
              ext,
              mime,
              offlineBlob,
              reqId,
              controller.signal
            );
            if (!ready || playRequestIdRef.current !== reqId) return;
            audio.playbackRate = playbackRate;
            setLoadingStatus(null);
            await audio.play();
            if (playRequestIdRef.current !== reqId) return;
            setIsPlaying(true);
            setIsBuffering(false);
            return;
          } catch (fallbackErr: unknown) {
            if (playRequestIdRef.current !== reqId || controller.signal.aborted) return;
            setLoadingStatus(null);
            setIsBuffering(false);
            setIsPlaying(false);
            const message =
              fallbackErr instanceof Error ? fallbackErr.message : 'Unable to decode or play audio format.';
            setAudioError(message);
            return;
          }
        }

        setLoadingStatus(null);
        setIsBuffering(false);
        setIsPlaying(false);
        const message = err instanceof Error ? err.message : 'Unable to play audio stream.';
        setAudioError(message);
      }
    },
    [playbackRate, listeningHistory, isOnline, attachMetadataAndResume, transcodeAndAssignSrc]
  );

  const playItem = useCallback(
    async (item: ContentItem, queueItems?: ContentItem[], startAtSeconds?: number) => {
      if (!item.audio?.url) {
        showToast('No audio track attached to this item.');
        return;
      }

      if (currentTrack?.id === item.id && audioRef.current && startAtSeconds === undefined && !audioError) {
        if (audioRef.current.paused) {
          await audioRef.current.play().catch(() => {});
          setIsPlaying(true);
        } else {
          audioRef.current.pause();
          setIsPlaying(false);
        }
        return;
      }

      if (queueItems && queueItems.length > 0) {
        setQueue(queueItems.filter((q) => Boolean(q.audio?.url)));
      } else if (!queue.some((q) => q.id === item.id)) {
        setQueue((prev) => [item, ...prev.filter((q) => q.id !== item.id)]);
      }

      await loadAndPlay(item, startAtSeconds);
    },
    [currentTrack, queue, audioError, loadAndPlay, showToast]
  );

  const togglePlayPause = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !currentTrack) return;
    if (audioError) {
      loadAndPlay(currentTrack);
      return;
    }
    if (audio.paused) {
      audio.play().then(() => setIsPlaying(true)).catch(() => {});
    } else {
      audio.pause();
      setIsPlaying(false);
      recordListeningProgress(
        currentTrack,
        audio.currentTime,
        (Number.isFinite(audio.duration) ? audio.duration : 0) || currentTrack.audio?.durationSeconds || 0
      );
    }
  }, [currentTrack, audioError, loadAndPlay, recordListeningProgress]);

  const seek = useCallback((seconds: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    const maxDur = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : duration || seconds;
    const clamped = Math.max(0, Math.min(seconds, maxDur));
    audio.currentTime = clamped;
    setCurrentTime(clamped);
  }, [duration]);

  const skipBy = useCallback(
    (deltaSeconds: number) => {
      const audio = audioRef.current;
      if (!audio) return;
      seek(audio.currentTime + deltaSeconds);
    },
    [seek]
  );

  const nextTrack = useCallback(() => {
    if (!currentTrack || queue.length === 0) return;
    const idx = queue.findIndex((q) => q.id === currentTrack.id);
    const nextIdx = idx + 1;
    if (nextIdx < queue.length) {
      loadAndPlay(queue[nextIdx], 0);
    } else if (repeatMode === 'all' && queue.length > 0) {
      loadAndPlay(queue[0], 0);
    }
  }, [currentTrack, queue, repeatMode, loadAndPlay]);

  const prevTrack = useCallback(() => {
    const audio = audioRef.current;
    if (audio && audio.currentTime > 4) {
      seek(0);
      return;
    }
    if (!currentTrack || queue.length === 0) return;
    const idx = queue.findIndex((q) => q.id === currentTrack.id);
    if (idx > 0) {
      loadAndPlay(queue[idx - 1], 0);
    }
  }, [currentTrack, queue, seek, loadAndPlay]);

  const setPlaybackRate = useCallback((rate: number) => {
    setPlaybackRateState(rate);
    if (audioRef.current) {
      audioRef.current.playbackRate = rate;
    }
  }, []);

  const cycleRepeat = useCallback(() => {
    setRepeatMode((prev) => (prev === 'off' ? 'all' : prev === 'all' ? 'one' : 'off'));
  }, []);

  const addToQueue = useCallback(
    (item: ContentItem) => {
      if (!item.audio?.url) return;
      setQueue((prev) => {
        if (prev.some((p) => p.id === item.id)) return prev;
        return [...prev, item];
      });
      showToast('Added to playback queue.');
    },
    [showToast]
  );

  const closePlayer = useCallback(() => {
    playRequestIdRef.current += 1;
    abortControllerRef.current?.abort();
    metaCleanupRef.current?.();
    metaCleanupRef.current = null;
    activeMetaRef.current = null;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.removeAttribute('src');
      audioRef.current.load();
    }
    setIsPlaying(false);
    setIsBuffering(false);
    setLoadingStatus(null);
    setAudioError(null);
    setIsExpanded(false);
    setCurrentTrack(null);
    cleanupBlob();
  }, []);

  // Wire audio element events
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      const validDur = audio.duration && Number.isFinite(audio.duration) ? audio.duration : 0;
      if (validDur > 0) setDuration(validDur);
      const now = Date.now();
      if (currentTrack && now - lastSyncRef.current > 3500) {
        lastSyncRef.current = now;
        recordListeningProgress(currentTrack, audio.currentTime, validDur || currentTrack.audio?.durationSeconds || 0);
      }
    };
    const onWaiting = () => setIsBuffering(true);
    const onPlaying = () => {
      setIsBuffering(false);
      setLoadingStatus(null);
      setIsPlaying(true);
    };
    const onPause = () => setIsPlaying(false);
    const onError = async () => {
      if (!currentTrackRef.current) return;
      const meta = activeMetaRef.current;
      const signal = abortControllerRef.current?.signal;

      // Attempt automatic universal decode fallback if native <audio> element fired a source/decode error
      if (
        meta &&
        meta.reqId === playRequestIdRef.current &&
        !meta.fallbackTried &&
        signal &&
        !signal.aborted
      ) {
        meta.fallbackTried = true;
        try {
          setIsBuffering(true);
          const ready = await transcodeAndAssignSrc(
            audio,
            meta.mediaUrl,
            meta.ext,
            meta.mime,
            meta.offlineBlob,
            meta.reqId,
            signal
          );
          if (!ready || playRequestIdRef.current !== meta.reqId) return;
          audio.playbackRate = playbackRate;
          setLoadingStatus(null);
          await audio.play();
          if (playRequestIdRef.current === meta.reqId) {
            setIsPlaying(true);
            setIsBuffering(false);
            setAudioError(null);
          }
          return;
        } catch (err: unknown) {
          if (playRequestIdRef.current !== meta.reqId || signal.aborted) return;
          setLoadingStatus(null);
          setIsBuffering(false);
          setIsPlaying(false);
          setAudioError(err instanceof Error ? err.message : 'Unable to decode audio format.');
          return;
        }
      }

      setLoadingStatus(null);
      setIsBuffering(false);
      setIsPlaying(false);
      setAudioError('Playback interrupted. Check connection or download for offline playback.');
    };
    const onEnded = () => {
      if (currentTrack) {
        const validDur = audio.duration && Number.isFinite(audio.duration) ? audio.duration : 0;
        recordListeningProgress(currentTrack, 0, validDur || currentTrack.audio?.durationSeconds || 0, true);
      }
      if (repeatMode === 'one') {
        audio.currentTime = 0;
        audio.play().catch(() => {});
      } else {
        nextTrack();
      }
    };

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('waiting', onWaiting);
    audio.addEventListener('playing', onPlaying);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('error', onError);
    audio.addEventListener('ended', onEnded);

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('waiting', onWaiting);
      audio.removeEventListener('playing', onPlaying);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('error', onError);
      audio.removeEventListener('ended', onEnded);
    };
  }, [currentTrack, repeatMode, playbackRate, nextTrack, recordListeningProgress, transcodeAndAssignSrc]);

  // Wire lock-screen & headphone MediaSession API
  useEffect(() => {
    if (!currentTrack || !('mediaSession' in navigator)) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: currentTrack.title,
      artist: currentTrack.speaker,
      album: currentTrack.seriesTitle || currentTrack.categoryName,
      artwork: currentTrack.coverImage
        ? [{ src: resolveMediaUrl(currentTrack.coverImage), sizes: '512x512', type: 'image/jpeg' }]
        : [],
    });

    navigator.mediaSession.setActionHandler('play', () => togglePlayPause());
    navigator.mediaSession.setActionHandler('pause', () => togglePlayPause());
    navigator.mediaSession.setActionHandler('seekbackward', () => skipBy(-10));
    navigator.mediaSession.setActionHandler('seekforward', () => skipBy(10));
    navigator.mediaSession.setActionHandler('previoustrack', () => prevTrack());
    navigator.mediaSession.setActionHandler('nexttrack', () => nextTrack());
  }, [currentTrack, togglePlayPause, skipBy, prevTrack, nextTrack]);

  return (
    <AudioContext.Provider
      value={{
        currentTrack,
        queue,
        isPlaying,
        isBuffering,
        loadingStatus,
        audioError,
        currentTime,
        duration,
        playbackRate,
        repeatMode,
        isExpanded,
        isPlayingOffline,
        setIsExpanded,
        playItem,
        togglePlayPause,
        seek,
        skipBy,
        nextTrack,
        prevTrack,
        setPlaybackRate,
        cycleRepeat,
        addToQueue,
        closePlayer,
      }}
    >
      {children}
    </AudioContext.Provider>
  );
};

export function useAudio() {
  const ctx = useContext(AudioContext);
  if (!ctx) throw new Error('useAudio must be used inside AudioProvider');
  return ctx;
}
