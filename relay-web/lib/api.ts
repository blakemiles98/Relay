// Central API client — all fetch calls go through here so auth headers
// and the base URL are applied consistently.

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000";

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("relay_token");
}

export function saveToken(token: string) {
  localStorage.setItem("relay_token", token);
}

export function clearToken() {
  localStorage.removeItem("relay_token");
  localStorage.removeItem("relay_user");
}

export function getStoredUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem("relay_user");
  return raw ? JSON.parse(raw) : null;
}

export function saveUser(user: AuthUser) {
  localStorage.setItem("relay_user", JSON.stringify(user));
}

export interface AuthUser {
  userId: number;
  displayName: string;
  isAdmin: boolean;
  token: string;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init.headers as Record<string, string> ?? {}),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, { ...init, headers });

  if (res.status === 401) {
    clearToken();
    window.location.href = "/";
    throw new Error("Unauthorized");
  }

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(text || `HTTP ${res.status}`);
  }

  const ct = res.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) return res.json() as Promise<T>;
  return null as T;
}

const get = <T>(path: string) => request<T>(path);
const post = <T>(path: string, body?: unknown) =>
  request<T>(path, { method: "POST", body: JSON.stringify(body) });
const put = <T>(path: string, body?: unknown) =>
  request<T>(path, { method: "PUT", body: JSON.stringify(body) });
const del = <T>(path: string) => request<T>(path, { method: "DELETE" });

// ── Setup ─────────────────────────────────────────────────────────────────────
export const api = {
  setup: {
    status: () => get<{ setupComplete: boolean }>("/api/setup/status"),
    complete: (body: { username: string; password: string; tmdbApiKey?: string }) =>
      post<{ token: string; userId: number }>("/api/setup/complete", body),
  },

  // ── Auth ──────────────────────────────────────────────────────────────────
  auth: {
    profiles: () => get<Profile[]>("/api/auth/profiles"),
    login: (userId: number, password?: string) =>
      post<AuthUser>("/api/auth/login", { userId, password }),
    loginManual: (username: string, password: string) =>
      post<AuthUser>("/api/auth/login/manual", { username, password }),
    logout: () => post("/api/auth/logout"),
  },

  // ── Users ─────────────────────────────────────────────────────────────────
  users: {
    list: () => get<AdminUser[]>("/api/users"),
    create: (body: CreateUserBody) => post<{ id: number }>("/api/users", body),
    update: (id: number, body: Partial<CreateUserBody>) => put(`/api/users/${id}`, body),
    delete: (id: number) => del(`/api/users/${id}`),
    setLibraryAccess: (id: number, libraryIds: number[]) =>
      put(`/api/users/${id}/library-access`, { libraryIds }),
    getSettings: () => get<UserSettings>("/api/users/me/settings"),
    updateSettings: (body: Partial<UserSettings>) => put("/api/users/me/settings", body),
    watchlist: () => get<WatchlistItem[]>("/api/users/me/watchlist"),
    addToWatchlist: (id: number) => post(`/api/users/me/watchlist/${id}`),
    removeFromWatchlist: (id: number) => del(`/api/users/me/watchlist/${id}`),
  },

  // ── Libraries ─────────────────────────────────────────────────────────────
  libraries: {
    list: () => get<Library[]>("/api/libraries"),
    create: (body: CreateLibraryBody) => post<{ id: number }>("/api/libraries", body),
    update: (id: number, body: Partial<CreateLibraryBody>) => put(`/api/libraries/${id}`, body),
    delete: (id: number) => del(`/api/libraries/${id}`),
    scan: (id: number) => post(`/api/libraries/${id}/scan`),
  },

  // ── Media ─────────────────────────────────────────────────────────────────
  media: {
    home: () => get<HomeData>("/api/media/home"),
    library: (id: number, search?: string) =>
      get<LibraryContents>(`/api/media/library/${id}${search ? `?search=${encodeURIComponent(search)}` : ""}`),
    series: (id: number) => get<SeriesDetail>(`/api/media/series/${id}`),
    season: (id: number) => get<SeasonDetail>(`/api/media/season/${id}`),
    item: (id: number) => get<MediaDetail>(`/api/media/${id}`),
    saveProgress: (id: number, body: ProgressBody) => post(`/api/media/${id}/progress`, body),
    folder: (path: string) => get<FolderContents>(`/api/media/folder?path=${encodeURIComponent(path)}`),
  },

  // ── Stream URLs (not fetch calls — just URL builders) ────────────────────
  stream: {
    directUrl: (id: number) => `${BASE}/api/stream/direct/${id}`,
    hlsUrl: (id: number) => `${BASE}/api/stream/hls/${id}/master.m3u8`,
    photoUrl: (id: number) => `${BASE}/api/stream/photo/${id}`,
    trickplayUrl: (id: number, file: string) => `${BASE}/api/stream/trickplay/${id}/${file}`,
  },

  // ── Tasks ─────────────────────────────────────────────────────────────────
  tasks: {
    list: () => get<ScheduledTask[]>("/api/tasks"),
    update: (id: number, body: { isEnabled?: boolean; cronSchedule?: string }) => put(`/api/tasks/${id}`, body),
    run: (id: number) => post(`/api/tasks/${id}/run`),
    runs: (id: number) => get<TaskRun[]>(`/api/tasks/${id}/runs`),
  },

  // ── Filesystem browser (admin only) ──────────────────────────────────────
  fs: {
    browse: (path?: string) =>
      get<{ parent: string | null; dirs: { fullPath: string; name: string; label: string | null }[] }>(
        `/api/fs/browse${path ? `?path=${encodeURIComponent(path)}` : ""}`
      ),
  },

  // ── Settings ──────────────────────────────────────────────────────────────
  settings: {
    get: () => get<AppSettings>("/api/settings"),
    update: (body: Partial<AppSettings>) => put("/api/settings", body),
    encoder: () => get<{ encoder: string }>("/api/settings/encoder"),
  },
};

// ── Types ─────────────────────────────────────────────────────────────────────
export interface Profile {
  id: number;
  displayName: string;
  avatarPath: string | null;
  hasPassword: boolean;
}

export interface AdminUser {
  id: number;
  username: string;
  displayName: string;
  avatarPath: string | null;
  isAdmin: boolean;
  isHidden: boolean;
  createdAt: string;
}

export interface CreateUserBody {
  username: string;
  displayName?: string;
  password?: string;
  isAdmin: boolean;
  isHidden: boolean;
}

export interface UserSettings {
  defaultSubtitleLanguage: string;
  defaultAudioLanguage: string;
  playbackQuality: string;
}

export interface Library {
  id: number;
  name: string;
  type: "Movies" | "TvShows" | "Mixed" | "HomeMedia";
  rootPath: string;
  metadataEnabled: boolean;
  whisperEnabled: boolean;
  lastScannedAt: string | null;
}

export interface CreateLibraryBody {
  name: string;
  type: "Movies" | "TvShows" | "Mixed" | "HomeMedia";
  rootPath: string;
  metadataEnabled: boolean;
  whisperEnabled: boolean;
  metadataRefreshIntervalHours?: number;
}

export interface MediaItem {
  id: number;
  title: string;
  posterPath: string | null;
  type: "Movie" | "Episode" | "HomeVideo" | "Photo";
  addedAt: string;
  year?: number;
  imdbScore?: number;
  folderPath?: string;
}

export interface HomeData {
  continueWatching: (MediaItem & { positionSeconds: number; durationSeconds: number | null })[];
  recentlyAdded: MediaItem[];
}

export interface LibraryContents {
  series?: { id: number; title: string; posterPath: string | null; year: number | null; imdbScore: number | null; type: "series" }[];
  movies?: { id: number; title: string; posterPath: string | null; year: number | null; imdbScore: number | null; type: "movie" }[];
  items?: MediaItem[];
}

export interface SeriesDetail {
  id: number;
  title: string;
  overview: string | null;
  posterPath: string | null;
  backdropPath: string | null;
  year: number | null;
  imdbScore: number | null;
  rottenTomatoesScore: number | null;
  genres: string[] | null;
  seasons: { id: number; seasonNumber: number; title: string | null; posterPath: string | null }[];
}

export interface SeasonDetail {
  season: { id: number; seasonNumber: number; title: string | null };
  episodes: MediaItem[];
}

export interface SubtitleTrack {
  id: number;
  language: string;
  label: string;
  filePath: string;
  isExternal: boolean;
  streamIndex: number | null;
}

export interface AudioTrackInfo {
  id: number;
  streamIndex: number;
  language: string;
  label: string;
  codec: string;
  channels: number;
}

export interface MediaDetail {
  item: MediaItem & {
    overview: string | null;
    backdropPath: string | null;
    imdbScore: number | null;
    rottenTomatoesScore: number | null;
    genres: string[] | null;
    cast: string[] | null;
    durationSeconds: number | null;
    subtitles: SubtitleTrack[];
    audioTracks: AudioTrackInfo[];
    whisperCompleted: boolean;
    trickplayGenerated: boolean;
  };
  progress: { positionSeconds: number; isCompleted: boolean; lastAudioLanguage: string | null; lastSubtitleLanguage: string | null } | null;
}

export interface ProgressBody {
  positionSeconds: number;
  isCompleted: boolean;
  lastAudioLanguage?: string;
  lastSubtitleLanguage?: string;
}

export interface FolderContents {
  subFolders: { name: string; fullPath: string }[];
  items: { id: number; title: string; type: string; posterPath: string | null }[];
}

export interface ScheduledTask {
  id: number;
  key: string;
  name: string;
  category: string;
  cronSchedule: string | null;
  isEnabled: boolean;
  lastRunAt: string | null;
  lastDurationSeconds: number | null;
  lastStatus: "Idle" | "Running" | "Success" | "Failed";
}

export interface TaskRun {
  id: number;
  startedAt: string;
  completedAt: string | null;
  status: "Running" | "Success" | "Failed";
  log: string | null;
}

export interface AppSettings {
  tmdbApiKey: string | null;
  discordWebhookUrl: string | null;
  notifyOnLibraryScanComplete: boolean;
  notifyOnNewMediaAdded: boolean;
  notifyOnTaskFailed: boolean;
  notifyOnWhisperComplete: boolean;
  notifyOnUserCreated: boolean;
}

export interface WatchlistItem {
  id: number;
  title: string;
  posterPath: string | null;
  type: string;
  addedAt: string;
}
