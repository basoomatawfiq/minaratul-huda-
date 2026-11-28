import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { resolveApiUrl, resolveMediaUrl } from '../services/api';
import {
  decodeAudioToWavBlob,
  extractAudioExtension,
  getCachedDecodedAudio,
  preloadAudioDecoder,
  resolveAudioMimeType,
  setCachedDecodedAudio,
  shouldTranscodeDirectly,
} from '../services/audioFormatResolver';
import { getOfflineMediaBlob } from '../services/offlineManager';
import type { ContentItem } from '../types/content';
import { useApp } from './AppContext';

export type RepeatMode = 'off' | 'all' | 'one';

const LS_AUDIO_SESSION = 'minaratul_huda_audio_session_v1';

// 1-sample silent PCM WAV to unlock HTMLAudioElement synchronously inside the user's tap gesture
const SILENT_UNLOCK_WAV_URI =
  'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';

interface PersistedAudioSession {
  track: ContentItem;
  queue: ContentItem[];
  positionSeconds: number;
  durationSeconds: number;
  playbackRate: number;
  repeatMode: RepeatMode;
  isExpanded: boolean;
  updatedAt: string;
}

function readPersistedAudioSession(): PersistedAudioSession | null {
  try {
    const raw = localStorage.getItem(LS_AUDIO_SESSION);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedAudioSession;
    if (!parsed?.track?.id || !parsed.track.audio?.url) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writePersistedAudioSession(session: PersistedAudioSession | null) {
  try {
    if (!session) {
      localStorage.removeItem(LS_AUDIO_SESSION);
    } else {
      localStorage.setItem(LS_AUDIO_SESSION, JSON.stringify(session));
    }
  } catch {
    // ignore storage errors
  }
}

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

async function fetchAudioBytesWithProgress(
  mediaUrl: string,
  signal: AbortSignal,
  onProgress: (pct: number) => void
): Promise<Uint8Array> {
  const response = await fetch(mediaUrl, { signal });
  if (!response.ok) {
    throw new Error(`Unable to fetch audio (${response.status}).`);
  }

  const contentLengthHeader = response.headers.get('content-length');
  const totalBytes = contentLengthHeader ? Number(contentLengthHeader) : 0;

  if (!response.body || !totalBytes || Number.isNaN(totalBytes)) {
    const buf = await response.arrayBuffer();
    return new Uint8Array(buf);
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let loaded = 0;
  let lastReported = -1;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      loaded += value.byteLength;
      const pct = Math.min(99, Math.round((loaded / totalBytes) * 100));
      if (pct !== lastReported && pct % 5 === 0) {
        lastReported = pct;
        onProgress(pct);
      }
    }
  }

  const merged = new Uint8Array(loaded);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return merged;
}

export const AudioProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const {
    recordListeningProgress,
    listeningHistory,
    catalogItems,
    catalogVersion,
    showToast,
    isOnline,
    isItemDownloaded,
  } = useApp();

  const initialSessionRef = useRef<PersistedAudioSession | null>(readPersistedAudioSession());

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const activeBlobUrlRef = useRef<string | null>(null);
  const lastSyncRef = useRef<number>(0);
  const lastSessionSaveRef = useRef<number>(0);
  const playRequestIdRef = useRef<number>(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const currentTrackRef = useRef<ContentItem | null>(initialSessionRef.current?.track || null);
  const unlockingRef = useRef<boolean>(false);
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

  const [currentTrack, setCurrentTrack] = useState<ContentItem | null>(
    () => initialSessionRef.current?.track || null
  );
  const [queue, setQueue] = useState<ContentItem[]>(
    () => initialSessionRef.current?.queue || []
  );
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState<string | null>(null);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState<number>(
    () => initialSessionRef.current?.positionSeconds || 0
  );
  const [duration, setDuration] = useState<number>(
    () =>
      initialSessionRef.current?.durationSeconds ||
      initialSessionRef.current?.track.audio?.durationSeconds ||
      0
  );
  const [playbackRate, setPlaybackRateState] = useState<number>(
    () => initialSessionRef.current?.playbackRate || 1
  );
  const [repeatMode, setRepeatMode] = useState<RepeatMode>(
    () => initialSessionRef.current?.repeatMode || 'off'
  );
  const [isExpanded, setIsExpandedState] = useState<boolean>(
    () => Boolean(initialSessionRef.current?.isExpanded && initialSessionRef.current?.track)
  );
  const [isPlayingOffline, setIsPlayingOffline] = useState<boolean>(() =>
    initialSessionRef.current?.track
      ? isItemDownloaded(initialSessionRef.current.track.id, 'audio')
      : false
  );

  const queueRef = useRef(queue);
  queueRef.current = queue;
  const currentTimeRef = useRef(currentTime);
  currentTimeRef.current = currentTime;
  const durationRef = useRef(duration);
  durationRef.current = duration;
  const playbackRateRef = useRef(playbackRate);
  playbackRateRef.current = playbackRate;
  const repeatModeRef = useRef(repeatMode);
  repeatModeRef.current = repeatMode;
  const isExpandedRef = useRef(isExpanded);
  isExpandedRef.current = isExpanded;

  const persistSessionNow = useCallback(
    (overridePos?: number, overrideExpanded?: boolean) => {
      const track = currentTrackRef.current;
      if (!track) {
        writePersistedAudioSession(null);
        return;
      }
      const audio = audioRef.current;
      const livePos =
        overridePos !== undefined
          ? overridePos
          : audio && !unlockingRef.current && audio.currentSrc
            ? audio.currentTime
            : currentTimeRef.current;
      const liveDur =
        (audio && !unlockingRef.current && Number.isFinite(audio.duration) && audio.duration > 0
          ? audio.duration
          : durationRef.current) ||
        track.audio?.durationSeconds ||
        0;

      writePersistedAudioSession({
        track,
        queue: queueRef.current,
        positionSeconds: Math.max(0, livePos || 0),
        durationSeconds: Math.max(0, liveDur || 0),
        playbackRate: playbackRateRef.current,
        repeatMode: repeatModeRef.current,
        isExpanded: overrideExpanded !== undefined ? overrideExpanded : isExpandedRef.current,
        updatedAt: new Date().toISOString(),
      });
    },
    []
  );

  const setIsExpanded = useCallback(
    (v: boolean) => {
      isExpandedRef.current = v;
      setIsExpandedState(v);
      persistSessionNow(undefined, v);
    },
    [persistSessionNow]
  );

  const cleanupBlob = () => {
    if (activeBlobUrlRef.current) {
      URL.revokeObjectURL(activeBlobUrlRef.current);
      activeBlobUrlRef.current = null;
    }
  };

  useEffect(() => {
    currentTrackRef.current = currentTrack;
  }, [currentTrack]);

  // Keep restored track synced with server catalog; clear only if deleted by admin and not offline
  useEffect(() => {
    if (catalogVersion === 0 || !currentTrackRef.current) return;
    const match = catalogItems.find((i) => i.id === currentTrackRef.current?.id);
    if (match) {
      currentTrackRef.current = match;
      setCurrentTrack(match);
      persistSessionNow();
    } else if (!isItemDownloaded(currentTrackRef.current.id, 'audio')) {
      currentTrackRef.current = null;
      setCurrentTrack(null);
      setIsExpandedState(false);
      writePersistedAudioSession(null);
    }
  }, [catalogVersion, catalogItems, isItemDownloaded, persistSessionNow]);

  useEffect(() => {
    const audio = new Audio();
    audio.preload = 'auto';
    audioRef.current = audio;

    return () => {
      abortControllerRef.current?.abort();
      audio.pause();
      audio.removeAttribute('src');
      cleanupBlob();
    };
  }, []);

  // Flush exact playback timestamp immediately when user backgrounds, navigates away, or closes app
  useEffect(() => {
    const flushNow = () => {
      const track = currentTrackRef.current;
      const audio = audioRef.current;
      if (!track) return;
      const pos =
        audio && !unlockingRef.current && audio.currentSrc
          ? audio.currentTime
          : currentTimeRef.current;
      const dur =
        (audio && !unlockingRef.current && Number.isFinite(audio.duration) && audio.duration > 0
          ? audio.duration
          : durationRef.current) ||
        track.audio?.durationSeconds ||
        0;
      persistSessionNow(pos);
      if (pos > 0) {
        recordListeningProgress(track, pos, dur);
      }
    };

    const onVisChange = () => {
      if (document.visibilityState === 'hidden') flushNow();
    };
    window.addEventListener('pagehide', flushNow);
    window.addEventListener('beforeunload', flushNow);
    document.addEventListener('visibilitychange', onVisChange);
    return () => {
      window.removeEventListener('pagehide', flushNow);
      window.removeEventListener('beforeunload', flushNow);
      document.removeEventListener('visibilitychange', onVisChange);
    };
  }, [persistSessionNow, recordListeningProgress]);

  const attachMetadataAndResume = useCallback(
    (audio: HTMLAudioElement, item: ContentItem, reqId: number, initialPos: number) => {
      let resumed = false;
      const applyMeta = () => {
        if (playRequestIdRef.current !== reqId || unlockingRef.current) return;
        const finiteDur = audio.duration && Number.isFinite(audio.duration) ? audio.duration : 0;
        if (finiteDur > 0) {
          setDuration(finiteDur);
          durationRef.current = finiteDur;
          if (!resumed && initialPos > 0 && initialPos < finiteDur - 1) {
            resumed = true;
            audio.currentTime = initialPos;
            setCurrentTime(initialPos);
            currentTimeRef.current = initialPos;
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
        unlockingRef.current = false;
        audio.muted = false;
        cleanupBlob();
        const wavUrl = URL.createObjectURL(cached.wavBlob);
        activeBlobUrlRef.current = wavUrl;
        audio.src = wavUrl;
        if (cached.durationSeconds > 0) setDuration(cached.durationSeconds);
        return true;
      }

      const formatLabel = (ext || 'audio').toUpperCase();
      setLoadingStatus(`Loading ${formatLabel} audio...`);

      // Warm up the WASM decoder module concurrently while downloading bytes
      const decoderWarmup = preloadAudioDecoder();

      let bytes: Uint8Array;
      if (offlineBlob) {
        bytes = new Uint8Array(await offlineBlob.arrayBuffer());
      } else {
        if (!isOnline) {
          throw new Error('This audio is not downloaded and you are currently offline.');
        }
        bytes = await fetchAudioBytesWithProgress(mediaUrl, signal, (pct) => {
          if (playRequestIdRef.current === reqId && !signal.aborted) {
            setLoadingStatus(`Loading ${formatLabel} audio... ${pct}%`);
          }
        });
      }

      if (playRequestIdRef.current !== reqId || signal.aborted) return false;

      setLoadingStatus(`Preparing ${formatLabel} playback...`);
      await decoderWarmup;
      const decoded = await decodeAudioToWavBlob(bytes, ext, mime);
      if (playRequestIdRef.current !== reqId || signal.aborted) return false;

      setCachedDecodedAudio(mediaUrl, {
        wavBlob: decoded.wavBlob,
        durationSeconds: decoded.durationSeconds,
      });

      unlockingRef.current = false;
      audio.muted = false;
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

  // Synchronously unlock <audio> inside the click tick so mobile browsers allow playback after async fetch/decode
  const unlockAudioGestureSync = (audio: HTMLAudioElement) => {
    unlockingRef.current = true;
    audio.muted = true;
    audio.src = SILENT_UNLOCK_WAV_URI;
    audio.play().catch(() => {});
  };

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
      cleanupBlob();

      const mediaUrl = resolveMediaUrl(item.audio.url);
      const ext = extractAudioExtension(item.audio.url, item.audio.format);
      const mime = resolveAudioMimeType({
        url: item.audio.url,
        formatHint: item.audio.format,
      });
      const cachedDecoded = getCachedDecodedAudio(mediaUrl);
      const needsTranscode = shouldTranscodeDirectly(audio, ext, mime) || Boolean(cachedDecoded);
      const hasOfflineCopy = isItemDownloaded(item.id, 'audio');

      // Determine resume position synchronously (explicit arg > active restored session > listeningHistory)
      let initialPos = resumeAt ?? 0;
      if (resumeAt === undefined) {
        if (currentTrackRef.current?.id === item.id && currentTimeRef.current > 2) {
          const total = durationRef.current || item.audio.durationSeconds || 0;
          if (!total || currentTimeRef.current < total - 3) {
            initialPos = currentTimeRef.current;
          }
        } else {
          const hist = listeningHistory.find((h) => h.contentId === item.id);
          if (hist?.positionSeconds && hist.positionSeconds > 3) {
            const total = hist.durationSeconds || item.audio.durationSeconds || 0;
            if (!total || hist.positionSeconds < total - 3) {
              initialPos = hist.positionSeconds;
            }
          }
        }
      }

      // Synchronous UI + Session Persistence + Gesture Unlock BEFORE any await!
      currentTrackRef.current = item;
      currentTimeRef.current = initialPos;
      setAudioError(null);
      setLoadingStatus(
        cachedDecoded
          ? null
          : needsTranscode
            ? `Loading ${(ext || 'audio').toUpperCase()} audio...`
            : 'Connecting to audio...'
      );
      setIsBuffering(true);
      setIsPlaying(false);
      setCurrentTrack(item);
      setCurrentTime(initialPos);
      setDuration(cachedDecoded?.durationSeconds || item.audio.durationSeconds || 0);
      setIsPlayingOffline(hasOfflineCopy);
      persistSessionNow(initialPos);

      let syncPlayPromise: Promise<void> | null = null;
      if (cachedDecoded) {
        unlockingRef.current = false;
        audio.muted = false;
        const wavUrl = URL.createObjectURL(cachedDecoded.wavBlob);
        activeBlobUrlRef.current = wavUrl;
        audio.src = wavUrl;
        audio.playbackRate = playbackRate;
        if (initialPos > 0 && cachedDecoded.durationSeconds > 1 && initialPos < cachedDecoded.durationSeconds - 1) {
          audio.currentTime = initialPos;
        }
        syncPlayPromise = audio.play();
      } else if (!needsTranscode && !hasOfflineCopy && isOnline) {
        unlockingRef.current = false;
        audio.muted = false;
        audio.src = mediaUrl;
        audio.playbackRate = playbackRate;
        syncPlayPromise = audio.play();
      } else {
        unlockAudioGestureSync(audio);
        if (needsTranscode && !hasOfflineCopy && isOnline) {
          preloadAudioDecoder();
        }
      }

      activeMetaRef.current = {
        reqId,
        item,
        mediaUrl,
        ext,
        mime,
        offlineBlob: null,
        fallbackTried: Boolean(cachedDecoded),
        initialPos,
      };

      metaCleanupRef.current = attachMetadataAndResume(audio, item, reqId, initialPos);

      try {
        if (syncPlayPromise) {
          await syncPlayPromise;
          if (playRequestIdRef.current !== reqId) return;
          setLoadingStatus(null);
          setIsPlaying(true);
          setIsBuffering(false);
        } else {
          const offlineBlob = hasOfflineCopy
            ? await getOfflineMediaBlob(item.audio.url, item.audio.format)
            : null;
          if (playRequestIdRef.current !== reqId || controller.signal.aborted) return;

          if (!offlineBlob && !isOnline) {
            unlockingRef.current = false;
            audio.muted = false;
            audio.pause();
            setLoadingStatus(null);
            setIsBuffering(false);
            setIsPlaying(false);
            setIsPlayingOffline(false);
            setAudioError('This audio is not downloaded and you are currently offline.');
            return;
          }

          const finalMime = resolveAudioMimeType({
            url: item.audio.url,
            formatHint: item.audio.format,
            serverContentType: offlineBlob?.type,
          });
          setIsPlayingOffline(Boolean(offlineBlob));

          if (activeMetaRef.current && activeMetaRef.current.reqId === reqId) {
            activeMetaRef.current.offlineBlob = offlineBlob;
            activeMetaRef.current.mime = finalMime;
          }

          if (needsTranscode) {
            if (activeMetaRef.current) activeMetaRef.current.fallbackTried = true;
            const ready = await transcodeAndAssignSrc(
              audio,
              mediaUrl,
              ext,
              finalMime,
              offlineBlob,
              reqId,
              controller.signal
            );
            if (!ready || playRequestIdRef.current !== reqId) return;
          } else if (offlineBlob) {
            unlockingRef.current = false;
            audio.muted = false;
            cleanupBlob();
            const blobUrl = URL.createObjectURL(offlineBlob);
            activeBlobUrlRef.current = blobUrl;
            audio.src = blobUrl;
          } else {
            unlockingRef.current = false;
            audio.muted = false;
            audio.src = mediaUrl;
          }

          audio.playbackRate = playbackRate;
          setLoadingStatus(null);
          await audio.play();

          if (playRequestIdRef.current !== reqId) return;
          setIsPlaying(true);
          setIsBuffering(false);
        }

        if (isOnline) {
          fetch(resolveApiUrl(`/api/content/${item.id}/track`), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'play' }),
          }).catch(() => {});
        }
      } catch (err: unknown) {
        if (playRequestIdRef.current !== reqId || controller.signal.aborted) return;
        unlockingRef.current = false;
        audio.muted = false;

        const meta = activeMetaRef.current;
        if (meta && meta.reqId === reqId && !meta.fallbackTried) {
          meta.fallbackTried = true;
          try {
            const ready = await transcodeAndAssignSrc(
              audio,
              mediaUrl,
              ext,
              meta.mime,
              meta.offlineBlob,
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
    [
      playbackRate,
      listeningHistory,
      isOnline,
      isItemDownloaded,
      attachMetadataAndResume,
      transcodeAndAssignSrc,
      persistSessionNow,
    ]
  );

  const playItem = useCallback(
    async (item: ContentItem, queueItems?: ContentItem[], startAtSeconds?: number) => {
      if (!item.audio?.url) {
        showToast('No audio track attached to this item.');
        return;
      }

      // If this track already matches currentTrack and audio element ALREADY has a loaded source
      if (
        currentTrack?.id === item.id &&
        audioRef.current &&
        audioRef.current.currentSrc &&
        !unlockingRef.current &&
        startAtSeconds === undefined &&
        !audioError
      ) {
        if (isBuffering) {
          setIsExpanded(true);
          return;
        }
        if (audioRef.current.paused) {
          setIsExpanded(true);
          await audioRef.current.play().catch(() => {});
          setIsPlaying(true);
        } else {
          audioRef.current.pause();
          setIsPlaying(false);
          persistSessionNow();
        }
        return;
      }

      // Immediately open the full-screen audio player overlay synchronously on Play tap
      setIsExpanded(true);

      if (queueItems && queueItems.length > 0) {
        const filtered = queueItems.filter((q) => Boolean(q.audio?.url));
        queueRef.current = filtered;
        setQueue(filtered);
      } else if (!queue.some((q) => q.id === item.id)) {
        const nextQ = [item, ...queue.filter((q) => q.id !== item.id)];
        queueRef.current = nextQ;
        setQueue(nextQ);
      }

      await loadAndPlay(item, startAtSeconds);
    },
    [currentTrack, queue, audioError, isBuffering, loadAndPlay, showToast, setIsExpanded, persistSessionNow]
  );

  const togglePlayPause = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !currentTrack) return;
    if (audioError || !audio.currentSrc) {
      // Restored session after app reopen: start loading & resume seamlessly from saved currentTime!
      loadAndPlay(currentTrack, currentTimeRef.current);
      return;
    }
    if (isBuffering && unlockingRef.current) return;
    if (audio.paused) {
      audio.play().then(() => setIsPlaying(true)).catch(() => {});
    } else {
      audio.pause();
      setIsPlaying(false);
      persistSessionNow(audio.currentTime);
      recordListeningProgress(
        currentTrack,
        audio.currentTime,
        (Number.isFinite(audio.duration) ? audio.duration : 0) || currentTrack.audio?.durationSeconds || 0
      );
    }
  }, [currentTrack, audioError, isBuffering, loadAndPlay, recordListeningProgress, persistSessionNow]);

  const seek = useCallback(
    (seconds: number) => {
      const audio = audioRef.current;
      if (!audio || unlockingRef.current) return;
      const maxDur =
        (Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : 0) ||
        durationRef.current ||
        seconds;
      const clamped = Math.max(0, Math.min(seconds, maxDur));
      if (audio.currentSrc) {
        audio.currentTime = clamped;
      }
      currentTimeRef.current = clamped;
      setCurrentTime(clamped);
      persistSessionNow(clamped);
      if (currentTrackRef.current) {
        recordListeningProgress(currentTrackRef.current, clamped, maxDur);
      }
    },
    [persistSessionNow, recordListeningProgress]
  );

  const skipBy = useCallback(
    (deltaSeconds: number) => {
      const audio = audioRef.current;
      if (!audio || unlockingRef.current) return;
      const basePos = audio.currentSrc ? audio.currentTime : currentTimeRef.current;
      seek(basePos + deltaSeconds);
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
    const activePos = audio?.currentSrc ? audio.currentTime : currentTimeRef.current;
    if (activePos > 4) {
      seek(0);
      return;
    }
    if (!currentTrack || queue.length === 0) return;
    const idx = queue.findIndex((q) => q.id === currentTrack.id);
    if (idx > 0) {
      loadAndPlay(queue[idx - 1], 0);
    }
  }, [currentTrack, queue, seek, loadAndPlay]);

  const setPlaybackRate = useCallback(
    (rate: number) => {
      playbackRateRef.current = rate;
      setPlaybackRateState(rate);
      if (audioRef.current) {
        audioRef.current.playbackRate = rate;
      }
      persistSessionNow();
    },
    [persistSessionNow]
  );

  const cycleRepeat = useCallback(() => {
    setRepeatMode((prev) => {
      const next = prev === 'off' ? 'all' : prev === 'all' ? 'one' : 'off';
      repeatModeRef.current = next;
      persistSessionNow();
      return next;
    });
  }, [persistSessionNow]);

  const addToQueue = useCallback(
    (item: ContentItem) => {
      if (!item.audio?.url) return;
      setQueue((prev) => {
        if (prev.some((p) => p.id === item.id)) return prev;
        const next = [...prev, item];
        queueRef.current = next;
        persistSessionNow();
        return next;
      });
      showToast('Added to playback queue.');
    },
    [showToast, persistSessionNow]
  );

  const closePlayer = useCallback(() => {
    playRequestIdRef.current += 1;
    unlockingRef.current = false;
    abortControllerRef.current?.abort();
    metaCleanupRef.current?.();
    metaCleanupRef.current = null;
    activeMetaRef.current = null;
    if (audioRef.current) {
      audioRef.current.muted = false;
      audioRef.current.pause();
      audioRef.current.removeAttribute('src');
      audioRef.current.load();
    }
    currentTrackRef.current = null;
    isExpandedRef.current = false;
    setIsPlaying(false);
    setIsBuffering(false);
    setLoadingStatus(null);
    setAudioError(null);
    setIsExpandedState(false);
    setCurrentTrack(null);
    writePersistedAudioSession(null);
    cleanupBlob();
  }, []);

  // Wire audio element events
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => {
      if (unlockingRef.current) return;
      setCurrentTime(audio.currentTime);
      currentTimeRef.current = audio.currentTime;
      const validDur = audio.duration && Number.isFinite(audio.duration) ? audio.duration : 0;
      if (validDur > 0) {
        setDuration(validDur);
        durationRef.current = validDur;
      }
      const now = Date.now();
      if (now - lastSessionSaveRef.current > 1000) {
        lastSessionSaveRef.current = now;
        persistSessionNow(audio.currentTime);
      }
      if (currentTrack && now - lastSyncRef.current > 3500) {
        lastSyncRef.current = now;
        recordListeningProgress(currentTrack, audio.currentTime, validDur || currentTrack.audio?.durationSeconds || 0);
      }
    };
    const onWaiting = () => {
      if (!unlockingRef.current) setIsBuffering(true);
    };
    const onPlaying = () => {
      if (unlockingRef.current) return;
      setIsBuffering(false);
      setLoadingStatus(null);
      setIsPlaying(true);
    };
    const onPause = () => {
      if (!unlockingRef.current) {
        setIsPlaying(false);
        persistSessionNow(audio.currentTime);
      }
    };
    const onError = async () => {
      if (unlockingRef.current || !currentTrackRef.current) return;
      const meta = activeMetaRef.current;
      const signal = abortControllerRef.current?.signal;

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
      if (unlockingRef.current) return;
      if (currentTrack) {
        const validDur = audio.duration && Number.isFinite(audio.duration) ? audio.duration : 0;
        recordListeningProgress(currentTrack, 0, validDur || currentTrack.audio?.durationSeconds || 0, true);
        persistSessionNow(0);
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
  }, [currentTrack, repeatMode, playbackRate, nextTrack, recordListeningProgress, transcodeAndAssignSrc, persistSessionNow]);

  // Wire lock-screen & headphone MediaSession API
  useEffect(() => {
    if (!currentTrack || !('mediaSession' in navigator)) return;
    const fallbackArtworkUrl =
      typeof window !== 'undefined' ? `${window.location.origin}/pwa-512x512.png` : '/pwa-512x512.png';
    navigator.mediaSession.metadata = new MediaMetadata({
      title: currentTrack.title,
      artist: currentTrack.speaker,
      album: currentTrack.seriesTitle || currentTrack.categoryName,
      artwork: currentTrack.coverImage
        ? [{ src: resolveMediaUrl(currentTrack.coverImage), sizes: '512x512', type: 'image/jpeg' }]
        : [{ src: fallbackArtworkUrl, sizes: '512x512', type: 'image/png' }],
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
