import React, { useState } from 'react';
import { BookOpen } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import {
  getLocalizedCategoryName,
  getLocalizedDescription,
  getLocalizedTitle,
  t,
} from '../../i18n/translations';
import { resolveMediaUrl } from '../../services/api';
import { formatDuration } from '../../services/offlineManager';
import type { ContentItem } from '../../types/content';
import {
  DownloadAudioButton,
  DownloadDocumentButton,
  FavoriteButton,
  PlayButton,
  ReadButton,
} from './ActionButtons';
import { getContentActions } from './availability';

interface ContentCardProps {
  item: ContentItem;
  queue?: ContentItem[];
  compact?: boolean;
}

export const ContentCard: React.FC<ContentCardProps> = ({ item, queue, compact }) => {
  const { language, openContentDetails, isItemDownloaded, isOnline } = useApp();
  const [imgError, setImgError] = useState(false);

  const actions = getContentActions(item);
  const title = getLocalizedTitle(item, language);
  const description = getLocalizedDescription(item, language);
  const categoryLabel = getLocalizedCategoryName(item, language);

  const downloadedAudio = isItemDownloaded(item.id, 'audio');
  const downloadedDoc = isItemDownloaded(item.id, 'document');
  const isOfflineReady = downloadedAudio || downloadedDoc || actions.canReadTranscript;

  return (
    <article
      onClick={() => openContentDetails(item)}
      className="group flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-5 transition-colors hover:border-emerald-700/40 dark:border-slate-800 dark:bg-[#131C1A] dark:hover:border-emerald-600/40 cursor-pointer"
    >
      <div>
        <div className="flex items-start gap-4">
          {/* Cover Thumbnail with Zero-Broken-Image fallback */}
          <div className="relative h-20 w-20 sm:h-24 sm:w-24 shrink-0 overflow-hidden rounded-xl border border-slate-200/70 bg-emerald-950/5 dark:border-slate-800 dark:bg-emerald-950/40">
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
                <BookOpen className="h-7 w-7" />
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1">
            {/* Unboxed Clean Metadata Line */}
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
              <span className="font-medium text-emerald-800 dark:text-emerald-400">{categoryLabel}</span>
              {item.subcategory && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>{item.subcategory}</span>
                </>
              )}
              {item.episodeNumber ? (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="tabular-nums">Ep. {item.episodeNumber}</span>
                </>
              ) : null}
              {item.audio?.durationSeconds ? (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="tabular-nums">{formatDuration(item.audio.durationSeconds)}</span>
                </>
              ) : null}
            </div>

            <h3
              className={`mt-1.5 font-display text-base sm:text-lg font-semibold leading-snug text-slate-900 dark:text-slate-100 line-clamp-2 ${
                language === 'ar' ? 'font-arabic text-lg leading-relaxed' : ''
              }`}
            >
              {title}
            </h3>

            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 truncate">
              {item.speaker} <span aria-hidden="true">·</span> <span className="tabular-nums">{item.date}</span>
              {!isOnline && !isOfflineReady && (
                <>
                  {' '}
                  <span aria-hidden="true">·</span>{' '}
                  <span className="text-amber-700 dark:text-amber-400">{t(language, 'unavailableOffline')}</span>
                </>
              )}
              {(downloadedAudio || downloadedDoc) && (
                <>
                  {' '}
                  <span aria-hidden="true">·</span>{' '}
                  <span className="text-emerald-700 dark:text-emerald-400">{t(language, 'downloaded')}</span>
                </>
              )}
            </p>
          </div>

          <div className="shrink-0">
            <FavoriteButton item={item} />
          </div>
        </div>

        {!compact && (
          <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300 line-clamp-2">
            {description}
          </p>
        )}
      </div>

      {/* Dynamic Universal Action Bar: renders ONLY available actions */}
      <div className="mt-4 flex flex-wrap items-center gap-2 pt-3 border-t border-slate-100 dark:border-slate-800/80">
        {actions.canPlayAudio && <PlayButton item={item} queue={queue} compact />}
        {actions.canDownloadAudio && <DownloadAudioButton item={item} compact />}
        {actions.canRead && <ReadButton item={item} compact />}
        {actions.canDownloadDocument && <DownloadDocumentButton item={item} compact />}
      </div>
    </article>
  );
};
