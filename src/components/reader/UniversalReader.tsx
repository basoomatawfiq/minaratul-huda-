import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bookmark,
  BookmarkCheck,
  ExternalLink,
  Search,
  WifiOff,
  X,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { getLocalizedTitle, t } from '../../i18n/translations';
import { resolveMediaUrl } from '../../services/api';
import { getOfflineMediaBlobUrl } from '../../services/offlineManager';
import type { AppLanguage } from '../../types/content';
import { DownloadDocumentButton } from '../content/ActionButtons';

const LS_BOOKMARKS = 'albayan_reader_bookmarks_v1';

export const UniversalReader: React.FC = () => {
  const { readerTarget, closeReader, language, isOnline, recordReadingProgress, showToast } = useApp();

  const [activeMode, setActiveMode] = useState<'transcript' | 'pdf'>('transcript');
  const [transcriptLang, setTranscriptLang] = useState<AppLanguage>(language);
  const [fontSize, setFontSize] = useState<number>(17);
  const [searchQuery, setSearchQuery] = useState('');
  const [pdfSrc, setPdfSrc] = useState<string | null>(null);
  const [pdfOffline, setPdfOffline] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);

  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!readerTarget) return;
    setActiveMode(readerTarget.mode);
    setTranscriptLang(language);
    setSearchQuery('');

    try {
      const saved = JSON.parse(localStorage.getItem(LS_BOOKMARKS) || '{}');
      setBookmarked(Boolean(saved[readerTarget.item.id]));
    } catch {
      setBookmarked(false);
    }

    // Record initial read open
    recordReadingProgress(readerTarget.item, 15);
  }, [readerTarget, language, recordReadingProgress]);

  // Resolve PDF source (offline CacheStorage blob or network URL)
  useEffect(() => {
    let revokedUrl: string | null = null;
    if (!readerTarget?.item.document?.url) {
      setPdfSrc(null);
      setPdfOffline(false);
      return;
    }

    const remoteUrl = resolveMediaUrl(readerTarget.item.document.url);
    (async () => {
      const cachedBlobUrl = await getOfflineMediaBlobUrl(remoteUrl);
      if (cachedBlobUrl) {
        revokedUrl = cachedBlobUrl;
        setPdfSrc(cachedBlobUrl);
        setPdfOffline(true);
      } else if (isOnline) {
        setPdfSrc(remoteUrl);
        setPdfOffline(false);
      } else {
        setPdfSrc(null);
        setPdfOffline(false);
      }
    })();

    return () => {
      if (revokedUrl) URL.revokeObjectURL(revokedUrl);
    };
  }, [readerTarget, isOnline]);

  const item = readerTarget?.item;

  const transcriptText = useMemo(() => {
    if (!item?.transcript) return '';
    if (transcriptLang === 'ar' && item.transcript.ar) return item.transcript.ar;
    if (transcriptLang === 'lg' && item.transcript.lg) return item.transcript.lg;
    return item.transcript.en || item.transcript.ar || item.transcript.lg || '';
  }, [item, transcriptLang]);

  if (!readerTarget || !item) return null;

  const hasTranscript = Boolean(item.transcript?.en || item.transcript?.ar || item.transcript?.lg);
  const hasPdf = Boolean(item.document?.url);
  const title = getLocalizedTitle(item, language);

  const handleToggleBookmark = () => {
    const next = !bookmarked;
    setBookmarked(next);
    try {
      const saved = JSON.parse(localStorage.getItem(LS_BOOKMARKS) || '{}');
      if (next) saved[item.id] = { title: item.title, savedAt: new Date().toISOString() };
      else delete saved[item.id];
      localStorage.setItem(LS_BOOKMARKS, JSON.stringify(saved));
    } catch {
      // ignore storage errors
    }
    showToast(next ? 'Reading bookmark saved.' : 'Bookmark removed.');
  };

  const handleScroll = () => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const maxScroll = el.scrollHeight - el.clientHeight;
    if (maxScroll > 0) {
      const pct = Math.round((el.scrollTop / maxScroll) * 100);
      if (pct >= 25) recordReadingProgress(item, Math.min(100, pct));
    }
  };

  // Safe React JSX search highlighting (zero dangerouslySetInnerHTML)
  const renderHighlightedParagraph = (para: string, idx: number) => {
    if (!searchQuery.trim()) {
      return (
        <p key={idx} className="mb-4">
          {para}
        </p>
      );
    }
    const q = searchQuery.trim();
    const parts = para.split(new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
    return (
      <p key={idx} className="mb-4">
        {parts.map((part, i) =>
          part.toLowerCase() === q.toLowerCase() ? (
            <mark
              key={i}
              className="rounded bg-amber-200 px-0.5 text-slate-900 dark:bg-amber-700/70 dark:text-white"
            >
              {part}
            </mark>
          ) : (
            <React.Fragment key={i}>{part}</React.Fragment>
          )
        )}
      </p>
    );
  };

  return (
    <div className="fixed inset-0 h-[100dvh] w-full z-50 flex flex-col overflow-hidden bg-[#F8F8F6] dark:bg-[#0B1110]">
      {/* Reader Top Toolbar */}
      <header className="border-b border-slate-200 bg-white/95 px-3 sm:px-4 py-3 backdrop-blur-md dark:border-slate-800 dark:bg-[#131C1A]/95 shrink-0">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-emerald-800 dark:text-emerald-400 truncate">
              {item.categoryName} · {item.speaker}
            </p>
            <h2 className="font-display text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 truncate">
              {title}
            </h2>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Switch between Transcript & PDF when both exist */}
            {hasTranscript && hasPdf && (
              <div className="flex items-center rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
                <button
                  type="button"
                  onClick={() => setActiveMode('transcript')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                    activeMode === 'transcript'
                      ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-700 dark:text-white'
                      : 'text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {t(language, 'readTranscript')}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveMode('pdf')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                    activeMode === 'pdf'
                      ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-700 dark:text-white'
                      : 'text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {t(language, 'readPdf')}
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={handleToggleBookmark}
              aria-label="Toggle reading bookmark"
              className="min-h-[40px] min-w-[40px] inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 cursor-pointer"
            >
              {bookmarked ? <BookmarkCheck className="w-4 h-4 text-emerald-700 dark:text-emerald-400" /> : <Bookmark className="w-4 h-4" />}
            </button>

            <button
              type="button"
              onClick={closeReader}
              aria-label="Close reader"
              className="min-h-[40px] min-w-[40px] inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Sub-toolbar for Transcript Typography, Language & Search */}
        {activeMode === 'transcript' && hasTranscript && (
          <div className="mx-auto mt-3 flex max-w-4xl flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-1.5">
              {item.transcript?.en && (
                <button
                  type="button"
                  onClick={() => setTranscriptLang('en')}
                  className={`px-2.5 py-1 text-xs rounded-lg font-medium cursor-pointer ${
                    transcriptLang === 'en'
                      ? 'bg-[#0F4C3A] text-white dark:bg-emerald-600'
                      : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                  }`}
                >
                  English
                </button>
              )}
              {item.transcript?.ar && (
                <button
                  type="button"
                  onClick={() => setTranscriptLang('ar')}
                  className={`px-2.5 py-1 text-xs rounded-lg font-medium cursor-pointer ${
                    transcriptLang === 'ar'
                      ? 'bg-[#0F4C3A] text-white dark:bg-emerald-600'
                      : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                  }`}
                >
                  العربية
                </button>
              )}
              {item.transcript?.lg && (
                <button
                  type="button"
                  onClick={() => setTranscriptLang('lg')}
                  className={`px-2.5 py-1 text-xs rounded-lg font-medium cursor-pointer ${
                    transcriptLang === 'lg'
                      ? 'bg-[#0F4C3A] text-white dark:bg-emerald-600'
                      : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                  }`}
                >
                  Luganda
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto min-w-0">
              <div className="relative flex-1 min-w-0 sm:flex-none">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute start-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Find in text..."
                  className="w-full sm:w-52 rounded-lg border border-slate-200 bg-slate-50 ps-8 pe-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-emerald-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="flex items-center rounded-lg border border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setFontSize((s) => Math.max(14, s - 2))}
                  aria-label="Decrease text size"
                  className="px-2.5 py-1 text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
                >
                  A-
                </button>
                <span className="px-1.5 text-[11px] tabular-nums text-slate-500">{fontSize}</span>
                <button
                  type="button"
                  onClick={() => setFontSize((s) => Math.min(28, s + 2))}
                  aria-label="Increase text size"
                  className="px-2.5 py-1 text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
                >
                  A+
                </button>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Main Reading Viewport */}
      {activeMode === 'transcript' && hasTranscript ? (
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          dir={transcriptLang === 'ar' ? 'rtl' : 'ltr'}
          className="flex-1 overflow-y-auto px-4 py-8 sm:px-8"
        >
          <article
            style={{ fontSize: `${fontSize}px` }}
            className={`mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 sm:p-10 leading-relaxed text-slate-800 dark:border-slate-800 dark:bg-[#131C1A] dark:text-slate-100 ${
              transcriptLang === 'ar' ? 'font-arabic leading-[2.1]' : ''
            }`}
          >
            {transcriptText
              .split(/\n{2,}/)
              .filter(Boolean)
              .map((para, idx) => renderHighlightedParagraph(para, idx))}
          </article>
        </div>
      ) : (
        <div className="flex-1 min-h-0 flex flex-col p-3 sm:p-6 mx-auto w-full max-w-5xl">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 shrink-0">
            <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
              {item.document?.documentType || 'PDF Document'}
              {pdfOffline ? ' · Loaded from Offline Storage' : ''}
            </span>
            <div className="flex items-center gap-2">
              <DownloadDocumentButton item={item} compact />
              {pdfSrc && (
                <a
                  href={pdfSrc}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 min-h-[38px] rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Open File</span>
                </a>
              )}
            </div>
          </div>

          {pdfSrc ? (
            <iframe
              title={title}
              src={pdfSrc}
              className="flex-1 min-h-0 w-full rounded-2xl border border-slate-200 bg-white dark:border-slate-800"
            />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-8 text-center dark:border-slate-800 dark:bg-[#131C1A]">
              <WifiOff className="w-10 h-10 text-amber-600 mb-3" />
              <p className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Document Not Cached Offline
              </p>
              <p className="mt-1 max-w-md text-sm text-slate-500 dark:text-slate-400">
                Reconnect to the internet to read or download this PDF for offline study.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
