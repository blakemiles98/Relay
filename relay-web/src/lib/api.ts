import type { Library, MediaItem, PagedResult, Season, Series, User } from './types';

export interface ScheduledTask {
  type: string;
  name: string;
  running: boolean;
  lastRun: string | null;
  lastResult: string | null;
}

// All API calls go through the Next.js proxy (/api/*), making them same-origin.
// The httpOnly auth cookie is sent automatically via credentials: 'include'.
const BASE_URL = '';

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    credentials: 'include',
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new ApiError(res.status, body || res.statusText);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

// ── Setup ──────────────────────────────────────────────────────────────────────
export const setup = {
  status: () => request<{ isComplete: boolean }>('/api/setup/status'),
  initialize: (body: {
    adminUsername: string;
    adminPassword: string | null;
    avatarColor: string;
    libraries: { name: string; path: string; type: string }[];
  }) => request<{ message: string; adminId: string }>('/api/setup', {
    method: 'POST',
    body: JSON.stringify(body),
  }),
};

// ── Auth ───────────────────────────────────────────────────────────────────────
export const auth = {
  profiles: () => request<User[]>('/api/auth/profiles'),
  hasPassword: (id: string) =>
    request<{ hasPassword: boolean }>(`/api/auth/profiles/${id}/has-password`),
  login: async (username: string, password: string | null) => {
    // The backend sets an httpOnly cookie — no token handling needed client-side.
    await request<{ message: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
  },
  me: () => request<User>('/api/auth/me'),
  logout: async () => {
    // Ask the backend to clear the httpOnly cookie.
    await request<void>('/api/auth/logout', { method: 'POST' }).catch(() => {});
  },
  createUser: (body: { username: string; password: string | null; avatarColor: string; isAdmin: boolean; libraryIds: string[] }) =>
    request<User>('/api/auth/users', { method: 'POST', body: JSON.stringify(body) }),
  updateUser: (id: string, body: { username: string; password: string | null; avatarColor: string; isAdmin: boolean; libraryIds: string[] }) =>
    request<User>(`/api/auth/users/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  getUserLibraries: (id: string) =>
    request<string[]>(`/api/auth/users/${id}/libraries`),
  setUserLibraries: (id: string, libraryIds: string[]) =>
    request<void>(`/api/auth/users/${id}/libraries`, { method: 'PUT', body: JSON.stringify(libraryIds) }),
  deleteUser: (id: string) =>
    request<void>(`/api/auth/users/${id}`, { method: 'DELETE' }),
};

// ── Libraries ─────────────────────────────────────────────────────────────────
export const libraries = {
  list: () => request<Library[]>('/api/libraries'),
  get: (id: string) => request<Library>(`/api/libraries/${id}`),
  create: (body: { name: string; path: string; type: string }) =>
    request<Library>('/api/libraries', { method: 'POST', body: JSON.stringify(body) }),
  delete: (id: string) => request<void>(`/api/libraries/${id}`, { method: 'DELETE' }),
  scan: (id: string) => request<void>(`/api/libraries/${id}/scan`, { method: 'POST' }),
  scanAll: () => request<void>('/api/libraries/scan-all', { method: 'POST' }),
};

// ── Filesystem ────────────────────────────────────────────────────────────────
export interface BrowseResult {
  path: string;
  parent: string | null;
  directories: string[];
}

export const filesystem = {
  browse: (path?: string) => {
    const params = path ? `?path=${encodeURIComponent(path)}` : '';
    return request<BrowseResult>(`/api/fs/browse${params}`);
  },
};

// ── Media ─────────────────────────────────────────────────────────────────────
export const media = {
  libraryItems: (libraryId: string, page = 1, pageSize = 50, search?: string, subFolder?: string) => {
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (search) params.set('search', search);
    if (subFolder) params.set('subFolder', subFolder);
    return request<PagedResult<MediaItem>>(`/api/media/library/${libraryId}?${params}`);
  },
  librarySeries: (libraryId: string, subFolder?: string) => {
    const params = subFolder ? `?subFolder=${encodeURIComponent(subFolder)}` : '';
    return request<Series[]>(`/api/media/library/${libraryId}/series${params}`);
  },
  librarySubfolders: (libraryId: string) =>
    request<string[]>(`/api/media/library/${libraryId}/subfolders`),
  seriesSeasons: (seriesId: string) =>
    request<Season[]>(`/api/media/series/${seriesId}/seasons`),
  seasonEpisodes: (seasonId: string) =>
    request<MediaItem[]>(`/api/media/season/${seasonId}/episodes`),
  get: (id: string) => request<MediaItem>(`/api/media/${id}`),
  continueWatching: () => request<MediaItem[]>('/api/media/continue-watching'),
  recent: (count = 20) => request<MediaItem[]>(`/api/media/recent?count=${count}`),
  saveProgress: (id: string, positionSeconds: number, durationSeconds: number, isCompleted: boolean) =>
    request<void>(`/api/media/${id}/progress`, {
      method: 'POST',
      body: JSON.stringify({ positionSeconds, durationSeconds, isCompleted }),
    }),
};

// ── Stream URLs (not fetch, just URL builders) ─────────────────────────────────
export const stream = {
  directUrl: (id: string) => `/api/stream/direct/${id}`,
  hlsUrl: (id: string, maxHeight?: number) => {
    const params = maxHeight ? `?maxHeight=${maxHeight}` : '';
    return `/api/stream/hls/${id}/index.m3u8${params}`;
  },
  photoUrl: (id: string) => `/api/stream/photo/${id}`,
  encoderInfo: () => request<{ encoder: string }>('/api/stream/encoder-info'),
};

// ── Admin ─────────────────────────────────────────────────────────────────────
export const admin = {
  stats: () => request<{ libraries: number; series: number; movies: number; episodes: number; users: number }>('/api/admin/stats'),
  tasks: () => request<ScheduledTask[]>('/api/admin/tasks'),
  runTask: (type: string) => request<void>(`/api/admin/tasks/${type}/run`, { method: 'POST' }),
  refreshMetadata: (type: 'series' | 'movie', id: string) =>
    request<{ message: string; title?: string }>(`/api/admin/metadata/refresh/${type}/${id}`, { method: 'POST' }),
  setLibraryMetadataProvider: (id: string, provider: string) =>
    request<void>(`/api/admin/libraries/${id}/metadata-provider`, {
      method: 'PUT',
      body: JSON.stringify({ provider }),
    }),
};

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}
