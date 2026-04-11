'use client';

import Link from 'next/link';
import { useState } from 'react';
import { formatDuration } from '@/lib/api';
import type { MediaItem, Series } from '@/lib/types';

interface MediaCardProps {
  item: MediaItem | Series;
  href: string;
  onInfo?: () => void;
  onRefreshMetadata?: () => void;
}

function isMediaItem(item: MediaItem | Series): item is MediaItem {
  return 'durationSeconds' in item;
}

export function MediaCard({ item, href, onInfo, onRefreshMetadata }: MediaCardProps) {
  const mi = isMediaItem(item) ? item : null;
  const progress = mi?.watchPositionSeconds && mi?.durationSeconds
    ? mi.watchPositionSeconds / mi.durationSeconds
    : null;
  const [menuOpen, setMenuOpen] = useState(false);

  const hasMenu = onInfo || onRefreshMetadata;

  return (
    <div className="group relative block">
      <Link href={href} className="block">
        <div className="relative aspect-2/3 rounded-lg overflow-hidden bg-[#1a1a1a] mb-2">
          {item.thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.thumbnailUrl}
              alt={item.title}
              className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-slate-600">
              <svg className="w-12 h-12" fill="currentColor" viewBox="0 0 24 24">
                <path d="M4 4h16v12H4V4zm0 14h16v2H4v-2zm6-10l5 3-5 3V8z" />
              </svg>
            </div>
          )}

          {/* Duration badge */}
          {mi?.durationSeconds && (
            <span className="absolute bottom-1 right-1 bg-black/70 text-white text-xs px-1 rounded">
              {formatDuration(mi.durationSeconds)}
            </span>
          )}

          {/* Progress bar */}
          {progress !== null && progress > 0 && (
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
              <div
                className="h-full bg-indigo-500"
                style={{ width: `${Math.min(progress * 100, 100)}%` }}
              />
            </div>
          )}

          {/* Completed badge */}
          {mi?.isCompleted && (
            <div className="absolute top-1 right-1 bg-indigo-500 rounded-full p-0.5">
              <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
              </svg>
            </div>
          )}
        </div>
      </Link>

      {/* Kebab menu */}
      {hasMenu && (
        <div className="absolute top-1 left-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => { e.preventDefault(); setMenuOpen((v) => !v); }}
            className="bg-black/70 hover:bg-black/90 text-white rounded p-0.5"
            title="More options"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <circle cx="12" cy="5" r="1.5" />
              <circle cx="12" cy="12" r="1.5" />
              <circle cx="12" cy="19" r="1.5" />
            </svg>
          </button>

          {menuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
              <div className="absolute left-0 top-7 z-50 w-40 bg-[#1a1a1a] border border-[#2e2e2e] rounded-lg shadow-xl overflow-hidden">
                {onInfo && (
                  <button
                    onClick={() => { setMenuOpen(false); onInfo(); }}
                    className="w-full text-left px-3 py-2 text-sm text-slate-200 hover:bg-white/5"
                  >
                    Media Info
                  </button>
                )}
                {onRefreshMetadata && (
                  <button
                    onClick={() => { setMenuOpen(false); onRefreshMetadata(); }}
                    className="w-full text-left px-3 py-2 text-sm text-slate-200 hover:bg-white/5"
                  >
                    Refresh Metadata
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      )}

      <p className="text-sm font-medium text-slate-200 truncate">{item.title}</p>
      {mi?.year && <p className="text-xs text-slate-500">{mi.year}</p>}
    </div>
  );
}
