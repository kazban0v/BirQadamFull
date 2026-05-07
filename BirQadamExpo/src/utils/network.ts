import Constants from 'expo-constants';
import { Platform } from 'react-native';

const PRODUCTION_API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL?.trim() || '';
const DEV_API_PORT = '8000';
export const VOLUNTEER_FALLBACK_IMAGE_URL =
  process.env.EXPO_PUBLIC_FALLBACK_IMAGE_URL || 'https://images.unsplash.com/photo-1559027615-cd4628902d4a?auto=format&fit=crop&w=1200&q=80';

const BACKEND_HOSTS = new Set([
  'localhost',
  '127.0.0.1',
  '10.0.2.2',
  ...(process.env.EXPO_PUBLIC_BACKEND_HOSTS
    ? process.env.EXPO_PUBLIC_BACKEND_HOSTS.split(',').map((h: string) => h.trim())
    : [])
]);

const trimTrailingSlash = (value: string): string => value.replace(/\/+$/, '');

const extractHost = (value?: string | null): string | null => {
  if (!value) {
    return null;
  }

  const normalized = value.trim().replace(/^[a-z]+:\/\//i, '');
  const [hostWithPort] = normalized.split('/');
  const [host] = hostWithPort.split(':');

  return host || null;
};

const isPrivateIpv4 = (host: string): boolean => {
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)) {
    return true;
  }

  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(host)) {
    return true;
  }

  const match = host.match(/^172\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/);
  if (!match) {
    return false;
  }

  const secondOctet = Number(match[1]);
  return secondOctet >= 16 && secondOctet <= 31;
};

const buildLocalUrl = (host: string): string => `http://${host}:${DEV_API_PORT}`;

const getExpoDevHost = (): string | null => {
  const candidates = [
    Constants.expoConfig?.hostUri,
    Constants.platform?.hostUri,
    Constants.linkingUri,
    Constants.experienceUrl,
  ];

  for (const candidate of candidates) {
    const host = extractHost(candidate);
    if (!host) {
      continue;
    }

    if (host === 'localhost' || host === '127.0.0.1') {
      continue;
    }

    return host;
  }

  return null;
};

const getWebDevBaseUrl = (): string => {
  const location = (globalThis as { location?: { host?: string; hostname?: string } }).location;
  const host = extractHost(location?.host) ?? location?.hostname ?? 'localhost';

  return buildLocalUrl(host);
};

const getLocalDevApiBaseUrl = (): string | null => {
  if (!__DEV__) {
    return null;
  }

  const expoHost = getExpoDevHost();
  if (expoHost) {
    return buildLocalUrl(expoHost);
  }

  if (Platform.OS === 'android') {
    return buildLocalUrl('10.0.2.2');
  }

  if (Platform.OS === 'web') {
    return getWebDevBaseUrl();
  }

  return buildLocalUrl('localhost');
};

export const getApiBaseUrl = (): string => {
  const envUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();
  if (envUrl) {
    return trimTrailingSlash(envUrl);
  }

  if (!__DEV__) {
    return PRODUCTION_API_BASE_URL;
  }

  return getLocalDevApiBaseUrl() ?? PRODUCTION_API_BASE_URL;
};

const buildApiBaseUrlCandidates = (): string[] => {
  const candidates = [getApiBaseUrl()];
  const localDevBaseUrl = getLocalDevApiBaseUrl();

  if (localDevBaseUrl && !candidates.includes(localDevBaseUrl)) {
    candidates.push(localDevBaseUrl);
  }

  return candidates.map(trimTrailingSlash);
};

const API_BASE_URL_CANDIDATES = buildApiBaseUrlCandidates();
let currentApiBaseUrl = API_BASE_URL_CANDIDATES[0];

export const API_BASE_URL = currentApiBaseUrl;
export const API_ORIGIN = trimTrailingSlash(API_BASE_URL);

export const getApiBaseUrlCandidates = (): string[] => [...API_BASE_URL_CANDIDATES];

export const getCurrentApiBaseUrl = (): string => currentApiBaseUrl;

export const getCurrentApiOrigin = (): string => trimTrailingSlash(currentApiBaseUrl);

export const getFallbackApiBaseUrl = (): string | null =>
  API_BASE_URL_CANDIDATES.find((candidate) => candidate !== currentApiBaseUrl) ?? null;

export const switchApiBaseUrl = (nextBaseUrl: string): string => {
  currentApiBaseUrl = trimTrailingSlash(nextBaseUrl);
  return currentApiBaseUrl;
};

const shouldUseCurrentBackendHost = (url: string): boolean => {
  const host = extractHost(url);
  if (!host) {
    return false;
  }

  return BACKEND_HOSTS.has(host) || isPrivateIpv4(host);
};

export const replaceWithApiOrigin = (url: string): string => {
  const apiOrigin = getCurrentApiOrigin();

  if (/^https?:\/\//i.test(url)) {
    return url.replace(/^https?:\/\/[^/]+/i, apiOrigin);
  }

  if (url.startsWith('/')) {
    return `${apiOrigin}${url}`;
  }

  return `${apiOrigin}/${url.replace(/^\/+/, '')}`;
};

export const normalizeImageUrl = (url: string | undefined | null): string | undefined => {
  const apiOrigin = getCurrentApiOrigin();

  if (!url) {
    return undefined;
  }

  /** Относительные пути с бэкенда (например /media/...) — всегда через текущий API origin */
  if (url.startsWith('/')) {
    return `${apiOrigin}${url}`;
  }

  if (__DEV__ && shouldUseCurrentBackendHost(url)) {
    return replaceWithApiOrigin(url);
  }

  return url;
};

/** Та же цепочка, что на экране деталей задачи: обложка задачи → проекта → дефолтное фото волонтёра */
export function resolveVolunteerTaskHeroImageUrl(task: {
  image?: string | null;
  task_image_url?: string | null;
  project_cover_image_url?: string | null;
}): string {
  return (
    normalizeImageUrl(task.image) ||
    normalizeImageUrl(task.task_image_url) ||
    normalizeImageUrl(task.project_cover_image_url) ||
    VOLUNTEER_FALLBACK_IMAGE_URL
  );
}
