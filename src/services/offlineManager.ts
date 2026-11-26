import type { ContentItem } from '../types/content';
import { resolveApiUrl, resolveMediaUrl } from './api';
import { extractAudioExtension, resolveAudioMimeType } from './audioFormatResolver';

const CACHE_NAME = 'albayan-offline-media-v1';
const DB_NAME = 'albayan_offline_db';
const DB_VERSION = 1;
const STORE_DOWNLOADS = 'downloads';

export type MediaKind = 'audio' | 'document';

export interface OfflineDownloadRecord {
  key: string; // `${contentId}:${kind}`
  contentId: string;
  kind: MediaKind;
  url: string;
  title: string;
  speaker: string;
  categorySlug: string;
  categoryName: string;
  format: string;
  sizeBytes: number;
  downloadedAt: string;
  itemSnapshot: ContentItem;
}

export interface DownloadProgressState {
  key: string;
  contentId: string;
  kind: MediaKind;
  status: 'downloading' | 'paused' | 'completed' | 'error';
  progress: number; // 0-100
  error?: string;
}

function openOfflineDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_DOWNLOADS)) {
        db.createObjectStore(STORE_DOWNLOADS, { keyPath: 'key' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function getAllOfflineRecords(): Promise<OfflineDownloadRecord[]> {
  try {
    const db = await openOfflineDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_DOWNLOADS, 'readonly');
      const store = tx.objectStore(STORE_DOWNLOADS);
      const req = store.getAll();
      req.onsuccess = () => resolve((req.result || []) as OfflineDownloadRecord[]);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

export async function saveOfflineRecord(record: OfflineDownloadRecord): Promise<void> {
  const db = await openOfflineDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_DOWNLOADS, 'readwrite');
    const store = tx.objectStore(STORE_DOWNLOADS);
    const req = store.put(record);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function deleteOfflineRecord(contentId: string, kind: MediaKind, url?: string): Promise<void> {
  const key = `${contentId}:${kind}`;
  const db = await openOfflineDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_DOWNLOADS, 'readwrite');
    const store = tx.objectStore(STORE_DOWNLOADS);
    const req = store.delete(key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });

  if (url && 'caches' in window) {
    const cache = await caches.open(CACHE_NAME);
    await cache.delete(resolveMediaUrl(url));
    await cache.delete(url);
  }
}

export async function clearAllOfflineDownloads(): Promise<void> {
  const records = await getAllOfflineRecords();
  for (const r of records) {
    await deleteOfflineRecord(r.contentId, r.kind, r.url);
  }
  if ('caches' in window) {
    await caches.delete(CACHE_NAME);
  }
}

export async function getOfflineMediaBlob(
  url: string,
  formatHint?: string
): Promise<Blob | null> {
  if (!('caches' in window)) return null;
  try {
    const cache = await caches.open(CACHE_NAME);
    const resolved = resolveMediaUrl(url);
    const matched = (await cache.match(resolved)) || (await cache.match(url));
    if (!matched) return null;
    const blob = await matched.blob();
    const headerSlice = new Uint8Array(await blob.slice(0, 256).arrayBuffer());
    const rawType = (blob.type || '').split(';')[0].trim().toLowerCase();
    if (!rawType || rawType === 'application/octet-stream' || rawType === 'binary/octet-stream') {
      const normalizedType = resolveAudioMimeType({
        url,
        formatHint,
        serverContentType: matched.headers.get('content-type'),
        magicBytes: headerSlice,
      });
      return new Blob([blob], { type: normalizedType });
    }
    return blob;
  } catch {
    return null;
  }
}

export async function getOfflineMediaBlobUrl(url: string): Promise<string | null> {
  const blob = await getOfflineMediaBlob(url);
  if (!blob) return null;
  return URL.createObjectURL(blob);
}

export async function isUrlCachedOffline(url: string): Promise<boolean> {
  if (!('caches' in window)) return false;
  try {
    const cache = await caches.open(CACHE_NAME);
    const resolved = resolveMediaUrl(url);
    const matched = (await cache.match(resolved)) || (await cache.match(url));
    return Boolean(matched);
  } catch {
    return false;
  }
}

export async function downloadMediaOffline(
  item: ContentItem,
  kind: MediaKind,
  onProgress: (percent: number) => void,
  signal: AbortSignal
): Promise<OfflineDownloadRecord> {
  const rawUrl = kind === 'audio' ? item.audio?.url : item.document?.url;
  if (!rawUrl) {
    throw new Error(`No ${kind} media available for this item.`);
  }
  const url = resolveMediaUrl(rawUrl);

  // Prevent duplicate download if already cached
  const alreadyCached = await isUrlCachedOffline(url);
  const key = `${item.id}:${kind}`;
  if (alreadyCached) {
    onProgress(100);
    const existing = (await getAllOfflineRecords()).find((r) => r.key === key);
    if (existing) return existing;
  }

  const response = await fetch(url, { signal });
  if (!response.ok) {
    throw new Error(`Failed to download (${response.status})`);
  }

  const contentLength = Number(response.headers.get('content-length') || '0');
  const serverContentType = response.headers.get('content-type');
  const reader = response.body?.getReader();

  let blob: Blob;
  let resolvedContentType: string;

  if (reader) {
    const chunks: Uint8Array[] = [];
    let received = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        chunks.push(value);
        received += value.length;
        if (contentLength > 0) {
          onProgress(Math.min(99, Math.round((received / contentLength) * 100)));
        } else {
          onProgress(50);
        }
      }
    }
    const headBytes = chunks[0]?.subarray(0, 256);
    resolvedContentType =
      kind === 'audio'
        ? resolveAudioMimeType({
            url: rawUrl,
            formatHint: item.audio?.format,
            serverContentType,
            magicBytes: headBytes,
          })
        : serverContentType && serverContentType !== 'application/octet-stream'
        ? serverContentType
        : 'application/pdf';
    blob = new Blob(chunks as BlobPart[], { type: resolvedContentType });
  } else {
    const rawBlob = await response.blob();
    const headBytes = new Uint8Array(await rawBlob.slice(0, 256).arrayBuffer());
    resolvedContentType =
      kind === 'audio'
        ? resolveAudioMimeType({
            url: rawUrl,
            formatHint: item.audio?.format,
            serverContentType: serverContentType || rawBlob.type,
            magicBytes: headBytes,
          })
        : serverContentType || rawBlob.type || 'application/pdf';
    blob = new Blob([rawBlob], { type: resolvedContentType });
  }

  if ('caches' in window) {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(
      url,
      new Response(blob, {
        status: 200,
        headers: {
          'Content-Type': resolvedContentType,
          'Content-Length': String(blob.size),
        },
      })
    );
  }

  onProgress(100);

  const audioFormatLabel =
    (item.audio?.format || extractAudioExtension(rawUrl) || 'AUDIO').toUpperCase();

  const record: OfflineDownloadRecord = {
    key,
    contentId: item.id,
    kind,
    url,
    title: item.title,
    speaker: item.speaker,
    categorySlug: item.categorySlug,
    categoryName: item.categoryName,
    format: kind === 'audio' ? audioFormatLabel : item.document?.format || 'PDF',
    sizeBytes: blob.size || (kind === 'audio' ? item.audio?.sizeBytes || 0 : item.document?.sizeBytes || 0),
    downloadedAt: new Date().toISOString(),
    itemSnapshot: item,
  };

  await saveOfflineRecord(record);

  // Best-effort download counter tracking when online
  if (navigator.onLine) {
    fetch(resolveApiUrl(`/api/content/${item.id}/track`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'download' }),
    }).catch(() => {});
  }

  return record;
}

export function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 KB';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function formatDuration(seconds: number): string {
  if (!seconds || isNaN(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${String(secs).padStart(2, '0')}`;
}
