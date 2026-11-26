import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Search as SearchIcon } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { t } from '../../i18n/translations';
import { apiRequest } from '../../services/api';
import type { ContentItem } from '../../types/content';
import { ContentCard } from '../content/ContentCard';

const GROUP_ORDER: { slug: string; label: string }[] = [
  { slug: 'tafseer', label: 'TAFSEER' },
  { slug: 'hadith', label: 'HADITH' },
  { slug: 'speeches', label: 'SPEECHES' },
  { slug: 'qa', label: 'Q&A' },
  { slug: 'lectures', label: 'LECTURES' },
  { slug: 'documents', label: 'DOCUMENTS' },
];

export const SearchView: React.FC = () => {
  const { language, offlineRecords, catalogItems, apiBaseUrl, isOnline, catalogVersion } = useApp();
  const offlineRecordsRef = useRef(offlineRecords);
  offlineRecordsRef.current = offlineRecords;
  const catalogItemsRef = useRef(catalogItems);
  catalogItemsRef.current = catalogItems;

  const [query, setQuery] = useState('');
  const [mediaFilter, setMediaFilter] = useState('all');
  const [sort, setSort] = useState('relevance');
  const [grouped, setGrouped] = useState<Record<string, ContentItem[]>>({});
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runSearch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        q: query.trim(),
        sort,
        limit: '40',
      });
      if (mediaFilter !== 'all') params.set('media', mediaFilter);
      const res = await apiRequest<{ total: number; grouped: Record<string, ContentItem[]> }>(
        `/api/search?${params.toString()}`
      );
      setGrouped(res.grouped || {});
      setTotal(res.total || 0);
    } catch (err: any) {
      // Local search over synced catalogItems first, then downloaded offline records
      const needle = query.trim().toLowerCase();
      const sourceItems =
        catalogItemsRef.current.length > 0
          ? catalogItemsRef.current
          : offlineRecordsRef.current.map((r) => r.itemSnapshot);

      const matched = sourceItems.filter((item) => {
        if (mediaFilter === 'audio' && !item.audio?.url) return false;
        if (mediaFilter === 'document' && !item.document?.url) return false;
        if (mediaFilter === 'transcript' && !item.transcript) return false;
        if (!needle) return true;
        return (
          item.title.toLowerCase().includes(needle) ||
          item.speaker.toLowerCase().includes(needle) ||
          item.description.toLowerCase().includes(needle) ||
          item.tags.some((tg) => tg.toLowerCase().includes(needle))
        );
      });
      const unique = Array.from(new Map(matched.map((i) => [i.id, i])).values());
      const nextGrouped: Record<string, ContentItem[]> = {};
      for (const item of unique) {
        const key = item.categorySlug || 'lectures';
        nextGrouped[key] = nextGrouped[key] || [];
        nextGrouped[key].push(item);
      }
      setGrouped(nextGrouped);
      setTotal(unique.length);
      if (isOnline && unique.length === 0) {
        setError(err?.message || 'Unable to search content server.');
      }
    } finally {
      setLoading(false);
    }
  }, [query, mediaFilter, sort, isOnline]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      runSearch();
    }, 220);
    return () => window.clearTimeout(timer);
  }, [runSearch, apiBaseUrl, isOnline, catalogVersion]);

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-5 dark:border-slate-800">
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100">
          {t(language, 'search')}
        </h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Search across titles, descriptions, speakers, series, tags, transcripts, and Q&amp;A.
        </p>
      </div>

      {/* Search Bar & Filters */}
      <div className="space-y-3">
        <div className="relative">
          <SearchIcon className="w-5 h-5 text-slate-400 absolute start-4 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t(language, 'searchPlaceholder')}
            className="w-full min-h-[48px] rounded-2xl border border-slate-200 bg-white ps-12 pe-4 text-sm sm:text-base text-slate-900 focus:outline-none focus:border-emerald-700 dark:border-slate-800 dark:bg-[#131C1A] dark:text-slate-100"
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="max-w-full overflow-x-auto no-scrollbar rounded-xl bg-slate-200/60 p-1 dark:bg-slate-800/80">
            <div className="flex items-center gap-1 w-max">
              {[
                { id: 'all', label: 'All' },
                { id: 'audio', label: 'Audio' },
                { id: 'document', label: 'PDF' },
                { id: 'transcript', label: 'Transcript' },
              ].map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setMediaFilter(f.id)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    mediaFilter === f.id
                      ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-700 dark:text-white'
                      : 'text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500 tabular-nums">{total} results</span>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              aria-label="Sort search results"
              className="min-h-[38px] rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            >
              <option value="relevance">Best Match</option>
              <option value="newest">Newest</option>
              <option value="popular">Most Popular</option>
            </select>
          </div>
        </div>
      </div>

      {/* Grouped Results */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="h-40 animate-pulse rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-[#131C1A]" />
          ))}
        </div>
      ) : error && total === 0 ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center dark:border-amber-900/60 dark:bg-amber-950/30">
          <p className="text-sm text-amber-900 dark:text-amber-200">{error}</p>
          <button
            type="button"
            onClick={runSearch}
            className="mt-3 min-h-[40px] rounded-xl bg-amber-800 px-4 py-2 text-xs font-medium text-white cursor-pointer"
          >
            Retry
          </button>
        </div>
      ) : total === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center dark:border-slate-800 dark:bg-[#131C1A]">
          <p className="text-sm text-slate-500 dark:text-slate-400">{t(language, 'noResults')}</p>
        </div>
      ) : (
        <div className="space-y-8">
          {[
            ...GROUP_ORDER,
            ...Object.keys(grouped)
              .filter((slug) => !GROUP_ORDER.some((g) => g.slug === slug))
              .map((slug) => ({ slug, label: slug.toUpperCase() })),
          ].map(({ slug, label }) => {
            const list = grouped[slug] || [];
            if (list.length === 0) return null;
            return (
              <section key={slug} className="space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200/80 pb-2 dark:border-slate-800">
                  <h2 className="font-display text-sm font-bold tracking-wide text-emerald-800 dark:text-emerald-400">
                    {label}
                  </h2>
                  <span className="text-xs text-slate-500 tabular-nums">{list.length}</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {list.map((item) => (
                    <ContentCard key={item.id} item={item} queue={list} compact />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
};
