import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  apiRequest,
  clearApiCache,
  getApiBaseUrl,
  setAuthToken,
  setStoredApiBaseUrl,
} from '../services/api';
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

interface PersistedCatalogSnapshot {
  baseUrl: string;
  items: ContentItem[];
  categories: Category[];
  seriesList: SeriesItem[];
  notifications: NotificationItem[];
  syncedAt: string;
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
  catalogItems: ContentItem[];
  catalogLoading: boolean;
  catalogError: string | null;
  refreshCatalogMeta: (forceRefresh?: boolean) => Promise<void>;
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
const LS_CATALOG_CACHE = 'minaratul_huda_catalog_cache_v1';
const LS_LAST_SECTION = 'minaratul_huda_last_section_v1';
const LS_SELECTED_CONTENT = 'minaratul_huda_selected_content_v1';
const LS_READER_TARGET = 'minaratul_huda_reader_target_v1';

const VALID_SECTIONS = new Set<AppSection>([
  'home',
  'tafseer',
  'hadith',
  'speeches',
  'qa',
  'lectures',
  'documents',
  'search',
  'downloads',
  'favorites',
  'history',
  'profile',
  'settings',
]);

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

function writeJsonStorage(key: string, value: unknown) {
  try {
    if (value === null || value === undefined) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, JSON.stringify(value));
    }
  } catch {
    // ignore storage quota errors
  }
}

function readInitialCatalogSnapshot(): PersistedCatalogSnapshot | null {
  const baseUrl = getApiBaseUrl();
  if (!baseUrl) return null;
  const cached = readJsonStorage<PersistedCatalogSnapshot | null>(LS_CATALOG_CACHE, null);
  if (!cached || cached.baseUrl !== baseUrl) return null;
  return {
    ...cached,
    items: (cached.items || []).filter((i) => !isLegacySeedItem(i)),
    categories: cached.categories || [],
    seriesList: cached.seriesList || [],
    notifications: cached.notifications || [],
  };
}

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const initialSnapshotRef = useRef<PersistedCatalogSnapshot | null>(readInitialCatalogSnapshot());

  const [section, setSectionState] = useState<AppSection>(() => {
    try {
      const saved = localStorage.getItem(LS_LAST_SECTION) as AppSection | null;
      if (saved && VALID_SECTIONS.has(saved)) return saved;
    } catch {
      // ignore storage errors
    }
    return 'home';
  });

  const setSection = useCallback((s: AppSection) => {
    setSectionState(s);
    try {
      localStorage.setItem(LS_LAST_SECTION, s);
    } catch {
      // ignore storage errors
    }
  }, []);

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
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(
    () => initialSnapshotRef.current?.syncedAt || null
  );
  const [catalogVersion, setCatalogVersion] = useState<number>(0);
  const lastSyncMsRef = useRef<number>(0);
  const syncInflightRef = useRef<Promise<void> | null>(null);
  const wasOnlineRef = useRef<boolean>(isOnline);

  const [user, setUser] = useState<UserProfile | null>(null);
  const [categories, setCategories] = useState<Category[]>(
    () => initialSnapshotRef.current?.categories || []
  );
  const [seriesList, setSeriesList] = useState<SeriesItem[]>(
    () => initialSnapshotRef.current?.seriesList || []
  );
  const [notifications, setNotifications] = useState<NotificationItem[]>(
    () => initialSnapshotRef.current?.notifications || []
  );
  const [catalogItems, setCatalogItems] = useState<ContentItem[]>(
    () => initialSnapshotRef.current?.items || []
  );
  const [catalogLoading, setCatalogLoading] = useState<boolean>(
    () => (initialSnapshotRef.current?.items.length || 0) === 0
  );
  const [catalogError, setCatalogError] = useState<string | null>(null);

  const categoriesRef = useRef(categories);
  categoriesRef.current = categories;
  const seriesListRef = useRef(seriesList);
  seriesListRef.current = seriesList;
  const notificationsRef = useRef(notifications);
  notificationsRef.current = notifications;
  const catalogItemsRef = useRef(catalogItems);
  catalogItemsRef.current = catalogItems;

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

  const [selectedContent, setSelectedContent] = useState<ContentItem | null>(() => {
    const saved = readJsonStorage<ContentItem | null>(LS_SELECTED_CONTENT, null);
    return saved && !isLegacySeedItem(saved) ? saved : null;
  });
  const [readerTarget, setReaderTarget] = useState<{ item: ContentItem; mode: 'transcript' | 'pdf' } | null>(() => {
    const saved = readJsonStorage<{ item: ContentItem; mode: 'transcript' | 'pdf' } | null>(LS_READER_TARGET, null);
    return saved?.item && !isLegacySeedItem(saved.item) ? saved : null;
  });
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

  // Stale-while-revalidate live sync with content server
  const refreshCatalogMeta = useCallback(
    async (forceRefresh = false) => {
      const activeBase = getApiBaseUrl();
      if (!activeBase) {
        setCatalogLoading(false);
        return;
      }
      if (forceRefresh) {
        clearApiCache();
      } else if (syncInflightRef.current) {
        return syncInflightRef.current;
      }

      const runSync = async () => {
        if (catalogItemsRef.current.length === 0) {
          setCatalogLoading(true);
        }
        setCatalogError(null);

        try {
          const reqOpts = { forceRefresh };
          const [catalogRes, catRes, serRes, notifRes] = await Promise.allSettled([
            apiRequest<{ items: ContentItem[] }>('/api/content?limit=500', reqOpts),
            apiRequest<{ categories: Category[] }>('/api/categories', reqOpts),
            apiRequest<{ series: SeriesItem[] }>('/api/series', reqOpts),
            apiRequest<{ notifications: NotificationItem[] }>('/api/notifications', reqOpts),
          ]);

          const nextCategories =
            catRes.status === 'fulfilled' ? catRes.value.categories || [] : categoriesRef.current;
          const nextSeries =
            serRes.status === 'fulfilled' ? serRes.value.series || [] : seriesListRef.current;
          const nextNotifs =
            notifRes.status === 'fulfilled' ? notifRes.value.notifications || [] : notificationsRef.current;

          if (catRes.status === 'fulfilled') setCategories(nextCategories);
          if (serRes.status === 'fulfilled') setSeriesList(nextSeries);
          if (notifRes.status === 'fulfilled') setNotifications(nextNotifs);

          if (catalogRes.status === 'fulfilled') {
            const items = (catalogRes.value.items || []).filter((i) => !isLegacySeedItem(i));
            const syncedAt = new Date().toISOString();
            lastSyncMsRef.current = Date.now();
            setCatalogItems(items);
            setLastSyncedAt(syncedAt);
            setCatalogVersion((v) => v + 1);
            setCatalogError(null);

            writeJsonStorage(LS_CATALOG_CACHE, {
              baseUrl: activeBase,
              items,
              categories: nextCategories,
              seriesList: nextSeries,
              notifications: nextNotifs,
              syncedAt,
            } satisfies PersistedCatalogSnapshot);

            const publishedMap = new Map<string, ContentItem>(items.map((item) => [item.id, item]));

            setSelectedContent((prev) => {
              const next = prev ? publishedMap.get(prev.id) || null : null;
              writeJsonStorage(LS_SELECTED_CONTENT, next);
              return next;
            });

            setReaderTarget((prev) => {
              if (!prev) return null;
              const freshItem = publishedMap.get(prev.item.id);
              const next = freshItem ? { ...prev, item: freshItem } : null;
              writeJsonStorage(LS_READER_TARGET, next);
              return next;
            });

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
          } else {
            const reason = catalogRes.reason;
            setCatalogError(reason instanceof Error ? reason.message : 'Unable to reach content server.');
          }
        } finally {
          setCatalogLoading(false);
          syncInflightRef.current = null;
        }
      };

      const promise = runSync();
      syncInflightRef.current = promise;
      return promise;
    },
    [reloadOfflineRecords]
  );

  useEffect(() => {
    refreshCatalogMeta(false);
  }, [refreshCatalogMeta]);

  // Re-fetch fresh data when network recovers from offline -> online
  useEffect(() => {
    if (isOnline && !wasOnlineRef.current) {
      refreshCatalogMeta(true);
    }
    wasOnlineRef.current = isOnline;
  }, [isOnline, refreshCatalogMeta]);

  useEffect(() => {
    const syncIfStale = () => {
      if (document.visibilityState === 'visible' && navigator.onLine && Date.now() - lastSyncMsRef.current > 15000) {
        refreshCatalogMeta(false);
      }
    };
    const onFocus = () => {
      if (navigator.onLine && Date.now() - lastSyncMsRef.current > 15000) {
        refreshCatalogMeta(false);
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
    if (isOnline && Date.now() - lastSyncMsRef.current > 20000) {
      refreshCatalogMeta(false);
    }
  }, [section, isOnline, refreshCatalogMeta]);

  const updateApiBaseUrl = useCallback(
    async (url: string) => {
      writeJsonStorage(LS_CATALOG_CACHE, null);
      setStoredApiBaseUrl(url);
      setApiBaseUrlState(getApiBaseUrl());
      setCatalogItems([]);
      await refreshCatalogMeta(true);
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
    writeJsonStorage(LS_SELECTED_CONTENT, item);
  }, []);

  const closeContentDetails = useCallback(() => {
    setSelectedContent(null);
    writeJsonStorage(LS_SELECTED_CONTENT, null);
  }, []);

  const openReader = useCallback((item: ContentItem, preferredMode?: 'transcript' | 'pdf') => {
    const hasTranscript = Boolean(item.transcript?.en || item.transcript?.ar || item.transcript?.lg);
    const hasPdf = Boolean(item.document?.url);
    let mode: 'transcript' | 'pdf' = 'transcript';
    if (preferredMode === 'pdf' && hasPdf) mode = 'pdf';
    else if (preferredMode === 'transcript' && hasTranscript) mode = 'transcript';
    else if (hasTranscript) mode = 'transcript';
    else if (hasPdf) mode = 'pdf';
    const next = { item, mode };
    setReaderTarget(next);
    writeJsonStorage(LS_READER_TARGET, next);
  }, []);

  const closeReader = useCallback(() => {
    setReaderTarget(null);
    writeJsonStorage(LS_READER_TARGET, null);
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
        catalogItems,
        catalogLoading,
        catalogError,
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
