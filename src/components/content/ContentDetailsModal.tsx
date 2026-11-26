import React, { useState } from 'react';
import { BookOpen, Calendar, ListPlus, MapPin, Tag, User, WifiOff, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAudio } from '../../context/AudioContext';
import {
  getLocalizedCategoryName,
  getLocalizedDescription,
  getLocalizedTitle,
  t,
} from '../../i18n/translations';
import { resolveMediaUrl } from '../../services/api';
import { formatBytes, formatDuration } from '../../services/offlineManager';
import {
  DownloadAudioButton,
  DownloadDocumentButton,
  FavoriteButton,
  PlayButton,
  ReadButton,
  ShareButton,
} from './ActionButtons';
import { getContentActions } from './availability';

export const ContentDetailsModal: React.FC = () => {
  const { selectedContent, closeContentDetails, language, isOnline, isItemDownloaded } = useApp();
  const { addToQueue } = useAudio();
  const [imgError, setImgError] = useState(false);

  if (!selectedContent) return null;

  const item = selectedContent;
  const actions = getContentActions(item);
  const title = getLocalizedTitle(item, language);
  const description = getLocalizedDescription(item, language);
  const categoryLabel = getLocalizedCategoryName(item, language);

  const hasOfflineAudio = isItemDownloaded(item.id, 'audio');
  const hasOfflineDoc = isItemDownloaded(item.id, 'document');

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/55 backdrop-blur-xs p-0 sm:p-4"
      onClick={closeContentDetails}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-t-3xl sm:rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-[#131C1A] shadow-2xl"
      >
        {/* Header Bar */}
        <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-slate-100 bg-white/95 px-5 py-4 backdrop-blur-md dark:border-slate-800 dark:bg-[#131C1A]/95">
          <div className="min-w-0">
            <p className="text-xs font-medium text-emerald-800 dark:text-emerald-400 truncate">
              {categoryLabel}
              {item.seriesTitle ? ` · ${item.seriesTitle}` : ''}
              {item.episodeNumber ? ` · Episode ${item.episodeNumber}` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={closeContentDetails}
            aria-label="Close details"
            className="min-h-[40px] min-w-[40px] inline-flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 sm:p-6 space-y-5">
          {/* Hero Cover + Title */}
          <div className="flex flex-col sm:flex-row gap-5">
            <div className="h-44 sm:h-36 sm:w-44 shrink-0 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-emerald-950/10">
              {item.coverImage && !imgError ? (
                <img
                  src={resolveMediaUrl(item.coverImage)}
                  alt={title}
                  referrerPolicy="no-referrer"
                  onError={() => setImgError(true)}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-emerald-900 to-emerald-700 text-amber-200">
                  <BookOpen className="w-10 h-10" />
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0 space-y-2.5">
              <h2
                className={`font-display text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 leading-snug ${
                  language === 'ar' ? 'font-arabic text-2xl' : ''
                }`}
              >
                {title}
              </h2>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-slate-600 dark:text-slate-300">
                <span className="inline-flex items-center gap-1.5">
                  <User className="w-4 h-4 text-slate-400" />
                  {item.speaker}
                </span>
                <span className="inline-flex items-center gap-1.5 tabular-nums">
                  <Calendar className="w-4 h-4 text-slate-400" />
                  {item.date}
                </span>
                {item.location && (
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-slate-400" />
                    {item.location}
                  </span>
                )}
              </div>

              {/* Offline Availability Status */}
              <div className="text-xs font-medium">
                {hasOfflineAudio || hasOfflineDoc ? (
                  <span className="text-emerald-700 dark:text-emerald-400">
                    {t(language, 'availableOffline')}
                    {hasOfflineAudio ? ' · Audio' : ''}
                    {hasOfflineDoc ? ' · Document' : ''}
                  </span>
                ) : isOnline ? (
                  <span className="text-slate-500 dark:text-slate-400">{t(language, 'online')}</span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-amber-700 dark:text-amber-400">
                    <WifiOff className="w-3.5 h-3.5" />
                    {t(language, 'unavailableOffline')}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Description */}
          <p className="text-sm sm:text-base leading-relaxed text-slate-700 dark:text-slate-300">
            {description}
          </p>

          {/* Media Specifications */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-xl border border-slate-200/80 bg-slate-50/70 p-4 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300">
            <div>
              <span className="font-semibold text-slate-800 dark:text-slate-200">Audio Lecture: </span>
              {item.audio ? (
                <span className="tabular-nums">
                  {(item.audio.format || 'AUDIO').toUpperCase()}
                  {item.audio.durationSeconds > 0 ? ` · ${formatDuration(item.audio.durationSeconds)}` : ''}
                  {item.audio.sizeBytes > 0 ? ` · ${formatBytes(item.audio.sizeBytes)}` : ''}
                </span>
              ) : (
                <span>Not attached</span>
              )}
            </div>
            <div>
              <span className="font-semibold text-slate-800 dark:text-slate-200">Written Material: </span>
              {item.document ? (
                <span className="tabular-nums">
                  {item.document.documentType} ({item.document.format}) · {formatBytes(item.document.sizeBytes)}
                </span>
              ) : actions.canReadTranscript ? (
                <span>Transcript available (EN / AR / LG)</span>
              ) : (
                <span>Not attached</span>
              )}
            </div>
            {item.quranReferences && (
              <div className="sm:col-span-2">
                <span className="font-semibold text-slate-800 dark:text-slate-200">Quran References: </span>
                <span>{item.quranReferences}</span>
              </div>
            )}
          </div>

          {/* Tags as clean unboxed text */}
          {item.tags && item.tags.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <Tag className="w-3.5 h-3.5 shrink-0" />
              {item.tags.map((tag, i) => (
                <React.Fragment key={tag}>
                  {i > 0 && <span aria-hidden="true">·</span>}
                  <span>{tag}</span>
                </React.Fragment>
              ))}
            </div>
          )}

          {/* Universal Action Matrix */}
          <div className="flex flex-wrap items-center gap-2.5 pt-4 border-t border-slate-200 dark:border-slate-800">
            {actions.canPlayAudio && <PlayButton item={item} />}
            {actions.canDownloadAudio && <DownloadAudioButton item={item} />}

            {/* If BOTH transcript and PDF exist, offer explicit Read Transcript AND Read PDF buttons! */}
            {actions.canReadTranscript && (
              <ReadButton item={item} mode="transcript" labelOverride={t(language, 'readTranscript')} />
            )}
            {actions.canReadDocument && (
              <ReadButton item={item} mode="pdf" labelOverride={t(language, 'readPdf')} />
            )}

            {actions.canDownloadDocument && <DownloadDocumentButton item={item} />}

            {actions.canPlayAudio && (
              <button
                type="button"
                onClick={() => addToQueue(item)}
                className="inline-flex items-center gap-1.5 min-h-[40px] px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 cursor-pointer"
              >
                <ListPlus className="w-4 h-4" />
                <span>Queue</span>
              </button>
            )}

            <div className="flex items-center gap-2 ms-auto">
              <FavoriteButton item={item} />
              <ShareButton item={item} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
