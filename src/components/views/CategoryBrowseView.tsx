import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Layers, RefreshCw } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { t } from '../../i18n/translations';
import { apiRequest, getApiBaseUrl } from '../../services/api';
import type { ContentItem } from '../../types/content';
import { ContentCard } from '../content/ContentCard';

interface CategoryBrowseViewProps {
  categorySlug: 'tafseer' | 'hadith' | 'speeches' | 'lectures' | 'documents';
  titleKey: string;
  subtitle: string;
}

const LS_CATEGORY_FILTERS = 'minaratul_huda_category_filters_v1';

interface CategoryFilterState {
  selectedSeriesId: string;
  mediaFilter: 'all' | 'audio' | 'document' | 'transcript';
  sort: 'newest' | 'popular' | 'episode';
}

function readCategoryFilter(slug: string): CategoryFilterState {
  try {
    const all = JSON.parse(localStorage.getItem(LS_CATEGORY_FILTERS) || '{}');
    const saved = all?.[slug];
    if (saved) {
      return {
        selectedSeriesId: typeof saved.selectedSeriesId === 'string' ? saved.selectedSeriesId : '',
        mediaFilter:
          saved.mediaFilter === 'audio' || saved.mediaFilter === 'document' || saved.mediaFilter === 'transcript'
            ? saved.mediaFilter
            : 'all',
        sort: saved.sort === 'popular' || saved.sort === 'episode' ? saved.sort : 'newest',
      };
    }
  } catch {
    // ignore storage errors
  }
  return { selectedSeriesId: '', mediaFilter: 'all', sort: 'newest' };
}

function writeCategoryFilter(slug: string, state: CategoryFilterState) {
  try {
    const all = JSON.parse(localStorage.getItem(LS_CATEGORY_FILTERS) || '{}');
    all[slug] = state;
    localStorage.setItem(LS_CATEGORY_FILTERS, JSON.stringify(all));
  } catch {
    // ignore storage errors
  }
}

export const CategoryBrowseView: React.FC<CategoryBrowseViewProps> = ({
  categorySlug,
  titleKey,
  subtitle,
}) => {
  const {
    language,
    seriesList,
    offlineRecords,
    catalogItems,
    catalogLoading,
    catalogError,
    isOnline,
    apiBaseUrl,
    catalogVersion,
    refreshCatalogMeta,
  } = useApp();
  const offlineRecordsRef = useRef(offlineRecords);
  offlineRecordsRef.current = offlineRecords;

  const initialFilter = readCategoryFilter(categorySlug);
  const [selectedSeriesId, setSelectedSeriesId] = useState<string>(initialFilter.selectedSeriesId);
  const [mediaFilter, setMediaFilter] = useState<'all' | 'audio' | 'document' | 'transcript'>(
    initialFilter.mediaFilter
  );
  const [sort, setSort] = useState<'newest' | 'popular' | 'episode'>(initialFilter.sort);
  const [serverItems, setServerItems] = useState<ContentItem[] | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const categorySeries = seriesList.filter((s) => s.categorySlug === categorySlug);

  // Instant client-side projection from SWR/live catalogItems for zero-latency switching & reopen
  const instantCatalogItems = useMemo(() => {
    const filtered = catalogItems.filter((i) => {
      if (i.categorySlug !== categorySlug) return false;
      if (selectedSeriesId && i.seriesId !== selectedSeriesId) return false;
      if (mediaFilter === 'audio' && !i.audio?.url) return false;
      if (mediaFilter === 'document' && !i.document?.url) return false;
      if (mediaFilter === 'transcript' && !i.transcript) return false;
      return true;
    });
    return [...filtered].sort((a, b) => {
      if (sort === 'popular') return (b.playCount || 0) - (a.playCount || 0);
      if (sort === 'episode') return (a.episodeNumber || 0) - (b.episodeNumber || 0);
      return (b.publishedAt || b.createdAt || '').localeCompare(a.publishedAt || a.createdAt || '');
    });
  }, [catalogItems, categorySlug, selectedSeriesId, mediaFilter, sort]);

  useEffect(() => {
    const saved = readCategoryFilter(categorySlug);
    setSelectedSeriesId(saved.selectedSeriesId);
    setMediaFilter(saved.mediaFilter);
    setSort(saved.sort);
    setServerItems(null);
    setPage(1);
  }, [categorySlug]);

  useEffect(() => {
    writeCategoryFilter(categorySlug, { selectedSeriesId, mediaFilter, sort });
  }, [categorySlug, selectedSeriesId, mediaFilter, sort]);

  const fetchItems = useCallback(
    async (pageNum = 1, append = false, forceRefresh = false) => {
      if (!getApiBaseUrl()) {
        setServerItems([]);
        setFetching(false);
        setError(null);
        return;
      }
      setFetching(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          category: categorySlug,
          page: String(pageNum),
          limit: '20',
          sort,
        });
        if (selectedSeriesId) params.set('seriesId', selectedSeriesId);
        if (mediaFilter !== 'all') params.set('media', mediaFilter);

        const res = await apiRequest<{ items: ContentItem[]; pagination: { totalPages: number } }>(
          `/api/content?${params.toString()}`,
          { forceRefresh }
        );
        if (append) {
          setServerItems((prev) => [...(prev || []), ...(res.items || [])]);
        } else {
          setServerItems(res.items || []);
        }
        setPage(pageNum);
        setTotalPages(res.pagination?.totalPages || 1);
      } catch (err: any) {
        if (isOnline && instantCatalogItems.length === 0) {
          setError(err?.message || 'Unable to fetch items from the content server.');
        }
      } finally {
        setFetching(false);
      }
    },
    [categorySlug, selectedSeriesId, mediaFilter, sort, isOnline, instantCatalogItems.length]
  );

  // Only fire category endpoint if filter/sort isn't default OR catalog has many items; background sync updates catalogItems automatically
  useEffect(() => {
    const isDefaultUnfiltered = !selectedSeriesId && mediaFilter === 'all' && sort === 'newest';
    if (isDefaultUnfiltered && catalogItems.length > 0 && catalogItems.length < 500) {
      setServerItems(null);
      setError(null);
      return;
    }
    fetchItems(1, false);
  }, [fetchItems, apiBaseUrl, isOnline, catalogVersion, selectedSeriesId, mediaFilter, sort, catalogItems.length]);

  const offlineFallback = useMemo(
    () =>
      Array.from(
        new Map(
          offlineRecords
            .map((r) => r.itemSnapshot)
            .filter((i) => i.categorySlug === categorySlug)
            .map((i) => [i.id, i])
        ).values()
      ),
    [offlineRecords, categorySlug]
  );

  const items =
    serverItems !== null
      ? serverItems
      : instantCatalogItems.length > 0
        ? instantCatalogItems
        : !isOnline || error || catalogError
          ? offlineFallback
          : [];

  const showSkeleton = (fetching || catalogLoading) && items.length === 0;
  const effectiveError = items.length === 0 ? error || catalogError : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-slate-200 pb-5 dark:border-slate-800">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100">
            {t(language, titleKey)}
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{subtitle}</p>
        </div>
        <button
          type="button"
          onClick={() => {
            refreshCatalogMeta(true);
            fetchItems(1, false, true);
          }}
          className="inline-flex items-center gap-2 min-h-[40px] self-start rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${fetching || catalogLoading ? 'animate-spin' : ''}`} />
          <span>{t(language, 'pullToRefresh')}</span>
        </button>
      </div>

      {/* Series Selector (Tafseer / Hadith / Speeches Series) */}
      {categorySeries.length > 0 && (
        <section>
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
            <Layers className="w-4 h-4" />
            <span>{t(language, 'allSeries')}</span>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setSelectedSeriesId('')}
              className={`min-h-[40px] rounded-xl border px-4 py-2 text-xs font-medium transition-colors cursor-pointer ${
                selectedSeriesId === ''
                  ? 'border-[#0F4C3A] bg-[#0F4C3A] text-white dark:border-emerald-500 dark:bg-emerald-600'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-[#131C1A] dark:text-slate-300'
              }`}
            >
              {t(language, 'allItems')}
            </button>
            {categorySeries.map((ser) => (
              <button
                key={ser.id}
                type="button"
                onClick={() => setSelectedSeriesId(ser.id)}
                className={`min-h-[40px] rounded-xl border px-4 py-2 text-xs font-medium transition-colors cursor-pointer ${
                  selectedSeriesId === ser.id
                    ? 'border-[#0F4C3A] bg-[#0F4C3A] text-white dark:border-emerald-500 dark:bg-emerald-600'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-[#131C1A] dark:text-slate-300'
                }`}
              >
                {ser.title} ({ser.episodeCount || 0})
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Filter & Sort Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="max-w-full overflow-x-auto no-scrollbar rounded-xl bg-slate-200/60 p-1 dark:bg-slate-800/80">
          <div className="flex items-center gap-1 w-max">
            {(['all', 'audio', 'document', 'transcript'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMediaFilter(m)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  mediaFilter === m
                    ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-700 dark:text-white'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-300'
                }`}
              >
                {m === 'all' ? 'All Formats' : m === 'audio' ? 'Audio' : m === 'document' ? 'PDF / Docs' : 'Transcripts'}
              </button>
            ))}
          </div>
        </div>

        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as any)}
          aria-label="Sort teachings"
          className="min-h-[38px] rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
        >
          <option value="newest">Newest First</option>
          <option value="episode">Episode Order</option>
          <option value="popular">Most Listened</option>
        </select>
      </div>

      {/* Content Grid */}
      {showSkeleton ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((n) => (
            <div
              key={n}
              className="h-44 animate-pulse rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-[#131C1A]"
            />
          ))}
        </div>
      ) : effectiveError && items.length === 0 ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center dark:border-amber-900/60 dark:bg-amber-950/30">
          <p className="text-sm text-amber-900 dark:text-amber-200">{effectiveError}</p>
          <button
            type="button"
            onClick={() => fetchItems(1, false, true)}
            className="mt-3 min-h-[40px] rounded-xl bg-amber-800 px-4 py-2 text-xs font-medium text-white cursor-pointer"
          >
            Retry
          </button>
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center space-y-2 dark:border-slate-800 dark:bg-[#131C1A]">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
            {t(language, 'emptyCatalog')}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Published teachings in this category will appear here automatically once available from your connected server.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {items.map((item) => (
              <ContentCard key={item.id} item={item} queue={items} />
            ))}
          </div>

          {page < totalPages && isOnline && (
            <div className="flex justify-center pt-2">
              <button
                type="button"
                onClick={() => fetchItems(page + 1, true)}
                className="min-h-[44px] rounded-xl border border-slate-200 bg-white px-6 py-2.5 text-sm font-medium text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 cursor-pointer"
              >
                {t(language, 'loadMore')}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};
