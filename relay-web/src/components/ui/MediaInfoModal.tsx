'use client';

import { formatDuration, formatFileSize } from '@/lib/api';
import type { MediaItem } from '@/lib/types';

interface MediaInfoModalProps {
  item: MediaItem;
  onClose: () => void;
}

export function MediaInfoModal({ item, onClose }: MediaInfoModalProps) {
  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/60" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div className="pointer-events-auto w-full max-w-lg bg-[#1a1a1a] border border-[#2e2e2e] rounded-xl shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#2e2e2e]">
            <h2 className="text-base font-semibold text-slate-100 truncate pr-4">{item.title}</h2>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-100 transition"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M18.3 5.71a1 1 0 0 0-1.41 0L12 10.59 7.11 5.7A1 1 0 0 0 5.7 7.11L10.59 12 5.7 16.89a1 1 0 1 0 1.41 1.41L12 13.41l4.89 4.89a1 1 0 0 0 1.41-1.41L13.41 12l4.89-4.89a1 1 0 0 0 0-1.4z" />
              </svg>
            </button>
          </div>

          <div className="px-5 py-4 space-y-3 text-sm">
            {item.overview && (
              <p className="text-slate-300 leading-relaxed">{item.overview}</p>
            )}

            <div className="grid grid-cols-2 gap-x-6 gap-y-2">
              {item.year && (
                <Row label="Year" value={String(item.year)} />
              )}
              {item.durationSeconds && (
                <Row label="Duration" value={formatDuration(item.durationSeconds)} />
              )}
              {item.width && item.height && (
                <Row label="Resolution" value={`${item.width}×${item.height}`} />
              )}
              {item.videoCodec && (
                <Row label="Video" value={item.videoCodec} />
              )}
              {item.audioCodec && (
                <Row label="Audio" value={item.audioCodec} />
              )}
              <Row label="Size" value={formatFileSize(item.fileSizeBytes)} />
              {item.externalId && item.externalSource && (
                <Row label="External ID" value={`${item.externalSource}:${item.externalId}`} />
              )}
            </div>

            <div className="pt-1">
              <p className="text-slate-500 text-xs break-all">
                <span className="text-slate-400 font-medium">Path: </span>
                <span className="text-slate-500">{item.filePath}</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-slate-500">{label}: </span>
      <span className="text-slate-200">{value}</span>
    </div>
  );
}
