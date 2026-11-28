import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  Bell,
  BookOpen,
  Download,
  Heart,
  HelpCircle,
  Library,
  Mic,
  RefreshCw,
  Search,
  Sparkles,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAudio } from '../../context/AudioContext';
import { getLocalizedTitle, t } from '../../i18n/translations';
import { APP_LOGO_PATH, getApiBaseUrl, resolveMediaUrl } from '../../services/api';
import { formatDuration } from '../../services/offlineManager';
import type { AppSection, ContentItem } from '../../types/content';
import { ContentCard } from '../content/ContentCard';

export const HomeView: React.FC = () => {
  const {
    language,
    setSection,
    isOnline,
    catalogItems,
    catalogLoading,
    catalogError,
    listeningHistory,
    favoriteItems,
    offlineRecords,
    notifications,
    refreshCatalogMeta,
    openContentDetails,
  } = useApp();
  const { playItem } = useAudio();

  const [visibleCount, setVisibleCount] = useState(12);
  const [refreshing, setRefreshing] = useState(false);

  // Use freshly synced (or instant SWR cached) catalog items with zero duplicate boot requests
  const offlineFallbackItems = useMemo(() => offlineRecords.map((r) => r.itemSnapshot), [offlineRecords]);
  const displayItems: ContentItem[] =
    catalogItems.length > 0
      ? catalogItems
      : !isOnline || catalogError
        ? offlineFallbackItems
        : [];
  const visibleItems = displayItems.slice(0, visibleCount);
  const heroItem = displayItems.find((i) => i.featured) || displayItems[0];

  const handleManualRefresh = async () => {
    setRefreshing(true);
    await refreshCatalogMeta(true);
    setRefreshing(false);
  };

  const sectionTiles: { id: AppSection; label: string; subtitle: string; icon: React.ReactNode }[] = [
    { id: 'tafseer', label: t(language, 'tafseer'), subtitle: 'Surah-by-Surah Exegesis', icon: <BookOpen className="w-5 h-5" /> },
    { id: 'hadith', label: t(language, 'hadith'), subtitle: 'Prophetic Narrations', icon: <Sparkles className="w-5 h-5" /> },
    { id: 'speeches', label: t(language, 'speeches'), subtitle: 'Friday & Eid Addresses', icon: <Mic className="w-5 h-5" /> },
    { id: 'qa', label: t(language, 'qa'), subtitle: 'Scholarly Rulings & Ask', icon: <HelpCircle className="w-5 h-5" /> },
    { id: 'lectures', label: t(language, 'lectures'), subtitle: 'Structured Courses', icon: <Library className="w-5 h-5" /> },
    { id: 'documents', label: t(language, 'documents'), subtitle: 'PDFs & Treatises', icon: <Download className="w-5 h-5" /> },
  ];

  return (
    <div className="space-y-8">
      {/* Editorial Hero Split */}
      <section className="relative overflow-hidden rounded-3xl border border-slate-200 dark:border-slate-800 bg-emerald-950">
        <div className="grid grid-cols-1 lg:grid-cols-12 items-stretch">
          <div className="lg:col-span-7 p-5 sm:p-8 lg:p-10 flex flex-col justify-between bg-gradient-to-br from-[#0F4C3A] via-[#0C3D2F] to-[#082920] text-white min-w-0">
            <div>
              <div className="flex items-center gap-3">
                <img
                  src={APP_LOGO_PATH}
                  alt="Minaratul Huda Logo"
                  className="h-11 w-11 sm:h-12 sm:w-12 rounded-xl object-cover ring-1 ring-white/25 shadow-md shrink-0"
                />
                <p className="text-xs sm:text-sm font-semibold tracking-wide text-amber-300">
                  {t(language, 'brandFull')}
                </p>
              </div>
              <h1 className="mt-3 font-display text-2xl sm:text-3xl lg:text-4xl font-bold leading-tight text-balance">
                {t(language, 'tagline')}
              </h1>
              <p className="mt-3 max-w-xl text-sm sm:text-base text-emerald-100/90 leading-relaxed">
                Listen offline, follow Arabic and translated transcripts, and study verified scholarly PDFs on any device.
              </p>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              {heroItem && (
                <button
                  type="button"
                  onClick={() => (heroItem.audio ? playItem(heroItem, displayItems) : openContentDetails(heroItem))}
                  className="inline-flex items-center gap-2 min-h-[44px] rounded-xl bg-amber-400 px-5 py-2.5 text-sm font-semibold text-slate-950 hover:bg-amber-300 transition-colors cursor-pointer"
                >
                  <span>{heroItem.audio ? t(language, 'playAudio') : t(language, 'read')}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}
              <button
                type="button"
                onClick={() => setSection('search')}
                className="inline-flex items-center gap-2 min-h-[44px] rounded-xl border border-white/25 bg-white/10 px-4 py-2.5 text-sm font-medium text-white hover:bg-white/15 transition-colors cursor-pointer"
              >
                <Search className="w-4 h-4" />
                <span>{t(language, 'search')}</span>
              </button>
              <button
                type="button"
                onClick={handleManualRefresh}
                aria-label={t(language, 'pullToRefresh')}
                className="inline-flex items-center gap-1.5 min-h-[44px] rounded-xl border border-white/20 px-3.5 py-2 text-xs font-medium text-emerald-100 hover:bg-white/10 transition-colors cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${refreshing || (catalogLoading && displayItems.length === 0) ? 'animate-spin' : ''}`} />
                <span>{t(language, 'pullToRefresh')}</span>
              </button>
            </div>
          </div>

          <div className="lg:col-span-5 relative min-h-[220px] lg:min-h-full">
            <img
              src="/assets/aistudio/wandegeya_3c75f36b.jfif"
              alt="Minaratul Huda Mosque"
              referrerPolicy="no-referrer"
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent lg:bg-gradient-to-r lg:from-[#082920]/70 lg:via-transparent lg:to-transparent" />
            {heroItem && (
              <button
                type="button"
                onClick={() => openContentDetails(heroItem)}
                className="absolute bottom-4 start-4 end-4 text-start rounded-xl bg-black/55 backdrop-blur-md p-3.5 text-white hover:bg-black/70 transition-colors cursor-pointer"
              >
                <p className="text-[11px] font-medium text-amber-300">{t(language, 'featuredLecture')}</p>
                <p className="mt-0.5 text-sm font-semibold truncate">{getLocalizedTitle(heroItem, language)}</p>
                <p className="text-xs text-slate-300 truncate">{heroItem.speaker}</p>
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Continue Listening (if history exists) */}
      {listeningHistory.length > 0 && (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100">
              {t(language, 'continueListening')}
            </h2>
            <button
              type="button"
              onClick={() => setSection('history')}
              className="text-xs font-medium text-emerald-800 hover:underline dark:text-emerald-400 cursor-pointer"
            >
              View History
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {listeningHistory.slice(0, 3).map((entry) => (
              <button
                key={entry.contentId}
                type="button"
                onClick={() => playItem(entry.item, undefined, entry.positionSeconds)}
                className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3.5 text-start hover:border-emerald-700/40 dark:border-slate-800 dark:bg-[#131C1A] cursor-pointer"
              >
                {entry.item.coverImage ? (
                  <img
                    src={resolveMediaUrl(entry.item.coverImage)}
                    alt={entry.item.title}
                    referrerPolicy="no-referrer"
                    className="h-12 w-12 rounded-xl object-cover shrink-0"
                  />
                ) : (
                  <img
                    src={APP_LOGO_PATH}
                    alt="Minaratul Huda"
                    className="h-12 w-12 rounded-xl object-cover shrink-0 border border-slate-200 dark:border-slate-700"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                    {getLocalizedTitle(entry.item, language)}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums truncate">
                    Resume at {formatDuration(entry.positionSeconds || 0)}
                    {entry.durationSeconds ? ` / ${formatDuration(entry.durationSeconds)}` : ''}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Major Sections Grid */}
      <section>
        <h2 className="mb-4 font-display text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100">
          Knowledge Sections
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {sectionTiles.map((tile) => (
            <button
              key={tile.id}
              type="button"
              onClick={() => setSection(tile.id)}
              className="flex flex-col items-start justify-between rounded-2xl border border-slate-200 bg-white p-4 text-start transition-colors hover:border-emerald-700/50 dark:border-slate-800 dark:bg-[#131C1A] dark:hover:border-emerald-600/50 cursor-pointer"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-950/5 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">
                {tile.icon}
              </div>
              <div className="mt-3">
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{tile.label}</p>
                <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1">{tile.subtitle}</p>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Personal Shortcuts + Latest Announcements */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-5 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setSection('favorites')}
            className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-start hover:border-emerald-700/40 dark:border-slate-800 dark:bg-[#131C1A] cursor-pointer"
          >
            <Heart className="w-5 h-5 text-rose-600 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t(language, 'favorites')}</p>
              <p className="text-xs text-slate-500 tabular-nums">{favoriteItems.length} saved</p>
            </div>
          </button>
          <button
            type="button"
            onClick={() => setSection('downloads')}
            className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-start hover:border-emerald-700/40 dark:border-slate-800 dark:bg-[#131C1A] cursor-pointer"
          >
            <Download className="w-5 h-5 text-emerald-700 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t(language, 'downloads')}</p>
              <p className="text-xs text-slate-500 tabular-nums">{offlineRecords.length} offline</p>
            </div>
          </button>
        </div>

        {notifications.length > 0 && (
          <div className="lg:col-span-7 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-[#131C1A]">
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-800 dark:text-emerald-400">
              <Bell className="w-3.5 h-3.5" />
              <span>Latest Announcement</span>
            </div>
            <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">{notifications[0].title}</p>
            <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300 line-clamp-1">{notifications[0].body}</p>
          </div>
        )}
      </section>

      {/* Recently Added Feed */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100">
            {isOnline ? t(language, 'recentlyAdded') : t(language, 'downloads')}
          </h2>
        </div>

        {catalogLoading && displayItems.length === 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((n) => (
              <div
                key={n}
                className="h-44 animate-pulse rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-[#131C1A]"
              />
            ))}
          </div>
        ) : catalogError && displayItems.length === 0 ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center dark:border-amber-900/60 dark:bg-amber-950/30">
            <p className="text-sm text-amber-900 dark:text-amber-200">{catalogError}</p>
            <button
              type="button"
              onClick={handleManualRefresh}
              className="mt-3 min-h-[40px] rounded-xl bg-amber-800 px-4 py-2 text-xs font-medium text-white cursor-pointer"
            >
              Retry
            </button>
          </div>
        ) : displayItems.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center space-y-3 dark:border-slate-800 dark:bg-[#131C1A]">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
              {t(language, 'emptyCatalog')}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {getApiBaseUrl()
                ? 'Published audio lectures, PDFs, transcripts, and Q&A from the scholar library will appear here automatically.'
                : 'Connect your content server endpoint in Settings to load published lectures, audio, transcripts, and PDFs.'}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
              <button
                type="button"
                onClick={handleManualRefresh}
                className="inline-flex items-center gap-2 min-h-[40px] rounded-xl bg-[#0F4C3A] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0B3B2D] dark:bg-emerald-600 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>{t(language, 'pullToRefresh')}</span>
              </button>
              {!getApiBaseUrl() && (
                <button
                  type="button"
                  onClick={() => setSection('settings')}
                  className="inline-flex items-center gap-2 min-h-[40px] rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 cursor-pointer"
                >
                  <span>{t(language, 'configureServer')}</span>
                </button>
              )}
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {visibleItems.map((item) => (
                <ContentCard key={item.id} item={item} queue={displayItems} />
              ))}
            </div>

            {visibleCount < displayItems.length && (
              <div className="mt-6 flex justify-center">
                <button
                  type="button"
                  onClick={() => setVisibleCount((c) => c + 12)}
                  className="min-h-[44px] rounded-xl border border-slate-200 bg-white px-6 py-2.5 text-sm font-medium text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 cursor-pointer"
                >
                  {t(language, 'loadMore')}
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
};
