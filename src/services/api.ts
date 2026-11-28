// Session token is held strictly in JS memory (never localStorage/sessionStorage)
let authTokenInMemory: string | null = null;

const LS_API_BASE_URL = 'minaratul_huda_api_base_url_v1';
export const DEFAULT_API_BASE_URL = 'https://studio.ugandakickboxingfederation.org';
export const APP_LOGO_PATH = '/assets/aistudio/WhatsApp_Image_2026-11-25_at_03.55.32_835749e8.jpeg';

const REQUEST_TIMEOUT_MS = 25000;
const GET_CACHE_TTL_MS = 20000;
const inflightGets = new Map<string, Promise<unknown>>();
const responseCache = new Map<string, { data: unknown; ts: number }>();

export function clearApiCache() {
  responseCache.clear();
}

export function setAuthToken(token: string | null) {
  authTokenInMemory = token;
}

export function getAuthToken(): string | null {
  return authTokenInMemory;
}

function normalizeUrl(raw: string | undefined | null): string {
  if (!raw) return '';
  const cleaned = raw.trim().replace(/^["']|["']$/g, '').replace(/\/+$/, '');
  if (!cleaned || cleaned === 'MY_APP_URL') return '';
  if (!/^https?:\/\//i.test(cleaned)) return '';
  return cleaned;
}

function isStaleOrSelfUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    if (host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0') {
      return true;
    }
    if (typeof window !== 'undefined' && parsed.origin === window.location.origin) {
      return true;
    }
    // Discard stale preview sandbox URLs saved before production URL was connected
    if (
      (host.startsWith('ais-dev-') || host.startsWith('ais-pre-')) &&
      host.endsWith('.run.app')
    ) {
      return true;
    }
  } catch {
    return true;
  }
  return false;
}

export function getStoredApiBaseUrl(): string {
  try {
    const normalized = normalizeUrl(localStorage.getItem(LS_API_BASE_URL));
    if (!normalized) return '';
    if (isStaleOrSelfUrl(normalized)) {
      localStorage.removeItem(LS_API_BASE_URL);
      return '';
    }
    return normalized;
  } catch {
    return '';
  }
}

export function setStoredApiBaseUrl(url: string) {
  const normalized = normalizeUrl(url);
  clearApiCache();
  try {
    if (normalized && normalized !== DEFAULT_API_BASE_URL && !isStaleOrSelfUrl(normalized)) {
      localStorage.setItem(LS_API_BASE_URL, normalized);
    } else {
      localStorage.removeItem(LS_API_BASE_URL);
    }
  } catch {
    // ignore storage errors
  }
}

/**
 * Resolves the remote Content Server URL configured via Settings, VITE_API_BASE_URL, or the default endpoint.
 */
export function getApiBaseUrl(): string {
  const fromStorage = typeof window !== 'undefined' ? getStoredApiBaseUrl() : '';
  if (fromStorage) return fromStorage;

  const fromEnv = normalizeUrl(import.meta.env.VITE_API_BASE_URL);
  return fromEnv || DEFAULT_API_BASE_URL;
}

export function resolveApiUrl(path: string): string {
  if (!path) return path;
  if (/^https?:\/\//i.test(path)) return path;
  const base = getApiBaseUrl();
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return base ? `${base}${normalizedPath}` : normalizedPath;
}

export function resolveMediaUrl(url: string | null | undefined): string {
  if (!url) return '';
  if (/^(https?:|blob:|data:)/i.test(url)) return url;
  const base = getApiBaseUrl();
  const normalizedPath = url.startsWith('/') ? url : `/${url}`;
  return base ? `${base}${normalizedPath}` : normalizedPath;
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs = REQUEST_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const externalSignal = init.signal;
  const onExternalAbort = () => controller.abort();
  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort();
    } else {
      externalSignal.addEventListener('abort', onExternalAbort, { once: true });
    }
  }

  const timer = globalThis.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    globalThis.clearTimeout(timer);
    if (externalSignal) {
      externalSignal.removeEventListener('abort', onExternalAbort);
    }
  }
}

async function executeApiRequest<T>(
  targetUrl: string,
  method: string,
  headers: Headers,
  options: RequestInit
): Promise<T> {
  const maxAttempts = method === 'GET' ? 2 : 1;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetchWithTimeout(targetUrl, {
        ...options,
        cache: options.cache ?? (method === 'GET' ? 'no-store' : 'default'),
        headers,
      });

      const contentType = (res.headers.get('content-type') || '').toLowerCase();
      const rawText = await res.text();
      const trimmed = rawText.trim();
      const looksJson =
        contentType.includes('json') ||
        trimmed.startsWith('{') ||
        trimmed.startsWith('[');

      if (!looksJson) {
        if (attempt < maxAttempts && res.status >= 502 && res.status <= 504) {
          await new Promise((r) => setTimeout(r, 600));
          continue;
        }
        throw new Error(
          res.ok
            ? 'Server returned an unexpected non-JSON response. Verify your Content Server URL.'
            : `Request failed (${res.status})`
        );
      }

      let data: any = {};
      try {
        data = trimmed ? JSON.parse(trimmed) : {};
      } catch {
        throw new Error(
          res.ok
            ? 'Unable to parse response from the content server.'
            : `Request failed (${res.status})`
        );
      }

      if (!res.ok) {
        if (attempt < maxAttempts && res.status >= 502 && res.status <= 504) {
          await new Promise((r) => setTimeout(r, 600));
          continue;
        }
        throw new Error(data.error || `Request failed (${res.status})`);
      }

      return data as T;
    } catch (err: any) {
      lastError = err;
      const isCallerAbort = Boolean(options.signal?.aborted);
      if (isCallerAbort) throw err;

      const isTransient =
        err?.name === 'AbortError' ||
        err instanceof TypeError ||
        /network|fetch|timeout|50[234]/i.test(String(err?.message || ''));

      if (attempt < maxAttempts && isTransient) {
        await new Promise((r) => setTimeout(r, 600));
        continue;
      }

      if (err?.name === 'AbortError') {
        throw new Error('The content server took too long to respond. Please try again.');
      }
      throw err;
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Unable to reach content server.');
}

export async function apiRequest<T = any>(
  path: string,
  options: RequestInit & { forceRefresh?: boolean } = {}
): Promise<T> {
  const base = getApiBaseUrl();
  if (!base && !/^https?:\/\//i.test(path)) {
    throw new Error('Content Server URL is not configured. Open Settings to connect your server.');
  }

  const { forceRefresh, ...fetchOptions } = options;
  const method = (fetchOptions.method || 'GET').toUpperCase();
  const headers = new Headers(fetchOptions.headers || {});
  if (
    !headers.has('Content-Type') &&
    fetchOptions.body !== undefined &&
    !(fetchOptions.body instanceof FormData)
  ) {
    headers.set('Content-Type', 'application/json');
  }
  if (authTokenInMemory) {
    headers.set('Authorization', `Bearer ${authTokenInMemory}`);
  }

  const targetUrl = resolveApiUrl(path);

  if (method === 'GET' && !authTokenInMemory && !fetchOptions.signal) {
    if (!forceRefresh) {
      const cached = responseCache.get(targetUrl);
      if (cached && Date.now() - cached.ts < GET_CACHE_TTL_MS) {
        return cached.data as T;
      }
    }

    const existing = inflightGets.get(targetUrl);
    if (existing) {
      return existing as Promise<T>;
    }
    const promise = executeApiRequest<T>(targetUrl, method, headers, fetchOptions)
      .then((result) => {
        responseCache.set(targetUrl, { data: result, ts: Date.now() });
        return result;
      })
      .finally(() => {
        inflightGets.delete(targetUrl);
      });
    inflightGets.set(targetUrl, promise);
    return promise;
  }

  if (method !== 'GET') {
    clearApiCache();
  }

  return executeApiRequest<T>(targetUrl, method, headers, fetchOptions);
}
