import React from 'react';
import {
  BookOpen,
  Check,
  Download,
  FileDown,
  Heart,
  Pause,
  Play,
  Share2,
  X,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAudio } from '../../context/AudioContext';
import { t } from '../../i18n/translations';
import type { ContentItem } from '../../types/content';

interface ButtonBaseProps {
  item: ContentItem;
  queue?: ContentItem[];
  compact?: boolean;
}

export const PlayButton: React.FC<ButtonBaseProps> = ({ item, queue, compact }) => {
  const { language } = useApp();
  const { currentTrack, isPlaying, playItem } = useAudio();
  if (!item.audio?.url) return null;

  const isCurrent = currentTrack?.id === item.id;
  const active = isCurrent && isPlaying;

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        playItem(item, queue);
      }}
      className={`inline-flex items-center justify-center gap-2 min-h-[40px] rounded-xl font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
        compact ? 'px-3 py-2 text-xs' : 'px-4 py-2.5 text-sm'
      } ${
        active
          ? 'bg-emerald-900 text-white dark:bg-emerald-500 dark:text-slate-950'
          : 'bg-[#0F4C3A] text-white hover:bg-[#0B3B2D] dark:bg-emerald-600 dark:hover:bg-emerald-500'
      }`}
    >
      {active ? <Pause className="w-4 h-4 shrink-0" /> : <Play className="w-4 h-4 shrink-0 fill-current" />}
      <span>{active ? t(language, 'pause') : t(language, 'playAudio')}</span>
    </button>
  );
};

export const DownloadAudioButton: React.FC<ButtonBaseProps> = ({ item, compact }) => {
  const { language, downloadStates, isItemDownloaded, startDownload, cancelDownload } = useApp();
  if (!item.audio?.url) return null;

  const key = `${item.id}:audio`;
  const state = downloadStates[key];
  const downloaded = isItemDownloaded(item.id, 'audio');

  if (state?.status === 'downloading') {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          cancelDownload(item.id, 'audio');
        }}
        title="Cancel download"
        className={`inline-flex items-center justify-center gap-1.5 min-h-[40px] rounded-xl border border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-200 font-medium whitespace-nowrap shrink-0 cursor-pointer ${
          compact ? 'px-3 py-2 text-xs' : 'px-3.5 py-2.5 text-sm'
        }`}
      >
        <X className="w-3.5 h-3.5 shrink-0" />
        <span className="tabular-nums">{state.progress}%</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        startDownload(item, 'audio');
      }}
      className={`inline-flex items-center justify-center gap-1.5 min-h-[40px] rounded-xl border font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
        compact ? 'px-3 py-2 text-xs' : 'px-3.5 py-2.5 text-sm'
      } ${
        downloaded
          ? 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800'
      }`}
    >
      {downloaded ? <Check className="w-4 h-4 shrink-0" /> : <Download className="w-4 h-4 shrink-0" />}
      <span>{downloaded ? t(language, 'downloaded') : t(language, 'downloadAudio')}</span>
    </button>
  );
};

export const ReadButton: React.FC<ButtonBaseProps & { mode?: 'transcript' | 'pdf'; labelOverride?: string }> = ({
  item,
  compact,
  mode,
  labelOverride,
}) => {
  const { language, openReader } = useApp();
  const hasTranscript = Boolean(item.transcript?.en || item.transcript?.ar || item.transcript?.lg);
  const hasPdf = Boolean(item.document?.url);
  if (!hasTranscript && !hasPdf) return null;

  const label =
    labelOverride ||
    (mode === 'pdf'
      ? t(language, 'readPdf')
      : mode === 'transcript'
        ? t(language, 'readTranscript')
        : t(language, 'read'));

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        openReader(item, mode);
      }}
      className={`inline-flex items-center justify-center gap-1.5 min-h-[40px] rounded-xl border border-slate-200 bg-white text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800 font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
        compact ? 'px-3 py-2 text-xs' : 'px-3.5 py-2.5 text-sm'
      }`}
    >
      <BookOpen className="w-4 h-4 shrink-0" />
      <span>{label}</span>
    </button>
  );
};

export const DownloadDocumentButton: React.FC<ButtonBaseProps> = ({ item, compact }) => {
  const { language, downloadStates, isItemDownloaded, startDownload, cancelDownload } = useApp();
  if (!item.document?.url) return null;

  const key = `${item.id}:document`;
  const state = downloadStates[key];
  const downloaded = isItemDownloaded(item.id, 'document');

  if (state?.status === 'downloading') {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          cancelDownload(item.id, 'document');
        }}
        className={`inline-flex items-center justify-center gap-1.5 min-h-[40px] rounded-xl border border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-200 font-medium whitespace-nowrap shrink-0 cursor-pointer ${
          compact ? 'px-3 py-2 text-xs' : 'px-3.5 py-2.5 text-sm'
        }`}
      >
        <X className="w-3.5 h-3.5 shrink-0" />
        <span className="tabular-nums">{state.progress}%</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        startDownload(item, 'document');
      }}
      className={`inline-flex items-center justify-center gap-1.5 min-h-[40px] rounded-xl border font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
        compact ? 'px-3 py-2 text-xs' : 'px-3.5 py-2.5 text-sm'
      } ${
        downloaded
          ? 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800'
      }`}
    >
      {downloaded ? <Check className="w-4 h-4 shrink-0" /> : <FileDown className="w-4 h-4 shrink-0" />}
      <span>{downloaded ? t(language, 'downloaded') : t(language, 'downloadPdf')}</span>
    </button>
  );
};

export const FavoriteButton: React.FC<{ item: ContentItem }> = ({ item }) => {
  const { favoriteIds, toggleFavorite } = useApp();
  const isFav = favoriteIds.has(item.id);

  return (
    <button
      type="button"
      aria-label={isFav ? 'Remove from favorites' : 'Save to favorites'}
      onClick={(e) => {
        e.stopPropagation();
        toggleFavorite(item);
      }}
      className={`min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-xl border transition-colors cursor-pointer ${
        isFav
          ? 'border-rose-200 bg-rose-50 text-rose-600 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-400'
          : 'border-slate-200 bg-white text-slate-500 hover:text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
      }`}
    >
      <Heart className={`w-4 h-4 ${isFav ? 'fill-current' : ''}`} />
    </button>
  );
};

export const ShareButton: React.FC<{ item: ContentItem }> = ({ item }) => {
  const { showToast, language } = useApp();

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const shareUrl = `${window.location.origin}/?item=${encodeURIComponent(item.id)}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: item.title,
          text: `${item.title} — ${item.speaker}`,
          url: shareUrl,
        });
        return;
      } catch {
        // user cancelled or unsupported
      }
    }
    try {
      await navigator.clipboard.writeText(shareUrl);
      showToast('Link copied to clipboard.');
    } catch {
      showToast(shareUrl);
    }
  };

  return (
    <button
      type="button"
      aria-label={t(language, 'share')}
      onClick={handleShare}
      className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:text-slate-200 transition-colors cursor-pointer"
    >
      <Share2 className="w-4 h-4" />
    </button>
  );
};
