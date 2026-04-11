export interface User {
  id: string;
  username: string;
  isAdmin: boolean;
  avatarColor: string;
}

export interface Library {
  id: string;
  name: string;
  path: string;
  type: 'Movies' | 'Shows' | 'Mixed' | 'HomeVideos' | 'Photos';
  createdAt: string;
  lastScanned: string | null;
  itemCount: number;      // logical: series count for Shows/Mixed, file count otherwise
  totalItemCount: number; // raw file count
  metadataProvider: string;
}

export interface MediaItem {
  id: string;
  libraryId: string;
  title: string;
  type: 'Movie' | 'Episode' | 'HomeVideo' | 'Photo';
  thumbnailUrl: string | null;
  durationSeconds: number | null;
  width: number | null;
  height: number | null;
  videoCodec: string | null;
  audioCodec: string | null;
  fileSizeBytes: number;
  year: number | null;
  overview: string | null;
  dateAdded: string;
  seriesId: string | null;
  seasonId: string | null;
  episodeNumber: number | null;
  watchPositionSeconds: number | null;
  isCompleted: boolean | null;
  externalId?: string;
  externalSource?: string;
  filePath: string;
}

export interface Series {
  id: string;
  libraryId: string;
  title: string;
  overview: string | null;
  thumbnailUrl: string | null;
  year: number | null;
  seasonCount: number;
  episodeCount: number;
  externalId?: string;
  externalSource?: string;
}

export interface Season {
  id: string;
  seriesId: string;
  seasonNumber: number;
  title: string | null;
  thumbnailUrl: string | null;
  episodeCount: number;
}

export interface PagedResult<T> {
  total: number;
  page: number;
  pageSize: number;
  items: T[];
}
