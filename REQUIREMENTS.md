# Relay — Requirements

## Project Overview

Relay is a self-hosted media streaming server running as Docker containers on a Linux VM (Proxmox). External access is handled via Tailscale — no built-in reverse proxy needed. The UI is a PWA installable on iOS/Android.

---

## Tech Stack

| Layer | Choice | Notes |
|---|---|---|
| Backend | ASP.NET Core .NET 10, Minimal APIs | `relay-server/` |
| Frontend | Next.js (App Router, TypeScript) | `relay-web/` |
| UI Framework | Tailwind CSS + shadcn/ui | Dark mode only, violet accent color |
| Database | SQLite via EF Core (auto-migrate on startup) | `relay.db` |
| Auth | JWT, 30-day expiry, stored in `relay_cookie` cookie + Bearer header | |
| Transcoding | FFmpeg — auto-detect NVENC → AMF → libx264; override via appsettings | |
| Streaming | HLS (ffmpeg → .m3u8 + .ts segments, cached) + direct play (range requests) | |
| Metadata | TMDB API (movies/TV), IMDB + Rotten Tomatoes scores | |
| Subtitles | External .srt/.ass + local faster-whisper | |
| Notifications | Discord webhook | |
| PWA | manifest.json + service worker | |
| Deployment | Docker Compose, Linux host | |

---

## Library Types

### 1. Movies
- Single-level folder of movie files
- TMDB metadata enabled by default
- Posters, descriptions, IMDB score, RT score

### 2. TV Shows
- Folder → Series → Season → Episode hierarchy
- TMDB metadata enabled by default
- Episode thumbnails, descriptions, air dates

### 3. Mixed (Movies + TV)
- Root folder contains two subfolders: one for movies, one for shows
- Used for libraries like Anime where both types coexist
- Each subfolder treated as its respective type

### 4. Home Media
- Videos and photos in the same library type
- Imported in the folder structure as-is (no hierarchy enforced)
- TMDB metadata disabled by default (not applicable)
- Whisper AI transcription toggle per library
- Slideshow mode per folder (for displaying photos on a TV)
- Supports: `.mp4`, `.mkv`, `.mov`, `.avi`, `.jpg`, `.jpeg`, `.png`, `.heic`, `.webp`

---

## Authentication & Accounts

### Profile Select Screen
- On first visit, show a grid of visible profiles (Jellyfin-style)
- Clicking a profile logs in; if password-protected, prompt for password
- "Sign in to another profile" button reveals a manual username + password form for hidden profiles

### Account Properties (admin-managed)
- Display name
- Avatar/profile image
- Password (optional)
- Hidden from profile select screen (boolean) — hidden profiles require manual sign-in
- Per-library access permissions (can see / cannot see per library)
- Role: Admin or Viewer

### Admin Capabilities
- Create, edit, delete accounts
- Toggle library access per user
- Manage libraries (add, edit, delete, trigger scan)
- Access all scheduled tasks
- Configure global settings (encoder, TMDB API key, Discord webhook, etc.)
- View task run history and logs

---

## Per-User Settings

| Setting | Details |
|---|---|
| Default subtitle language | Default: English |
| Default audio track language | Default: English |
| Per-show audio/subtitle language memory | Remembers last chosen track per show |
| Playback quality preference | User-selectable cap (e.g. 1080p, 4K, Auto) |
| Watchlist | Add/remove items; personal queue |

---

## Library Settings (per library)

| Setting | Details |
|---|---|
| Library name | Display name |
| Library type | Movies / TV Shows / Mixed / Home Media |
| Root folder path | Server filesystem path |
| Metadata enabled | Toggle; off by default for Home Media |
| Metadata source | TMDB (movies/TV only) |
| Metadata refresh interval | Configurable (e.g. every 24h, 7 days, manual only) |
| Whisper transcription | Toggle; Home Media libraries only |
| Subtitle language preference | Which language subs to prefer when scanning |

---

## Metadata

- **Source:** TMDB for movies and TV shows
- **Pulled fields:** Title, overview, poster, backdrop, genres, release year, runtime, cast (top-billed), IMDB score, Rotten Tomatoes score
- **Refresh:** Scheduled task, configurable interval per library
- **Home Media:** No external metadata; filename used as title, folder as album/event name

---

## Video Player

### Transport Controls
- Play / Pause
- Seek bar with trickplay thumbnail preview on hover/scrub
- Chapter markers on seek bar (if chapters present in file)
- Volume control
- Fullscreen toggle
- Picture-in-picture
- Playback speed selector (0.5x, 0.75x, 1x, 1.25x, 1.5x, 2x)

### Gesture Layer (touch)
- Double-tap left: seek back 10s
- Double-tap right: seek forward 10s
- Hold screen: play at 2x speed while held, return to normal on release
- Single tap: toggle controls visibility

### Track Selection (in-player)
- Audio track switcher (lists all tracks from file)
- Subtitle track switcher (lists embedded + external subtitle files)
- "Off" option for subtitles

### Streaming
- HLS adaptive bitrate as default
- Direct play if client codec is compatible (no transcode needed)
- Auto-select based on client capability

### Continue Watching
- Save progress per user per item
- Resume from last position
- Mark as watched / unwatched

---

## Photo Viewer

- Full-screen photo display
- Tap to toggle top bar (filename, back button)
- Swipe left/right to navigate within folder
- Slideshow mode: auto-advance with configurable interval, for TV display use

---

## Scheduled Tasks

### Library
| Task | Description |
|---|---|
| Scan Media Library | Detect new/removed files, update DB |
| Refresh Metadata | Re-pull TMDB data for libraries with metadata enabled |
| Generate Trickplay Images | Create seek bar preview thumbnails for all video items |
| Extract Chapter Images | Extract chapter thumbnail images from video files |
| Keyframe Extractor | Extract keyframes to improve seek accuracy |
| Whisper Transcription Queue | Process home media videos queued for AI subtitle generation |

### Maintenance
| Task | Description |
|---|---|
| Clean Transcode Cache | Delete old HLS segment files beyond cache size/age limit |
| Clean Log Directory | Prune old application logs |
| Clean Activity Log | Trim old user activity records |
| Optimize Database | Run SQLite VACUUM / ANALYZE |
| User Data Cleanup | Remove orphaned watch progress, watchlist entries for deleted items |

### Scheduling
- Each task has: enable toggle, cron-style schedule, manual "Run Now" button
- Task history: last run time, duration, status (success / failed), log output

---

## Discord Notifications

- Global Discord webhook URL in admin settings
- Per-event toggles:
  - Library scan completed
  - New media item added
  - Scheduled task failed
  - Whisper transcription completed
  - New user account created

---

## Transcoding

- Auto-detect encoder priority: NVENC (NVIDIA) → AMF (AMD) → libx264 (CPU)
- Override via `appsettings.json` (`Transcode:Encoder`)
- 4K and HDR support (HDR tone-mapping for clients that don't support HDR)
- HLS segment cache directory configurable (`Transcode:CacheDir`)
- Audio: transcode to AAC if needed; passthrough where supported

---

## Subtitles

- External file support: `.srt`, `.ass`, `.vtt` — matched by filename alongside video file
- Embedded subtitle track passthrough
- Bazarr-compatible: Relay reads subtitle files Bazarr drops into the media folder
- Whisper (faster-whisper, runs locally): queued per home media video, generates `.srt` alongside the file

---

## PWA

- `manifest.json` with app name, icons, display: standalone, theme: dark
- Service worker for offline shell caching
- Installable on iOS ("Add to Home Screen") and Android
- App icon: Relay branding, violet accent

---

## Setup Wizard

On first launch (no admin account exists):
1. Create admin account (username + password, required)
2. Add first library (name, type, path)
3. Enter TMDB API key (optional, can skip and add later in settings)

---

## Docker Deployment

```yaml
# docker-compose.yml (example)
services:
  relay-server:
    image: relay-server
    ports:
      - "5000:5000"
    volumes:
      - /path/to/media:/media
      - /path/to/config:/config
    environment:
      - ConnectionStrings__Default=Data Source=/config/relay.db
      - Transcode__CacheDir=/config/transcode-cache

  relay-web:
    image: relay-web
    ports:
      - "3000:3000"
    environment:
      - NEXT_PUBLIC_API_URL=http://relay-server:5000
```

- Linux host (Proxmox VM running Docker)
- External access via Tailscale (no built-in tunnel/proxy needed)
- Media volumes mounted read-only on the server container
- Config volume for DB, logs, transcode cache

---

## Out of Scope

- Music / podcast support
- Disk usage monitoring (handled by Proxmox)
- User self-registration
- Multiple profiles per account (one account = one profile)
- Light mode
- Mobile native app (PWA only)
- External subtitle download (Bazarr handles this externally)
