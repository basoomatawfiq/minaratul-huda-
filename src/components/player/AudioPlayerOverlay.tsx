import React from 'react';
import {
  BookOpen,
  ChevronDown,
  ChevronUp,
  ListMusic,
  Pause,
  Play,
  Repeat,
  Repeat1,
  RotateCcw,
  RotateCw,
  SkipBack,
  SkipForward,
  WifiOff,
  X,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAudio } from '../../context/AudioContext';
import { getLocalizedTitle } from '../../i18n/translations';
import { resolveMediaUrl } from '../../services/api';
import { formatDuration } from '../../services/offlineManager';
import { DownloadAudioButton, FavoriteButton, ReadButton } from '../content/ActionButtons';

export const AudioPlayerOverlay: React.FC = () => {
  const { language } = useApp();
  const {
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
    closePlayer,
  } = useAudio();

  if (!currentTrack) return null;

  const title = getLocalizedTitle(currentTrack, language);
  const progressPct = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  return (
    <>
      {/* Persistent Compact Mini Player */}
      {!isExpanded && (
        <div className="fixed bottom-16 lg:bottom-4 left-2 right-2 lg:left-auto lg:right-6 lg:w-[420px] z-40 rounded-2xl border border-slate-200/90 bg-white/95 backdrop-blur-md shadow-lg dark:border-slate-800 dark:bg-[#131C1A]/95">
          <div className="h-0.5 w-full bg-slate-100 dark:bg-slate-800 overflow-hidden rounded-t-2xl">
            <div
              className="h-full bg-[#0F4C3A] dark:bg-emerald-500 transition-[width] duration-150"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <div className="flex items-center gap-3 px-3 py-2">
            <button
              type="button"
              onClick={() => setIsExpanded(true)}
              className="flex min-w-0 flex-1 items-center gap-3 text-start cursor-pointer"
            >
              {currentTrack.coverImage ? (
                <img
                  src={resolveMediaUrl(currentTrack.coverImage)}
                  alt={title}
                  referrerPolicy="no-referrer"
                  className="h-10 w-10 rounded-lg object-cover shrink-0 border border-slate-200 dark:border-slate-700"
                />
              ) : (
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-900 to-emerald-700 text-amber-200">
                  <BookOpen className="w-4 h-4" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                  {title}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate tabular-nums">
                  {loadingStatus ? (
                    loadingStatus
                  ) : audioError ? (
                    <span className="text-amber-700 dark:text-amber-400">{audioError}</span>
                  ) : (
                    <>
                      {currentTrack.speaker} · {formatDuration(currentTime)} / {formatDuration(duration)}
                      {isPlayingOffline ? ' · Offline' : ''}
                    </>
                  )}
                </p>
              </div>
            </button>

            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={togglePlayPause}
                aria-label={isPlaying ? 'Pause' : 'Play'}
                className="min-h-[40px] min-w-[40px] inline-flex items-center justify-center rounded-xl bg-[#0F4C3A] text-white dark:bg-emerald-600 cursor-pointer"
              >
                {isBuffering ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : isPlaying ? (
                  <Pause className="w-4 h-4" />
                ) : (
                  <Play className="w-4 h-4 fill-current" />
                )}
              </button>
              <button
                type="button"
                onClick={() => setIsExpanded(true)}
                aria-label="Expand player"
                className="min-h-[40px] min-w-[36px] inline-flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 cursor-pointer"
              >
                <ChevronUp className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={closePlayer}
                aria-label="Close player"
                className="min-h-[40px] min-w-[36px] inline-flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Full-Screen Audio Player Modal */}
      {isExpanded && (
        <div className="fixed inset-0 z-50 flex flex-col bg-[#F8F8F6] dark:bg-[#0B1110] overflow-y-auto">
          <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-between p-5 sm:p-8">
            {/* Top Controls */}
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setIsExpanded(false)}
                className="min-h-[44px] inline-flex items-center gap-2 rounded-xl px-3 text-sm font-medium text-slate-600 hover:bg-slate-200/60 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
              >
                <ChevronDown className="w-5 h-5" />
                <span>Minimize</span>
              </button>

              <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                {currentTrack.categoryName}
                {isPlayingOffline ? ' · Playing Offline' : ''}
              </div>

              <div className="flex items-center gap-1">
                <FavoriteButton item={currentTrack} />
              </div>
            </div>

            {/* Artwork & Metadata */}
            <div className="my-6 flex flex-col items-center text-center">
              <div className="h-52 w-52 sm:h-64 sm:w-64 overflow-hidden rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl">
                {currentTrack.coverImage ? (
                  <img
                    src={resolveMediaUrl(currentTrack.coverImage)}
                    alt={title}
                    referrerPolicy="no-referrer"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-emerald-900 to-emerald-700 text-amber-200">
                    <BookOpen className="w-16 h-16" />
                  </div>
                )}
              </div>

              <h2
                className={`mt-6 max-w-xl font-display text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 ${
                  language === 'ar' ? 'font-arabic text-2xl' : ''
                }`}
              >
                {title}
              </h2>
              <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">
                {currentTrack.speaker}
                {currentTrack.seriesTitle ? ` · ${currentTrack.seriesTitle}` : ''}
              </p>

              {loadingStatus && !audioError && (
                <p className="mt-2 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                  {loadingStatus}
                </p>
              )}

              {audioError && (
                <div className="mt-3 inline-flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-2 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
                  <WifiOff className="w-4 h-4 shrink-0" />
                  <span>{audioError}</span>
                </div>
              )}
            </div>

            {/* Scrubber & Transport Controls */}
            <div className="space-y-5">
              <div>
                <input
                  type="range"
                  min={0}
                  max={duration || 100}
                  step={0.5}
                  value={currentTime}
                  disabled={duration <= 0}
                  onChange={(e) => seek(Number(e.target.value))}
                  aria-label="Audio seek slider"
                  className="w-full accent-[#0F4C3A] dark:accent-emerald-500 cursor-pointer disabled:opacity-50"
                />
                <div className="mt-1 flex justify-between text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                  <span>{formatDuration(currentTime)}</span>
                  <span>{formatDuration(duration)}</span>
                </div>
              </div>

              <div className="flex items-center justify-center gap-3 sm:gap-5">
                <button
                  type="button"
                  onClick={cycleRepeat}
                  aria-label="Toggle repeat mode"
                  className={`min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-xl border text-xs font-medium cursor-pointer ${
                    repeatMode !== 'off'
                      ? 'border-emerald-700 bg-emerald-50 text-emerald-900 dark:border-emerald-500 dark:bg-emerald-950/40 dark:text-emerald-300'
                      : 'border-transparent text-slate-500 hover:bg-slate-200/60 dark:text-slate-400 dark:hover:bg-slate-800'
                  }`}
                >
                  {repeatMode === 'one' ? <Repeat1 className="w-5 h-5" /> : <Repeat className="w-5 h-5" />}
                </button>

                <button
                  type="button"
                  onClick={prevTrack}
                  aria-label="Previous track"
                  className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-xl text-slate-700 hover:bg-slate-200/60 dark:text-slate-200 dark:hover:bg-slate-800 cursor-pointer"
                >
                  <SkipBack className="w-5 h-5" />
                </button>

                <button
                  type="button"
                  onClick={() => skipBy(-10)}
                  aria-label="Rewind 10 seconds"
                  className="min-h-[44px] min-w-[44px] inline-flex flex-col items-center justify-center rounded-xl text-slate-700 hover:bg-slate-200/60 dark:text-slate-200 dark:hover:bg-slate-800 cursor-pointer"
                >
                  <RotateCcw className="w-5 h-5" />
                  <span className="text-[10px] font-mono">10s</span>
                </button>

                <button
                  type="button"
                  onClick={togglePlayPause}
                  aria-label={isPlaying ? 'Pause' : 'Play'}
                  className="h-16 w-16 inline-flex items-center justify-center rounded-full bg-[#0F4C3A] text-white shadow-lg hover:bg-[#0B3B2D] dark:bg-emerald-600 dark:hover:bg-emerald-500 cursor-pointer"
                >
                  {isBuffering ? (
                    <span className="h-6 w-6 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  ) : isPlaying ? (
                    <Pause className="w-7 h-7" />
                  ) : (
                    <Play className="w-7 h-7 fill-current ms-0.5" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => skipBy(10)}
                  aria-label="Forward 10 seconds"
                  className="min-h-[44px] min-w-[44px] inline-flex flex-col items-center justify-center rounded-xl text-slate-700 hover:bg-slate-200/60 dark:text-slate-200 dark:hover:bg-slate-800 cursor-pointer"
                >
                  <RotateCw className="w-5 h-5" />
                  <span className="text-[10px] font-mono">10s</span>
                </button>

                <button
                  type="button"
                  onClick={nextTrack}
                  aria-label="Next track"
                  className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-xl text-slate-700 hover:bg-slate-200/60 dark:text-slate-200 dark:hover:bg-slate-800 cursor-pointer"
                >
                  <SkipForward className="w-5 h-5" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const rates = [0.75, 1, 1.25, 1.5, 2];
                    const next = rates[(rates.indexOf(playbackRate) + 1) % rates.length];
                    setPlaybackRate(next);
                  }}
                  aria-label="Playback speed"
                  className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-2 text-xs font-mono font-semibold text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 cursor-pointer tabular-nums"
                >
                  {playbackRate}x
                </button>
              </div>

              {/* Contextual Quick Actions */}
              <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2">
                <DownloadAudioButton item={currentTrack} compact />
                <ReadButton item={currentTrack} compact />
              </div>

              {/* Queue Preview */}
              {queue.length > 1 && (
                <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-[#131C1A]">
                  <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
                    <ListMusic className="w-4 h-4" />
                    <span>Playback Queue ({queue.length})</span>
                  </div>
                  <div className="max-h-36 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                    {queue.map((q) => (
                      <button
                        key={q.id}
                        type="button"
                        onClick={() => playItem(q, queue)}
                        className={`flex w-full items-center justify-between py-2 text-start text-xs cursor-pointer ${
                          q.id === currentTrack.id
                            ? 'font-semibold text-emerald-800 dark:text-emerald-400'
                            : 'text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        <span className="truncate">{getLocalizedTitle(q, language)}</span>
                        <span className="ms-3 shrink-0 tabular-nums text-slate-400">
                          {formatDuration(q.audio?.durationSeconds || 0)}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
