import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { resolveApiUrl, resolveMediaUrl } from '../services/api';
import { getOfflineMediaBlobUrl } from '../services/offlineManager';
import type { ContentItem } from '../types/content';
import { useApp } from './AppContext';

export type RepeatMode = 'off' | 'all' | 'one';

interface AudioContextValue {
  currentTrack: ContentItem | null;
  queue: ContentItem[];
  isPlaying: boolean;
  isBuffering: boolean;
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

  const [currentTrack, setCurrentTrack] = useState<ContentItem | null>(null);
  const [queue, setQueue] = useState<ContentItem[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
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
    const audio = new Audio();
    audio.preload = 'metadata';
    audioRef.current = audio;

    return () => {
      audio.pause();
      cleanupBlob();
    };
  }, []);

  const loadAndPlay = useCallback(
    async (item: ContentItem, resumeAt?: number) => {
      if (!item.audio?.url || !audioRef.current) return;
      const audio = audioRef.current;

      setAudioError(null);
      setIsBuffering(true);
      setCurrentTrack(item);

      cleanupBlob();
      const offlineUrl = await getOfflineMediaBlobUrl(item.audio.url);
      if (offlineUrl) {
        activeBlobUrlRef.current = offlineUrl;
        audio.src = offlineUrl;
        setIsPlayingOffline(true);
      } else {
        if (!isOnline) {
          setIsBuffering(false);
          setIsPlaying(false);
          setIsPlayingOffline(false);
          setAudioError('This audio is not downloaded and you are currently offline.');
          return;
        }
        audio.src = resolveMediaUrl(item.audio.url);
        setIsPlayingOffline(false);
      }

      audio.playbackRate = playbackRate;

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

      const handleLoaded = () => {
        if (initialPos > 0 && initialPos < audio.duration) {
          audio.currentTime = initialPos;
        }
        setDuration(audio.duration || item.audio?.durationSeconds || 0);
      };

      audio.addEventListener('loadedmetadata', handleLoaded, { once: true });

      try {
        await audio.play();
        setIsPlaying(true);
        setIsBuffering(false);

        if (isOnline) {
          fetch(resolveApiUrl(`/api/content/${item.id}/track`), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'play' }),
          }).catch(() => {});
        }
      } catch (err: any) {
        setIsBuffering(false);
        setIsPlaying(false);
        setAudioError(err?.message || 'Unable to play audio stream.');
      }
    },
    [playbackRate, listeningHistory, isOnline]
  );

  const playItem = useCallback(
    async (item: ContentItem, queueItems?: ContentItem[], startAtSeconds?: number) => {
      if (!item.audio?.url) {
        showToast('No audio track attached to this item.');
        return;
      }

      if (currentTrack?.id === item.id && audioRef.current && startAtSeconds === undefined) {
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
    [currentTrack, queue, loadAndPlay, showToast]
  );

  const togglePlayPause = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !currentTrack) return;
    if (audio.paused) {
      audio.play().then(() => setIsPlaying(true)).catch(() => {});
    } else {
      audio.pause();
      setIsPlaying(false);
      recordListeningProgress(currentTrack, audio.currentTime, audio.duration || currentTrack.audio?.durationSeconds || 0);
    }
  }, [currentTrack, recordListeningProgress]);

  const seek = useCallback((seconds: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    const clamped = Math.max(0, Math.min(seconds, audio.duration || seconds));
    audio.currentTime = clamped;
    setCurrentTime(clamped);
  }, []);

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
    if (audioRef.current) {
      audioRef.current.pause();
    }
    setIsPlaying(false);
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
      if (audio.duration && !isNaN(audio.duration)) setDuration(audio.duration);
      const now = Date.now();
      if (currentTrack && now - lastSyncRef.current > 3500) {
        lastSyncRef.current = now;
        recordListeningProgress(currentTrack, audio.currentTime, audio.duration || currentTrack.audio?.durationSeconds || 0);
      }
    };
    const onWaiting = () => setIsBuffering(true);
    const onPlaying = () => {
      setIsBuffering(false);
      setIsPlaying(true);
    };
    const onPause = () => setIsPlaying(false);
    const onError = () => {
      setIsBuffering(false);
      setIsPlaying(false);
      setAudioError('Playback interrupted. Check connection or download for offline playback.');
    };
    const onEnded = () => {
      if (currentTrack) {
        recordListeningProgress(currentTrack, 0, audio.duration || currentTrack.audio?.durationSeconds || 0, true);
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
  }, [currentTrack, repeatMode, nextTrack, recordListeningProgress]);

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
