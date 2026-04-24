"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Hls from "hls.js";
import { api, type MediaDetail } from "@/lib/api";
import { useAuth } from "@/context/auth";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Play, Pause, Volume2, VolumeX, Maximize, Minimize,
  PictureInPicture2, SkipBack, SkipForward, ChevronLeft,
  Gauge, Subtitles, AudioLines,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// How long controls stay visible after last interaction (ms)
const CONTROLS_TIMEOUT = 3500;
// Save progress every N seconds of playback
const SAVE_INTERVAL = 10;

export default function WatchPage() {
  const { id } = useParams<{ id: string }>();
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const controlsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef(0);

  const [detail, setDetail] = useState<MediaDetail | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [buffered, setBuffered] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [isHolding, setIsHolding] = useState(false);
  const [seekFlash, setSeekFlash] = useState<"left" | "right" | null>(null);
  const [currentSubtitle, setCurrentSubtitle] = useState<string>("off");
  const [currentAudio, setCurrentAudio] = useState<number>(0);
  const [seekHover, setSeekHover] = useState<{ x: number; time: number } | null>(null);
  const seekBarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!authLoading && !user) { router.replace("/"); return; }
  }, [user, authLoading, router]);

  // Load media detail then set up the player
  useEffect(() => {
    api.media.item(Number(id)).then((data) => {
      setDetail(data);
      setupPlayer(data);
    }).catch(() => toast.error("Failed to load media."));

    return () => {
      hlsRef.current?.destroy();
      if (saveTimerRef.current) clearInterval(saveTimerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  function setupPlayer(data: MediaDetail) {
    const video = videoRef.current;
    if (!video) return;

    const startAt = data.progress?.positionSeconds ?? 0;

    // Try direct play first — if the browser can natively handle the codec, use it.
    // Otherwise fall back to HLS transcode. This is smart direct play.
    const directUrl = api.stream.directUrl(Number(id));
    const canDirect = video.canPlayType("video/mp4") !== "" || video.canPlayType("video/webm") !== "";

    if (canDirect && data.item.type !== "Episode") {
      video.src = directUrl;
    } else if (Hls.isSupported()) {
      // HLS.js takes over the video element and manages the segment playlist
      const hls = new Hls({ startPosition: startAt });
      hls.loadSource(api.stream.hlsUrl(Number(id)));
      hls.attachMedia(video);
      hlsRef.current = hls;
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      // Safari has native HLS support — just set the src directly
      video.src = api.stream.hlsUrl(Number(id));
    }

    if (startAt > 0) video.currentTime = startAt;

    // Restore last audio/subtitle preferences
    if (data.progress?.lastAudioLanguage) setCurrentAudio(0); // will refine once tracks load
  }

  // ── Playback event handlers ────────────────────────────────────────────────
  function onTimeUpdate() {
    const video = videoRef.current;
    if (!video) return;
    setCurrentTime(video.currentTime);
    if (video.buffered.length > 0)
      setBuffered(video.buffered.end(video.buffered.length - 1));
  }

  function onDurationChange() {
    if (videoRef.current) setDuration(videoRef.current.duration);
  }

  function onPlay() { setPlaying(true); }
  function onPause() { setPlaying(false); }

  function onEnded() {
    saveProgress(true);
    setPlaying(false);
  }

  // ── Progress saving ────────────────────────────────────────────────────────
  const saveProgress = useCallback((completed = false) => {
    const video = videoRef.current;
    if (!video || !detail) return;
    const pos = Math.floor(video.currentTime);
    if (pos === lastSavedRef.current && !completed) return;
    lastSavedRef.current = pos;
    api.media.saveProgress(Number(id), {
      positionSeconds: pos,
      isCompleted: completed || (duration > 0 && pos / duration > 0.9),
    }).catch(() => {});
  }, [detail, duration, id]);

  useEffect(() => {
    saveTimerRef.current = setInterval(() => saveProgress(), SAVE_INTERVAL * 1000);
    return () => { if (saveTimerRef.current) clearInterval(saveTimerRef.current); };
  }, [saveProgress]);

  // ── Controls visibility ────────────────────────────────────────────────────
  const resetControlsTimer = useCallback(() => {
    setShowControls(true);
    if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    controlsTimerRef.current = setTimeout(() => {
      if (playing) setShowControls(false);
    }, CONTROLS_TIMEOUT);
  }, [playing]);

  // ── Playback controls ──────────────────────────────────────────────────────
  function togglePlay() {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play(); else v.pause();
    resetControlsTimer();
  }

  function seek(seconds: number) {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = Math.max(0, Math.min(v.currentTime + seconds, duration));
  }

  function setPlaybackSpeed(s: number) {
    setSpeed(s);
    if (videoRef.current) videoRef.current.playbackRate = s;
  }

  function toggleMute() {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
  }

  function onVolumeChange(val: number | readonly number[]) {
    const v = videoRef.current;
    if (!v) return;
    const vol = Array.isArray(val) ? (val as number[])[0] : (val as number);
    v.volume = vol;
    setVolume(vol);
    setMuted(vol === 0);
  }

  function toggleFullscreen() {
    const el = containerRef.current;
    if (!el) return;
    if (!document.fullscreenElement) el.requestFullscreen();
    else document.exitFullscreen();
  }

  useEffect(() => {
    const handler = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  async function togglePiP() {
    const v = videoRef.current;
    if (!v) return;
    if (document.pictureInPictureElement) await document.exitPictureInPicture();
    else await v.requestPictureInPicture().catch(() => toast.error("PiP not supported."));
  }

  // ── Touch gesture layer ────────────────────────────────────────────────────
  // Double-tap detection: track last tap time per side
  const lastTapRef = useRef<{ time: number; side: "left" | "right" } | null>(null);

  function handleGestureTap(e: React.TouchEvent<HTMLDivElement>) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = e.changedTouches[0].clientX - rect.left;
    const side = x < rect.width / 2 ? "left" : "right";
    const now = Date.now();

    if (lastTapRef.current && lastTapRef.current.side === side && now - lastTapRef.current.time < 350) {
      // Double tap detected
      seek(side === "right" ? 10 : -10);
      setSeekFlash(side);
      setTimeout(() => setSeekFlash(null), 600);
      lastTapRef.current = null;
    } else {
      lastTapRef.current = { time: now, side };
      // Single tap after timeout → toggle controls
      setTimeout(() => {
        if (lastTapRef.current?.time === now) {
          resetControlsTimer();
          lastTapRef.current = null;
        }
      }, 350);
    }
  }

  // Hold to 2x speed
  function handleGesturePressStart() {
    holdTimerRef.current = setTimeout(() => {
      setIsHolding(true);
      if (videoRef.current) videoRef.current.playbackRate = 2;
    }, 400);
  }

  function handleGesturePressEnd() {
    if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    if (isHolding) {
      setIsHolding(false);
      if (videoRef.current) videoRef.current.playbackRate = speed;
    }
  }

  // ── Subtitle track switching ───────────────────────────────────────────────
  function applySubtitle(trackId: string | null) {
    if (trackId === null) return;
    setCurrentSubtitle(trackId);
    const video = videoRef.current;
    if (!video) return;
    // Disable all text tracks first
    for (let i = 0; i < video.textTracks.length; i++)
      video.textTracks[i].mode = "disabled";
    if (trackId !== "off") {
      const idx = parseInt(trackId);
      if (video.textTracks[idx]) video.textTracks[idx].mode = "showing";
    }
  }

  // ── Seek bar hover (trickplay thumbnail preview) ───────────────────────────
  function handleSeekBarHover(e: React.MouseEvent<HTMLDivElement>) {
    if (!duration || !seekBarRef.current) return;
    const rect = seekBarRef.current.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setSeekHover({ x: e.clientX - rect.left, time: pct * duration });
  }

  // ── Format helpers ─────────────────────────────────────────────────────────
  function fmt(sec: number) {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = Math.floor(sec % 60);
    if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    return `${m}:${String(s).padStart(2, "0")}`;
  }

  const item = detail?.item;

  return (
    <div
      ref={containerRef}
      className="relative bg-black w-full h-screen flex items-center justify-center overflow-hidden"
      onMouseMove={resetControlsTimer}
    >
      {/* Video element */}
      <video
        ref={videoRef}
        className="w-full h-full object-contain"
        onTimeUpdate={onTimeUpdate}
        onDurationChange={onDurationChange}
        onPlay={onPlay}
        onPause={onPause}
        onEnded={onEnded}
        playsInline
      />

      {/* Touch gesture layer — sits on top of video, below controls */}
      <div
        className="absolute inset-0 z-10"
        onTouchStart={handleGesturePressStart}
        onTouchEnd={(e) => { handleGesturePressEnd(); handleGestureTap(e); }}
      />

      {/* Hold speed indicator */}
      {isHolding && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 bg-black/70 px-4 py-2 rounded-full flex items-center gap-2">
          <Gauge className="h-4 w-4 text-white" />
          <span className="text-white text-sm font-medium">2× Speed</span>
        </div>
      )}

      {/* Seek flash indicators */}
      {seekFlash && (
        <div className={cn(
          "absolute top-1/2 -translate-y-1/2 z-30 pointer-events-none",
          seekFlash === "left" ? "left-8" : "right-8"
        )}>
          <div className="bg-white/20 rounded-full p-4">
            {seekFlash === "left"
              ? <SkipBack className="h-8 w-8 text-white fill-white" />
              : <SkipForward className="h-8 w-8 text-white fill-white" />}
          </div>
        </div>
      )}

      {/* Controls overlay */}
      <div className={cn(
        "absolute inset-0 z-20 flex flex-col justify-between transition-opacity duration-300",
        showControls ? "opacity-100" : "opacity-0 pointer-events-none"
      )}>
        {/* Top bar */}
        <div className="px-4 pt-4 pb-8 bg-gradient-to-b from-black/70 to-transparent flex items-center gap-3">
          <Button variant="ghost" size="icon" className="text-white hover:bg-white/20"
            onClick={() => { saveProgress(); router.back(); }}>
            <ChevronLeft className="h-6 w-6" />
          </Button>
          <div className="flex-1 min-w-0">
            <p className="text-white font-semibold truncate">{item?.title}</p>
          </div>
        </div>

        {/* Center play/pause (mouse only) */}
        <button
          className="absolute inset-0 w-full h-full hidden sm:flex items-center justify-center focus:outline-none"
          onClick={togglePlay}
        />

        {/* Bottom controls */}
        <div className="px-4 pb-4 pt-12 bg-gradient-to-t from-black/80 to-transparent space-y-2">
          {/* Seek bar + trickplay preview */}
          <div
            ref={seekBarRef}
            className="relative w-full group"
            onMouseMove={handleSeekBarHover}
            onMouseLeave={() => setSeekHover(null)}
          >
            {/* Trickplay thumbnail preview */}
            {seekHover && detail?.item.trickplayGenerated && (
              <div
                className="absolute bottom-6 pointer-events-none z-40 flex flex-col items-center"
                style={{
                  left: Math.max(80, Math.min(seekHover.x, (seekBarRef.current?.offsetWidth ?? 0) - 80)),
                  transform: "translateX(-50%)",
                }}
              >
                <img
                  src={api.stream.trickplayUrl(Number(id), `${Math.max(1, Math.floor(seekHover.time / 10) + 1)}.jpg`)}
                  alt=""
                  className="w-40 h-22.5 object-cover rounded shadow-lg border border-white/20"
                  width={160}
                  height={90}
                />
                <span className="text-white text-xs mt-1 bg-black/60 px-1 rounded">{fmt(seekHover.time)}</span>
              </div>
            )}
            {/* Buffered track */}
            <div className="absolute top-1/2 -translate-y-1/2 left-0 h-1 rounded-full bg-white/20 pointer-events-none"
              style={{ width: duration ? `${(buffered / duration) * 100}%` : "0%" }} />
            <Slider
              min={0} max={duration || 1} step={1} value={[currentTime]}
              onValueChange={(v) => { if (videoRef.current) videoRef.current.currentTime = Array.isArray(v) ? v[0] : v; }}
              className="w-full"
            />
          </div>

          {/* Time + controls row */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Play/Pause */}
            <Button variant="ghost" size="icon" className="text-white hover:bg-white/20 shrink-0" onClick={togglePlay}>
              {playing ? <Pause className="h-6 w-6 fill-white" /> : <Play className="h-6 w-6 fill-white" />}
            </Button>

            {/* Skip buttons */}
            <Button variant="ghost" size="icon" className="text-white hover:bg-white/20 hidden sm:flex shrink-0" onClick={() => seek(-10)}>
              <SkipBack className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" className="text-white hover:bg-white/20 hidden sm:flex shrink-0" onClick={() => seek(10)}>
              <SkipForward className="h-5 w-5" />
            </Button>

            {/* Volume */}
            <Button variant="ghost" size="icon" className="text-white hover:bg-white/20 shrink-0" onClick={toggleMute}>
              {muted || volume === 0 ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
            </Button>
            <div className="hidden sm:block w-24">
              <Slider min={0} max={1} step={0.05} value={[muted ? 0 : volume]} onValueChange={onVolumeChange} />
            </div>

            {/* Time */}
            <span className="text-white text-xs tabular-nums shrink-0 ml-1">
              {fmt(currentTime)} / {fmt(duration)}
            </span>

            <div className="flex-1" />

            {/* Speed */}
            <Select value={String(speed)} onValueChange={(v) => { if (v !== null) setPlaybackSpeed(Number(v)); }}>
              <SelectTrigger className="h-8 w-16 bg-transparent border-white/30 text-white text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[0.5, 0.75, 1, 1.25, 1.5, 2].map((s) => (
                  <SelectItem key={s} value={String(s)}>{s}×</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Subtitle track */}
            {item && item.subtitles.length > 0 && (
              <Select value={currentSubtitle} onValueChange={applySubtitle}>
                <SelectTrigger className="h-8 w-8 bg-transparent border-white/30 text-white p-0 justify-center">
                  <Subtitles className="h-4 w-4" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="off">Off</SelectItem>
                  {item.subtitles.map((sub, i) => (
                    <SelectItem key={sub.id} value={String(i)}>{sub.label || sub.language}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Audio track */}
            {item && item.audioTracks.length > 1 && (
              <Select value={String(currentAudio)} onValueChange={(v) => {
                if (v === null) return;
                const idx = Number(v);
                setCurrentAudio(idx);
                if (hlsRef.current) hlsRef.current.audioTrack = idx;
              }}>
                <SelectTrigger className="h-8 w-8 bg-transparent border-white/30 text-white p-0 justify-center">
                  <AudioLines className="h-4 w-4" />
                </SelectTrigger>
                <SelectContent>
                  {item.audioTracks.map((track, i) => (
                    <SelectItem key={track.id} value={String(i)}>
                      {track.label || track.language} ({track.codec})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* PiP */}
            <Button variant="ghost" size="icon" className="text-white hover:bg-white/20 hidden sm:flex shrink-0" onClick={togglePiP}>
              <PictureInPicture2 className="h-4 w-4" />
            </Button>

            {/* Fullscreen */}
            <Button variant="ghost" size="icon" className="text-white hover:bg-white/20 shrink-0" onClick={toggleFullscreen}>
              {fullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
