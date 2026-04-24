# Relay

A self-hosted media streaming server for Blu-ray rips, home video, and photos. Built to feel like Jellyfin but play like YouTube.

## Features

- **Multiple library types** — Movies, TV Shows, Mixed (movies + shows in subfolders, e.g. anime), and Home Media (video + photos in folder structure)
- **4K & HDR support** — with hardware-accelerated transcoding via NVENC (NVIDIA), AMF (AMD), or CPU fallback
- **YouTube-style player** — double-tap to seek, hold for 2x speed, playback speed control, picture-in-picture, HLS adaptive streaming
- **Profile-based accounts** — admin-managed accounts with optional passwords; hidden profiles require manual sign-in
- **Per-library metadata** — automatic TMDB metadata with IMDB/Rotten Tomatoes scores; disabled by default for Home Media libraries
- **Subtitle support** — external `.srt`/`.ass` files + local Whisper AI transcription for home video (per-library toggle)
- **Audio track switching** — choose between multiple audio tracks in-player
- **Watchlist** — per-user watchlist queue
- **Continue watching** — per-user watch progress synced across devices
- **Discord notifications** — configurable webhook alerts for library scans, new media, and task events
- **Scheduled tasks** — library scans, metadata refresh, trickplay image generation, Whisper transcription queue, cache cleanup, and more
- **PWA** — installable on iOS and Android from the browser; works as a home screen app
- **Dark mode, violet accent** — built with Tailwind CSS + shadcn/ui

## Deployment

Runs as Docker containers, designed for a Linux host (Proxmox VM). External access via Tailscale.

```
docker compose up -d
```

## Stack

| Layer | Technology |
|---|---|
| Backend | ASP.NET Core (.NET 10), Minimal APIs |
| Frontend | Next.js (App Router, TypeScript) |
| UI | Tailwind CSS + shadcn/ui |
| Database | SQLite via EF Core |
| Auth | JWT (cookie + bearer), 30-day expiry |
| Transcoding | FFmpeg — NVENC → AMF → libx264 auto-detect |
| Streaming | HLS (segmented) + direct play with range requests |
| Metadata | TMDB API + IMDB/RT scores |
| Subtitles | External file support + local Whisper (faster-whisper) |
| Notifications | Discord webhook |
| PWA | Web App Manifest + Service Worker |

## Setup

On first run, a setup wizard walks through creating the admin account and adding your first libraries.
