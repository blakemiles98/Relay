'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import { media, stream } from '@/lib/api';
import { GestureLayer } from './GestureLayer';
import { PlayerControls } from './PlayerControls';
import type { MediaItem } from '@/lib/types';

interface VideoPlayerProps {
  item: MediaItem;
  onBack: () => void;
}

const SKIP_SECONDS = 10;
const SPEED_HOLD = 2.0;
const CONTROLS_HIDE_MS = 3500;
const SAVE_PROGRESS_INTERVAL_MS = 5000;

export function VideoPlayer({ item, onBack }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const controlsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [skipFeedback, setSkipFeedback] = useState<'left' | 'right' | null>(null);
  const [holdActive, setHoldActive] = useState(false);
  const [hlsError, setHlsError] = useState<string | null>(null);

  // ── Restore saved volume on mount ─────────────────────────────────────────
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const saved = parseFloat(localStorage.getItem('relay_volume') ?? '1');
    if (!isNaN(saved) && saved >= 0 && saved <= 1) {
      video.volume = saved;
      video.muted = saved === 0;
    }
  }, []);

  // ── HLS setup ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const src = stream.hlsUrl(item.id);

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        xhrSetup: (xhr) => { xhr.withCredentials = true; },
        // Transcoding the first segment can take 30-60s on CPU for 1080p HEVC
        manifestLoadingTimeOut: 120000,
        manifestLoadingMaxRetry: 1,
      });

      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          const msg = `${data.type ?? 'unknown'} / ${data.details ?? 'unknown'}` +
            (data.response ? ` (HTTP ${data.response.code})` : '');
          console.error('HLS fatal error:', data.type, data.details, data.response, data);
          setHlsError(msg);
          hls.destroy();
        }
      });

      hls.loadSource(src);
      hls.attachMedia(video);
      hlsRef.current = hls;
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Safari native HLS
      video.src = src;
    } else {
      video.src = stream.directUrl(item.id);
    }

    // Resume from last position
    if (item.watchPositionSeconds && item.watchPositionSeconds > 10) {
      video.currentTime = item.watchPositionSeconds;
    }

    return () => {
      hlsRef.current?.destroy();
      hlsRef.current = null;
    };
  }, [item]);

  // ── Video event listeners ─────────────────────────────────────────────────
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onTimeUpdate = () => setCurrentTime(video.currentTime);
    const onDurationChange = () => setDuration(video.duration);
    const onVolumeChange = () => { setVolume(video.volume); setMuted(video.muted); };

    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('durationchange', onDurationChange);
    video.addEventListener('volumechange', onVolumeChange);

    return () => {
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('durationchange', onDurationChange);
      video.removeEventListener('volumechange', onVolumeChange);
    };
  }, []);

  // ── Fullscreen change sync ─────────────────────────────────────────────────
  useEffect(() => {
    const onChange = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  // ── Progress saving ─────────────────────────────────────────────────────
  useEffect(() => {
    saveTimerRef.current = setInterval(() => {
      const video = videoRef.current;
      if (!video || video.currentTime < 1) return;
      const completed = duration > 0 && video.currentTime >= duration * 0.95;
      media.saveProgress(item.id, video.currentTime, duration, completed).catch(() => {});
    }, SAVE_PROGRESS_INTERVAL_MS);

    return () => {
      if (saveTimerRef.current) clearInterval(saveTimerRef.current);
    };
  }, [item.id, duration]);

  // ── Controls auto-hide ─────────────────────────────────────────────────────
  const showControls = useCallback(() => {
    setControlsVisible(true);
    if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    controlsTimerRef.current = setTimeout(() => setControlsVisible(false), CONTROLS_HIDE_MS);
  }, []);

  // ── Actions ───────────────────────────────────────────────────────────────
  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play(); else v.pause();
    showControls();
  }, [showControls]);

  const seek = useCallback((t: number) => {
    if (videoRef.current) videoRef.current.currentTime = t;
    showControls();
  }, [showControls]);

  const skipLeft = useCallback(() => {
    if (videoRef.current) videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - SKIP_SECONDS);
    setSkipFeedback('left');
    setTimeout(() => setSkipFeedback(null), 600);
    showControls();
  }, [showControls]);

  const skipRight = useCallback(() => {
    if (videoRef.current) videoRef.current.currentTime = Math.min(duration, videoRef.current.currentTime + SKIP_SECONDS);
    setSkipFeedback('right');
    setTimeout(() => setSkipFeedback(null), 600);
    showControls();
  }, [duration, showControls]);

  const holdStart = useCallback(() => {
    if (videoRef.current) videoRef.current.playbackRate = SPEED_HOLD;
    setPlaybackRate(SPEED_HOLD);
    setHoldActive(true);
  }, []);

  const holdEnd = useCallback(() => {
    if (videoRef.current) videoRef.current.playbackRate = 1;
    setPlaybackRate(1);
    setHoldActive(false);
  }, []);

  const setRate = useCallback((r: number) => {
    if (videoRef.current) videoRef.current.playbackRate = r;
    setPlaybackRate(r);
    showControls();
  }, [showControls]);

  const setVol = useCallback((v: number) => {
    if (videoRef.current) { videoRef.current.volume = v; videoRef.current.muted = v === 0; }
    localStorage.setItem('relay_volume', String(v));
    showControls();
  }, [showControls]);

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    // Persist the underlying volume level (not 0 when muted)
    localStorage.setItem('relay_volume', String(video.muted ? 0 : video.volume));
    showControls();
  }, [showControls]);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  }, []);

  const handleTap = useCallback(() => {
    if (controlsVisible) {
      togglePlay();
    } else {
      showControls();
    }
  }, [controlsVisible, togglePlay, showControls]);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full bg-black overflow-hidden"
      style={{ cursor: controlsVisible ? 'default' : 'none' }}
    >
      <video
        ref={videoRef}
        className="w-full h-full object-contain"
        playsInline
        autoPlay
      />

      {/* Gesture layer sits above video, below controls */}
      <GestureLayer
        onDoubleTapLeft={skipLeft}
        onDoubleTapRight={skipRight}
        onHoldStart={holdStart}
        onHoldEnd={holdEnd}
        onTap={handleTap}
      />

      {/* Skip feedback indicators */}
      {skipFeedback && (
        <div
          className={`absolute inset-y-0 ${skipFeedback === 'left' ? 'left-0' : 'right-0'} w-1/3 flex items-center ${skipFeedback === 'left' ? 'justify-start pl-8' : 'justify-end pr-8'} pointer-events-none`}
        >
          <div className="bg-white/20 rounded-full px-4 py-2 text-white text-sm font-medium backdrop-blur-sm animate-pulse">
            {skipFeedback === 'left' ? '⏪ 10s' : '10s ⏩'}
          </div>
        </div>
      )}

      {/* Hold speed indicator */}
      {holdActive && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
          <div className="bg-white/20 rounded-full px-5 py-2 text-white text-sm font-semibold backdrop-blur-sm">
            2× speed
          </div>
        </div>
      )}

      {/* HLS error overlay */}
      {hlsError && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/90">
          <div className="text-center px-8 space-y-4 max-w-sm">
            <p className="text-white font-semibold">Playback failed</p>
            <p className="text-slate-400 text-xs font-mono break-all">{hlsError}</p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => { setHlsError(null); if (videoRef.current) videoRef.current.src = stream.directUrl(item.id); }}
                className="px-4 py-2 text-sm bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg transition"
              >
                Try direct play
              </button>
              <button
                onClick={onBack}
                className="px-4 py-2 text-sm border border-[#2e2e2e] text-slate-300 hover:text-white rounded-lg transition"
              >
                Go back
              </button>
            </div>
          </div>
        </div>
      )}

      <PlayerControls
        playing={playing}
        currentTime={currentTime}
        duration={duration}
        volume={volume}
        muted={muted}
        fullscreen={fullscreen}
        playbackRate={playbackRate}
        visible={controlsVisible}
        title={item.title}
        onPlayPause={togglePlay}
        onSeek={seek}
        onVolume={setVol}
        onMute={toggleMute}
        onFullscreen={toggleFullscreen}
        onBack={onBack}
        onPlaybackRate={setRate}
      />
    </div>
  );
}
