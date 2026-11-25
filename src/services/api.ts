// Session token is held strictly in JS memory (never localStorage/sessionStorage)
let authTokenInMemory: string | null = null;

const LS_API_BASE_URL = 'minaratul_huda_api_base_url_v1';
export const DEFAULT_API_BASE_URL = 'https://studio.ugandakickboxingfederation.org';

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

export function getStoredApiBaseUrl(): string {
  try {
    return normalizeUrl(localStorage.getItem(LS_API_BASE_URL));
  } catch {
    return '';
  }
}

export function setStoredApiBaseUrl(url: string) {
  const normalized = normalizeUrl(url);
  try {
    if (normalized && normalized !== DEFAULT_API_BASE_URL) {
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

export async function apiRequest<T = any>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const base = getApiBaseUrl();
  if (!base && !/^https?:\/\//i.test(path)) {
    throw new Error('Content Server URL is not configured. Open Settings to connect your server.');
  }

  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  if (authTokenInMemory) {
    headers.set('Authorization', `Bearer ${authTokenInMemory}`);
  }

  const targetUrl = resolveApiUrl(path);
  const res = await fetch(targetUrl, {
    ...options,
    headers,
  });

  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    throw new Error(
      res.ok
        ? 'Server returned an unexpected non-JSON response. Verify your Content Server URL.'
        : `Request failed (${res.status})`
    );
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data as T;
}
