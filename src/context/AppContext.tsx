import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { apiRequest, getApiBaseUrl, setAuthToken, setStoredApiBaseUrl } from '../services/api';
import {
  clearAllOfflineDownloads,
  downloadMediaOffline,
  deleteOfflineRecord,
  getAllOfflineRecords,
  type DownloadProgressState,
  type MediaKind,
  type OfflineDownloadRecord,
} from '../services/offlineManager';
import type {
  AppLanguage,
  AppSection,
  Category,
  ContentItem,
  NotificationItem,
  SeriesItem,
  ThemeMode,
  UserProfile,
} from '../types/content';

export interface LocalHistoryEntry {
  contentId: string;
  positionSeconds?: number;
  durationSeconds?: number;
  scrollPercent?: number;
  timestamp: string;
  item: ContentItem;
}

interface AppContextValue {
  section: AppSection;
  setSection: (s: AppSection) => void;
  language: AppLanguage;
  setLanguage: (l: AppLanguage) => void;
  theme: ThemeMode;
  setTheme: (t: ThemeMode) => void;
  isOnline: boolean;
  wifiOnlyDownloads: boolean;
  setWifiOnlyDownloads: (v: boolean) => void;
  apiBaseUrl: string;
  updateApiBaseUrl: (url: string) => Promise<void>;
  lastSyncedAt: string | null;
  catalogVersion: number;
  user: UserProfile | null;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  updateProfile: (patch: Partial<UserProfile>) => Promise<void>;
  deleteAccount: () => Promise<void>;
  categories: Category[];
  seriesList: SeriesItem[];
  notifications: NotificationItem[];
  refreshCatalogMeta: () => Promise<void>;
  // Favorites
  favoriteIds: Set<string>;
  favoriteItems: ContentItem[];
  toggleFavorite: (item: ContentItem) => Promise<void>;
  // Listening & Reading History
  listeningHistory: LocalHistoryEntry[];
  readingHistory: LocalHistoryEntry[];
  recordListeningProgress: (item: ContentItem, positionSeconds: number, durationSeconds: number, completed?: boolean) => void;
  recordReadingProgress: (item: ContentItem, scrollPercent: number) => void;
  // Offline Download Manager
  offlineRecords: OfflineDownloadRecord[];
  downloadStates: Record<string, DownloadProgressState>;
  startDownload: (item: ContentItem, kind: MediaKind) => Promise<void>;
  cancelDownload: (contentId: string, kind: MediaKind) => void;
  removeDownload: (contentId: string, kind: MediaKind, url?: string) => Promise<void>;
  clearDownloads: () => Promise<void>;
  isItemDownloaded: (contentId: string, kind?: MediaKind) => boolean;
  // Modals: Details & Universal Reader
  selectedContent: ContentItem | null;
  openContentDetails: (item: ContentItem) => void;
  closeContentDetails: () => void;
  readerTarget: { item: ContentItem; mode: 'transcript' | 'pdf' } | null;
  openReader: (item: ContentItem, preferredMode?: 'transcript' | 'pdf') => void;
  closeReader: () => void;
  toast: string | null;
  showToast: (msg: string) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

const LS_FAVORITES = 'albayan_favorites_v1';
const LS_LISTEN_HIST = 'albayan_listen_hist_v1';
const LS_READ_HIST = 'albayan_read_hist_v1';
const LS_LANG = 'albayan_lang_v1';
const LS_THEME = 'albayan_theme_v1';
const LS_WIFI = 'albayan_wifi_only_v1';

const LEGACY_SEED_IDS = new Set([
  'cnt_tafseer_01',
  'cnt_tafseer_02',
  'cnt_tafseer_03',
  'cnt_hadith_01',
  'cnt_hadith_02',
  'cnt_speech_01',
  'cnt_speech_02',
  'cnt_qa_01',
  'cnt_qa_02',
  'cnt_lecture_01',
  'cnt_lecture_02',
  'cnt_doc_01',
  'cnt_doc_02',
]);

function isLegacySeedItem(item: Partial<ContentItem> | null | undefined): boolean {
  if (!item) return true;
  if (item.createdBy === 'system') return true;
  if (item.id && LEGACY_SEED_IDS.has(item.id)) return true;
  return false;
}

function readJsonStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [section, setSection] = useState<AppSection>('home');
  const [language, setLanguageState] = useState<AppLanguage>(() => {
    const saved = localStorage.getItem(LS_LANG);
    return saved === 'ar' || saved === 'lg' ? saved : 'en';
  });
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem(LS_THEME);
    return saved === 'dark' || saved === 'light' ? saved : 'system';
  });
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [wifiOnlyDownloads, setWifiOnlyDownloadsState] = useState<boolean>(() => {
    return localStorage.getItem(LS_WIFI) === 'true';
  });
  const [apiBaseUrl, setApiBaseUrlState] = useState<string>(() => getApiBaseUrl());
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [catalogVersion, setCatalogVersion] = useState<number>(0);
  const lastSyncMsRef = useRef<number>(0);

  const [user, setUser] = useState<UserProfile | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [seriesList, setSeriesList] = useState<SeriesItem[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  const [favoriteItems, setFavoriteItems] = useState<ContentItem[]>(() => {
    const loaded = readJsonStorage<ContentItem[]>(LS_FAVORITES, []);
    const clean = loaded.filter((i) => !isLegacySeedItem(i));
    if (clean.length !== loaded.length) localStorage.setItem(LS_FAVORITES, JSON.stringify(clean));
    return clean;
  });
  const [listeningHistory, setListeningHistory] = useState<LocalHistoryEntry[]>(() => {
    const loaded = readJsonStorage<LocalHistoryEntry[]>(LS_LISTEN_HIST, []);
    const clean = loaded.filter((e) => !isLegacySeedItem(e.item));
    if (clean.length !== loaded.length) localStorage.setItem(LS_LISTEN_HIST, JSON.stringify(clean));
    return clean;
  });
  const [readingHistory, setReadingHistory] = useState<LocalHistoryEntry[]>(() => {
    const loaded = readJsonStorage<LocalHistoryEntry[]>(LS_READ_HIST, []);
    const clean = loaded.filter((e) => !isLegacySeedItem(e.item));
    if (clean.length !== loaded.length) localStorage.setItem(LS_READ_HIST, JSON.stringify(clean));
    return clean;
  });

  const [offlineRecords, setOfflineRecords] = useState<OfflineDownloadRecord[]>([]);
  const [downloadStates, setDownloadStates] = useState<Record<string, DownloadProgressState>>({});
  const abortControllersRef = useRef<Record<string, AbortController>>({});

  const [selectedContent, setSelectedContent] = useState<ContentItem | null>(null);
  const [readerTarget, setReaderTarget] = useState<{ item: ContentItem; mode: 'transcript' | 'pdf' } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(null), 3500);
  }, []);

  // Apply HTML RTL / Lang attributes
  useEffect(() => {
    const html = document.documentElement;
    html.lang = language;
    html.dir = language === 'ar' ? 'rtl' : 'ltr';
    localStorage.setItem(LS_LANG, language);
  }, [language]);

  // Apply Dark / Light Theme class
  useEffect(() => {
    const html = document.documentElement;
    const apply = (mode: ThemeMode) => {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const shouldBeDark = mode === 'dark' || (mode === 'system' && prefersDark);
      html.classList.toggle('dark', shouldBeDark);
    };
    apply(theme);
    localStorage.setItem(LS_THEME, theme);

    if (theme === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      const handler = () => apply('system');
      mq.addEventListener('change', handler);
      return () => mq.removeEventListener('change', handler);
    }
  }, [theme]);

  // Online / Offline events
  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  // Load offline IndexedDB records on boot and purge any legacy seed items
  const reloadOfflineRecords = useCallback(async () => {
    const records = await getAllOfflineRecords();
    const kept: OfflineDownloadRecord[] = [];
    for (const r of records) {
      if (isLegacySeedItem(r.itemSnapshot)) {
        await deleteOfflineRecord(r.contentId, r.kind, r.url).catch(() => {});
      } else {
        kept.push(r);
      }
    }
    setOfflineRecords(kept);
  }, []);

  useEffect(() => {
    reloadOfflineRecords();
  }, [reloadOfflineRecords]);

  // Reconcile cached client state with live server catalog so deleted items never persist
  const refreshCatalogMeta = useCallback(async () => {
    if (!getApiBaseUrl()) return;
    try {
      const [catRes, serRes, notifRes, catalogRes] = await Promise.all([
        apiRequest<{ categories: Category[] }>('/api/categories'),
        apiRequest<{ series: SeriesItem[] }>('/api/series'),
        apiRequest<{ notifications: NotificationItem[] }>('/api/notifications'),
        apiRequest<{ items: ContentItem[] }>('/api/content?limit=500'),
      ]);
      lastSyncMsRef.current = Date.now();
      setCategories(catRes.categories || []);
      setSeriesList(serRes.series || []);
      setNotifications(notifRes.notifications || []);
      setLastSyncedAt(new Date().toISOString());
      setCatalogVersion((v) => v + 1);

      const publishedMap = new Map<string, ContentItem>(
        (catalogRes.items || []).map((item) => [item.id, item])
      );

      setSelectedContent((prev) => (prev ? publishedMap.get(prev.id) || null : null));

      setFavoriteItems((prev) => {
        const next = prev
          .filter((item) => publishedMap.has(item.id))
          .map((item) => publishedMap.get(item.id)!);
        localStorage.setItem(LS_FAVORITES, JSON.stringify(next));
        return next;
      });

      setListeningHistory((prev) => {
        const next = prev
          .filter((entry) => publishedMap.has(entry.contentId))
          .map((entry) => ({ ...entry, item: publishedMap.get(entry.contentId)! }));
        localStorage.setItem(LS_LISTEN_HIST, JSON.stringify(next));
        return next;
      });

      setReadingHistory((prev) => {
        const next = prev
          .filter((entry) => publishedMap.has(entry.contentId))
          .map((entry) => ({ ...entry, item: publishedMap.get(entry.contentId)! }));
        localStorage.setItem(LS_READ_HIST, JSON.stringify(next));
        return next;
      });

      const currentOffline = await getAllOfflineRecords();
      let offlineChanged = false;
      for (const rec of currentOffline) {
        if (!publishedMap.has(rec.contentId)) {
          await deleteOfflineRecord(rec.contentId, rec.kind, rec.url).catch(() => {});
          offlineChanged = true;
        }
      }
      if (offlineChanged) {
        await reloadOfflineRecords();
      }
    } catch {
      // Offline fallback: retain only verified non-seed local offline records
    }
  }, [reloadOfflineRecords]);

  useEffect(() => {
    refreshCatalogMeta();
  }, [refreshCatalogMeta]);

  // Re-fetch fresh data from the web app on reconnect, tab foregrounding, and periodic section switches
  useEffect(() => {
    if (isOnline) {
      refreshCatalogMeta();
    }
  }, [isOnline, refreshCatalogMeta]);

  useEffect(() => {
    const syncIfStale = () => {
      if (document.visibilityState === 'visible' && navigator.onLine && Date.now() - lastSyncMsRef.current > 12000) {
        refreshCatalogMeta();
      }
    };
    const onFocus = () => {
      if (navigator.onLine && Date.now() - lastSyncMsRef.current > 12000) {
        refreshCatalogMeta();
      }
    };
    document.addEventListener('visibilitychange', syncIfStale);
    window.addEventListener('focus', onFocus);
    return () => {
      document.removeEventListener('visibilitychange', syncIfStale);
      window.removeEventListener('focus', onFocus);
    };
  }, [refreshCatalogMeta]);

  useEffect(() => {
    if (isOnline && Date.now() - lastSyncMsRef.current > 15000) {
      refreshCatalogMeta();
    }
  }, [section, isOnline, refreshCatalogMeta]);

  const updateApiBaseUrl = useCallback(
    async (url: string) => {
      setStoredApiBaseUrl(url);
      setApiBaseUrlState(getApiBaseUrl());
      await refreshCatalogMeta();
    },
    [refreshCatalogMeta]
  );

  const setLanguage = useCallback(
    (l: AppLanguage) => {
      setLanguageState(l);
      if (user) {
        apiRequest('/api/auth/me', {
          method: 'PATCH',
          body: JSON.stringify({ preferredLanguage: l }),
        }).catch(() => {});
      }
    },
    [user]
  );

  const setTheme = useCallback(
    (t: ThemeMode) => {
      setThemeState(t);
      if (user) {
        apiRequest('/api/auth/me', {
          method: 'PATCH',
          body: JSON.stringify({ themePreference: t }),
        }).catch(() => {});
      }
    },
    [user]
  );

  const setWifiOnlyDownloads = useCallback((v: boolean) => {
    setWifiOnlyDownloadsState(v);
    localStorage.setItem(LS_WIFI, String(v));
  }, []);

  // Sync user data after login
  const syncUserAccountData = useCallback(async () => {
    try {
      const [favRes, histRes] = await Promise.all([
        apiRequest<{ items: ContentItem[] }>('/api/user/favorites'),
        apiRequest<{ listening: ContentItem[]; reading: ContentItem[] }>('/api/user/history'),
      ]);
      if (favRes.items) {
        setFavoriteItems(favRes.items);
        localStorage.setItem(LS_FAVORITES, JSON.stringify(favRes.items));
      }
      if (histRes.listening) {
        const mappedListen: LocalHistoryEntry[] = histRes.listening.map((item) => ({
          contentId: item.id,
          positionSeconds: item.positionSeconds || 0,
          durationSeconds: item.durationSeconds || item.audio?.durationSeconds || 0,
          timestamp: item.lastPlayedAt || item.updatedAt,
          item,
        }));
        setListeningHistory(mappedListen);
        localStorage.setItem(LS_LISTEN_HIST, JSON.stringify(mappedListen));
      }
      if (histRes.reading) {
        const mappedRead: LocalHistoryEntry[] = histRes.reading.map((item) => ({
          contentId: item.id,
          scrollPercent: item.scrollPercent || 0,
          timestamp: item.lastReadAt || item.updatedAt,
          item,
        }));
        setReadingHistory(mappedRead);
        localStorage.setItem(LS_READ_HIST, JSON.stringify(mappedRead));
      }
    } catch {
      // ignore if offline
    }
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await apiRequest<{ token: string; user: UserProfile }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      setAuthToken(res.token);
      setUser(res.user);
      if (res.user.preferredLanguage) setLanguageState(res.user.preferredLanguage);
      if (res.user.themePreference) setThemeState(res.user.themePreference);
      await syncUserAccountData();
    },
    [syncUserAccountData]
  );

  const register = useCallback(
    async (name: string, email: string, password: string) => {
      const res = await apiRequest<{ token: string; user: UserProfile }>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ name, email, password }),
      });
      setAuthToken(res.token);
      setUser(res.user);
      await syncUserAccountData();
    },
    [syncUserAccountData]
  );

  const logout = useCallback(() => {
    setAuthToken(null);
    setUser(null);
    showToast('Signed out.');
  }, [showToast]);

  const updateProfile = useCallback(async (patch: Partial<UserProfile>) => {
    const res = await apiRequest<{ user: UserProfile }>('/api/auth/me', {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
    setUser(res.user);
  }, []);

  const deleteAccount = useCallback(async () => {
    await apiRequest('/api/auth/me', { method: 'DELETE' });
    setAuthToken(null);
    setUser(null);
    showToast('Your account has been permanently deleted.');
  }, [showToast]);

  // Favorites
  const favoriteIds = new Set(favoriteItems.map((i) => i.id));

  const toggleFavorite = useCallback(
    async (item: ContentItem) => {
      const exists = favoriteItems.some((f) => f.id === item.id);
      const next = exists
        ? favoriteItems.filter((f) => f.id !== item.id)
        : [item, ...favoriteItems];
      setFavoriteItems(next);
      localStorage.setItem(LS_FAVORITES, JSON.stringify(next));

      if (user && isOnline) {
        try {
          if (exists) {
            await apiRequest(`/api/user/favorites/${item.id}`, { method: 'DELETE' });
          } else {
            await apiRequest(`/api/user/favorites/${item.id}`, { method: 'POST' });
          }
        } catch {
          // already updated locally
        }
      }
      showToast(exists ? 'Removed from Favorites' : 'Added to Favorites');
    },
    [favoriteItems, user, isOnline, showToast]
  );

  // Listening & Reading Progress
  const recordListeningProgress = useCallback(
    (item: ContentItem, positionSeconds: number, durationSeconds: number, completed = false) => {
      setListeningHistory((prev) => {
        const filtered = prev.filter((e) => e.contentId !== item.id);
        const updated: LocalHistoryEntry[] = [
          {
            contentId: item.id,
            positionSeconds: Math.floor(positionSeconds),
            durationSeconds: Math.floor(durationSeconds),
            timestamp: new Date().toISOString(),
            item,
          },
          ...filtered,
        ].slice(0, 40);
        localStorage.setItem(LS_LISTEN_HIST, JSON.stringify(updated));
        return updated;
      });

      if (user && isOnline) {
        apiRequest('/api/user/history/listening', {
          method: 'POST',
          body: JSON.stringify({ contentId: item.id, positionSeconds, durationSeconds, completed }),
        }).catch(() => {});
      }
    },
    [user, isOnline]
  );

  const recordReadingProgress = useCallback(
    (item: ContentItem, scrollPercent: number) => {
      setReadingHistory((prev) => {
        const filtered = prev.filter((e) => e.contentId !== item.id);
        const updated: LocalHistoryEntry[] = [
          {
            contentId: item.id,
            scrollPercent: Math.floor(scrollPercent),
            timestamp: new Date().toISOString(),
            item,
          },
          ...filtered,
        ].slice(0, 40);
        localStorage.setItem(LS_READ_HIST, JSON.stringify(updated));
        return updated;
      });

      if (user && isOnline) {
        apiRequest('/api/user/history/reading', {
          method: 'POST',
          body: JSON.stringify({ contentId: item.id, scrollPercent }),
        }).catch(() => {});
      }
    },
    [user, isOnline]
  );

  // Download Manager
  const startDownload = useCallback(
    async (item: ContentItem, kind: MediaKind) => {
      const key = `${item.id}:${kind}`;
      if (!isOnline) {
        showToast('Cannot start new download while offline.');
        return;
      }

      if (wifiOnlyDownloads) {
        const conn = (navigator as any).connection;
        if (conn && conn.type && conn.type === 'cellular') {
          showToast('Downloads are restricted to Wi-Fi in Settings.');
          return;
        }
      }

      if (downloadStates[key]?.status === 'downloading') return;
      if (offlineRecords.some((r) => r.key === key)) {
        showToast('Already downloaded for offline use.');
        return;
      }

      const controller = new AbortController();
      abortControllersRef.current[key] = controller;

      setDownloadStates((prev) => ({
        ...prev,
        [key]: { key, contentId: item.id, kind, status: 'downloading', progress: 5 },
      }));

      try {
        await downloadMediaOffline(
          item,
          kind,
          (progress) => {
            setDownloadStates((prev) => ({
              ...prev,
              [key]: { key, contentId: item.id, kind, status: 'downloading', progress },
            }));
          },
          controller.signal
        );

        await reloadOfflineRecords();
        setDownloadStates((prev) => ({
          ...prev,
          [key]: { key, contentId: item.id, kind, status: 'completed', progress: 100 },
        }));
        showToast(`${kind === 'audio' ? 'Audio' : 'Document'} saved for offline access.`);
      } catch (err: any) {
        if (err?.name === 'AbortError') {
          setDownloadStates((prev) => {
            const copy = { ...prev };
            delete copy[key];
            return copy;
          });
          showToast('Download cancelled.');
        } else {
          setDownloadStates((prev) => ({
            ...prev,
            [key]: {
              key,
              contentId: item.id,
              kind,
              status: 'error',
              progress: 0,
              error: err?.message || 'Download interrupted',
            },
          }));
          showToast(err?.message || 'Download failed.');
        }
      } finally {
        delete abortControllersRef.current[key];
      }
    },
    [isOnline, wifiOnlyDownloads, downloadStates, offlineRecords, reloadOfflineRecords, showToast]
  );

  const cancelDownload = useCallback((contentId: string, kind: MediaKind) => {
    const key = `${contentId}:${kind}`;
    abortControllersRef.current[key]?.abort();
  }, []);

  const removeDownload = useCallback(
    async (contentId: string, kind: MediaKind, url?: string) => {
      await deleteOfflineRecord(contentId, kind, url);
      const key = `${contentId}:${kind}`;
      setDownloadStates((prev) => {
        const copy = { ...prev };
        delete copy[key];
        return copy;
      });
      await reloadOfflineRecords();
      showToast('Removed from offline downloads.');
    },
    [reloadOfflineRecords, showToast]
  );

  const clearDownloads = useCallback(async () => {
    await clearAllOfflineDownloads();
    setDownloadStates({});
    await reloadOfflineRecords();
    showToast('All offline media cleared.');
  }, [reloadOfflineRecords, showToast]);

  const isItemDownloaded = useCallback(
    (contentId: string, kind?: MediaKind) => {
      if (kind) return offlineRecords.some((r) => r.contentId === contentId && r.kind === kind);
      return offlineRecords.some((r) => r.contentId === contentId);
    },
    [offlineRecords]
  );

  const openContentDetails = useCallback((item: ContentItem) => {
    setSelectedContent(item);
  }, []);

  const closeContentDetails = useCallback(() => {
    setSelectedContent(null);
  }, []);

  const openReader = useCallback((item: ContentItem, preferredMode?: 'transcript' | 'pdf') => {
    const hasTranscript = Boolean(item.transcript?.en || item.transcript?.ar || item.transcript?.lg);
    const hasPdf = Boolean(item.document?.url);
    let mode: 'transcript' | 'pdf' = 'transcript';
    if (preferredMode === 'pdf' && hasPdf) mode = 'pdf';
    else if (preferredMode === 'transcript' && hasTranscript) mode = 'transcript';
    else if (hasTranscript) mode = 'transcript';
    else if (hasPdf) mode = 'pdf';
    setReaderTarget({ item, mode });
  }, []);

  const closeReader = useCallback(() => {
    setReaderTarget(null);
  }, []);

  return (
    <AppContext.Provider
      value={{
        section,
        setSection,
        language,
        setLanguage,
        theme,
        setTheme,
        isOnline,
        wifiOnlyDownloads,
        setWifiOnlyDownloads,
        apiBaseUrl,
        updateApiBaseUrl,
        lastSyncedAt,
        catalogVersion,
        user,
        login,
        register,
        logout,
        updateProfile,
        deleteAccount,
        categories,
        seriesList,
        notifications,
        refreshCatalogMeta,
        favoriteIds,
        favoriteItems,
        toggleFavorite,
        listeningHistory,
        readingHistory,
        recordListeningProgress,
        recordReadingProgress,
        offlineRecords,
        downloadStates,
        startDownload,
        cancelDownload,
        removeDownload,
        clearDownloads,
        isItemDownloaded,
        selectedContent,
        openContentDetails,
        closeContentDetails,
        readerTarget,
        openReader,
        closeReader,
        toast,
        showToast,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
