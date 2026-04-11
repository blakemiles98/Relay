'use client';

import { useEffect, useRef, useState } from 'react';
import { formatDuration } from '@/lib/api';

interface PlayerControlsProps {
  playing: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  muted: boolean;
  fullscreen: boolean;
  playbackRate: number;
  visible: boolean;
  title: string;
  onPlayPause: () => void;
  onSeek: (t: number) => void;
  onVolume: (v: number) => void;
  onMute: () => void;
  onFullscreen: () => void;
  onBack: () => void;
  onPlaybackRate: (r: number) => void;
}

const RATES = [0.5, 0.75, 1, 1.25, 1.5, 2];

export function PlayerControls({
  playing, currentTime, duration, volume, muted,
  fullscreen, playbackRate, visible, title,
  onPlayPause, onSeek, onVolume, onMute, onFullscreen, onBack, onPlaybackRate,
}: PlayerControlsProps) {
  const progress = duration > 0 ? currentTime / duration : 0;
  const [rateMenuOpen, setRateMenuOpen] = useState(false);
  const rateMenuRef = useRef<HTMLDivElement>(null);

  // Close rate menu on outside click
  useEffect(() => {
    if (!rateMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (rateMenuRef.current && !rateMenuRef.current.contains(e.target as Node))
        setRateMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [rateMenuOpen]);

  return (
    <div
      className={`absolute inset-0 z-20 flex flex-col justify-between transition-opacity duration-300 pointer-events-none ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
    >
      {/* Top bar */}
      <div className="pointer-events-auto flex items-center gap-3 px-4 pt-4 pb-8 bg-linear-to-b from-black/70 to-transparent">
        <button onClick={onBack} className="text-white p-1 hover:text-slate-300">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h2 className="text-white font-medium text-sm truncate flex-1">{title}</h2>
        {playbackRate !== 1 && (
          <span className="bg-indigo-500 text-white text-xs px-2 py-0.5 rounded-full font-medium">
            {playbackRate}×
          </span>
        )}
      </div>

      {/* Bottom bar */}
      <div className="pointer-events-auto px-4 pb-4 pt-8 bg-linear-to-t from-black/80 to-transparent">
        {/* Seek bar */}
        <div className="mb-3 flex items-center gap-3">
          <span className="text-white text-xs w-12 text-right">{formatDuration(currentTime)}</span>
          <div className="flex-1 relative h-1 group">
            <input
              type="range"
              min={0}
              max={duration || 100}
              value={currentTime}
              step={0.5}
              onChange={(e) => onSeek(Number(e.target.value))}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
            />
            <div className="h-1 bg-white/20 rounded-full overflow-hidden group-hover:h-2 transition-all">
              <div
                className="h-full bg-indigo-500 rounded-full"
                style={{ width: `${progress * 100}%` }}
              />
            </div>
          </div>
          <span className="text-white text-xs w-12">{formatDuration(duration)}</span>
        </div>

        {/* Buttons row */}
        <div className="flex items-center gap-2">
          {/* Play/Pause */}
          <button onClick={onPlayPause} className="text-white p-2 hover:text-slate-300">
            {playing ? (
              <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
              </svg>
            ) : (
              <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>

          {/* Volume */}
          <button onClick={onMute} className="text-white p-2 hover:text-slate-300 hidden sm:block">
            {muted || volume === 0 ? (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z" />
              </svg>
            )}
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={muted ? 0 : volume}
            onChange={(e) => onVolume(Number(e.target.value))}
            className="w-20 hidden sm:block accent-indigo-500"
          />

          <div className="flex-1" />

          {/* Playback rate */}
          <div className="relative" ref={rateMenuRef}>
            <button
              onClick={() => setRateMenuOpen((o) => !o)}
              className="text-white text-xs px-2 py-1 rounded border border-white/20 hover:border-white/40"
            >
              {playbackRate}×
            </button>
            {rateMenuOpen && (
              <div className="absolute bottom-9 right-0 flex flex-col bg-[#1a1a1a] border border-[#2e2e2e] rounded-xl overflow-hidden shadow-xl">
                {RATES.map((r) => (
                  <button
                    key={r}
                    onClick={() => { onPlaybackRate(r); setRateMenuOpen(false); }}
                    className={`px-4 py-2 text-sm text-left hover:bg-white/5 ${
                      r === playbackRate ? 'text-indigo-400' : 'text-white'
                    }`}
                  >
                    {r}×
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Fullscreen */}
          <button onClick={onFullscreen} className="text-white p-2 hover:text-slate-300">
            {fullscreen ? (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
