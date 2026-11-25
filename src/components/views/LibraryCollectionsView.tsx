import React, { useState } from 'react';
import { BookOpen, FileText, Headphones, Heart, Play, Trash2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAudio } from '../../context/AudioContext';
import { getLocalizedTitle, t } from '../../i18n/translations';
import { formatBytes, formatDuration } from '../../services/offlineManager';
import { ContentCard } from '../content/ContentCard';

export const DownloadsView: React.FC = () => {
  const {
    language,
    offlineRecords,
    downloadStates,
    removeDownload,
    clearDownloads,
    openReader,
    openContentDetails,
  } = useApp();
  const { playItem } = useAudio();
  const [tab, setTab] = useState<'audio' | 'document'>('audio');

  const audioDownloads = offlineRecords.filter((r) => r.kind === 'audio');
  const docDownloads = offlineRecords.filter((r) => r.kind === 'document');
  const activeJobs = Object.values(downloadStates).filter((d) => d.status === 'downloading' || d.status === 'error');
  const totalBytes = offlineRecords.reduce((acc, r) => acc + (r.sizeBytes || 0), 0);

  const visibleList = tab === 'audio' ? audioDownloads : docDownloads;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-slate-200 pb-5 dark:border-slate-800">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100">
            {t(language, 'downloads')}
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400 tabular-nums">
            {offlineRecords.length} offline files stored · {formatBytes(totalBytes)} used
          </p>
        </div>

        {offlineRecords.length > 0 && (
          <button
            type="button"
            onClick={clearDownloads}
            className="inline-flex items-center gap-1.5 min-h-[40px] self-start rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2 text-xs font-medium text-rose-700 hover:bg-rose-100 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300 cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
            <span>{t(language, 'clearCache')}</span>
          </button>
        )}
      </div>

      {/* Active / Interrupted Transfers */}
      {activeJobs.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 space-y-2 dark:border-amber-900/50 dark:bg-amber-950/20">
          <p className="text-xs font-semibold text-amber-900 dark:text-amber-200">Active Transfers</p>
          {activeJobs.map((job) => (
            <div key={job.key} className="flex items-center justify-between text-xs">
              <span className="truncate">{job.contentId} ({job.kind})</span>
              <span className="tabular-nums font-medium">
                {job.status === 'error' ? job.error : `${job.progress}%`}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Segmented Switcher: AUDIO | DOCUMENTS */}
      <div className="inline-flex items-center gap-1 rounded-xl bg-slate-200/70 p-1 dark:bg-slate-800">
        <button
          type="button"
          onClick={() => setTab('audio')}
          className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
            tab === 'audio'
              ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-700 dark:text-white'
              : 'text-slate-600 dark:text-slate-300'
          }`}
        >
          <Headphones className="w-4 h-4" />
          <span>AUDIO ({audioDownloads.length})</span>
        </button>
        <button
          type="button"
          onClick={() => setTab('document')}
          className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
            tab === 'document'
              ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-700 dark:text-white'
              : 'text-slate-600 dark:text-slate-300'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>DOCUMENTS ({docDownloads.length})</span>
        </button>
      </div>

      {visibleList.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center dark:border-slate-800 dark:bg-[#131C1A]">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            No {tab === 'audio' ? 'audio lectures' : 'PDF documents'} downloaded yet. Tap Download on any teaching to save it for offline study.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-[#131C1A]">
          {visibleList.map((rec) => (
            <div key={rec.key} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4">
              <button
                type="button"
                onClick={() => openContentDetails(rec.itemSnapshot)}
                className="min-w-0 flex-1 text-start cursor-pointer"
              >
                <p className="text-xs font-medium text-emerald-800 dark:text-emerald-400">
                  {rec.categoryName} · {rec.format} · <span className="tabular-nums">{formatBytes(rec.sizeBytes)}</span>
                </p>
                <p className="mt-0.5 text-sm sm:text-base font-semibold text-slate-900 dark:text-slate-100 truncate">
                  {getLocalizedTitle(rec.itemSnapshot, language)}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{rec.speaker}</p>
              </button>

              <div className="flex items-center gap-2 shrink-0">
                {rec.kind === 'audio' ? (
                  <button
                    type="button"
                    onClick={() => playItem(rec.itemSnapshot)}
                    className="inline-flex items-center gap-1.5 min-h-[40px] rounded-xl bg-[#0F4C3A] px-3.5 py-2 text-xs font-medium text-white dark:bg-emerald-600 cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Play Offline</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => openReader(rec.itemSnapshot, 'pdf')}
                    className="inline-flex items-center gap-1.5 min-h-[40px] rounded-xl bg-[#0F4C3A] px-3.5 py-2 text-xs font-medium text-white dark:bg-emerald-600 cursor-pointer"
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>Read Offline</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => removeDownload(rec.contentId, rec.kind, rec.url)}
                  aria-label="Delete offline file"
                  className="min-h-[40px] min-w-[40px] inline-flex items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:text-rose-600 dark:border-slate-700 dark:text-slate-400 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export const FavoritesView: React.FC = () => {
  const { language, favoriteItems } = useApp();

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-5 dark:border-slate-800">
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100">
          {t(language, 'favorites')}
        </h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Your saved Tafseer, Hadith, Speeches, Q&amp;A, Lectures, and Documents.
        </p>
      </div>

      {favoriteItems.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center dark:border-slate-800 dark:bg-[#131C1A]">
          <Heart className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
          <p className="text-sm text-slate-500 dark:text-slate-400">
            No favorites saved yet. Tap the heart icon on any teaching to save it here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {favoriteItems.map((item) => (
            <ContentCard key={item.id} item={item} queue={favoriteItems} />
          ))}
        </div>
      )}
    </div>
  );
};

export const HistoryView: React.FC = () => {
  const { language, listeningHistory, readingHistory, openReader } = useApp();
  const { playItem } = useAudio();

  return (
    <div className="space-y-8">
      <div className="border-b border-slate-200 pb-5 dark:border-slate-800">
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100">
          {t(language, 'history')}
        </h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Continue listening where you paused and revisit recently read transcripts and PDFs.
        </p>
      </div>

      {/* Listening History */}
      <section className="space-y-3">
        <h2 className="font-display text-lg font-bold text-slate-900 dark:text-slate-100">
          Recently Played Audio
        </h2>
        {listeningHistory.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500 dark:border-slate-800 dark:bg-[#131C1A]">
            No audio listening history yet.
          </div>
        ) : (
          <div className="divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-[#131C1A]">
            {listeningHistory.map((entry) => (
              <div key={entry.contentId} className="flex items-center justify-between gap-4 p-4">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                    {getLocalizedTitle(entry.item, language)}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                    {entry.item.speaker} · Position {formatDuration(entry.positionSeconds || 0)}
                    {entry.durationSeconds ? ` / ${formatDuration(entry.durationSeconds)}` : ''}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => playItem(entry.item, undefined, entry.positionSeconds)}
                  className="min-h-[40px] rounded-xl bg-[#0F4C3A] px-4 py-2 text-xs font-medium text-white dark:bg-emerald-600 cursor-pointer shrink-0"
                >
                  Resume
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Reading History */}
      <section className="space-y-3">
        <h2 className="font-display text-lg font-bold text-slate-900 dark:text-slate-100">
          Recently Read Documents &amp; Transcripts
        </h2>
        {readingHistory.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500 dark:border-slate-800 dark:bg-[#131C1A]">
            No reading history yet.
          </div>
        ) : (
          <div className="divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-[#131C1A]">
            {readingHistory.map((entry) => (
              <div key={entry.contentId} className="flex items-center justify-between gap-4 p-4">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                    {getLocalizedTitle(entry.item, language)}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                    {entry.item.speaker} · Progress {entry.scrollPercent || 0}%
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => openReader(entry.item)}
                  className="min-h-[40px] rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 cursor-pointer shrink-0"
                >
                  {t(language, 'read')}
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
