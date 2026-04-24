# Relay — Build Prompt

Use this prompt to start a new session and scaffold the full Relay application from scratch.

---

## Prompt

Build a self-hosted media streaming application called **Relay**. This is a Jellyfin-like server with a YouTube-quality video player experience. Below is the complete specification.

---

### Stack

- **Backend:** ASP.NET Core .NET 10, Minimal APIs, in `relay-server/`
- **Frontend:** Next.js (App Router, TypeScript), in `relay-web/`
- **UI:** Tailwind CSS + shadcn/ui — dark mode only, violet as the brand/accent color. Use shadcn/ui components throughout; do not write a lot of custom CSS.
- **Database:** SQLite via EF Core — auto-migrate on startup, store at `relay.db` in the config directory
- **Auth:** JWT tokens, 30-day expiry, stored in `relay_cookie` httpOnly cookie and accepted as Bearer header
- **Transcoding:** FFmpeg — auto-detect encoder: NVENC (NVIDIA) → AMF (AMD) → libx264 (CPU). Override via `appsettings.json` key `Transcode:Encoder`
- **Streaming:** HLS (ffmpeg → `.m3u8` + `.ts` segments cached to `Transcode:CacheDir`) + direct play with HTTP range requests
- **Metadata:** TMDB API for movies and TV; also pull IMDB score and Rotten Tomatoes score
- **Subtitles:** External `.srt`/`.ass`/`.vtt` file support (matched by filename) + local faster-whisper for AI transcription (home media only)
- **Notifications:** Discord webhook
- **PWA:** `manifest.json` + service worker, installable on iOS and Android
- **Deployment:** Docker Compose, Linux host. No built-in reverse proxy — user uses Tailscale for external access.

---

### Library Types

**1. Movies**
- Flat folder of movie files
- TMDB metadata enabled by default

**2. TV Shows**
- Folder → Series → Season → Episode hierarchy
- TMDB metadata enabled by default

**3. Mixed**
- Root folder with two subfolders: one for movies, one for TV shows
- Each subfolder treated as its respective type
- Used for collections like anime that have both movies and series

**4. Home Media**
- Videos and photos combined in one library type
- Imported exactly as folder structure on disk — no hierarchy enforced
- TMDB metadata disabled by default (not applicable)
- Per-library toggle: enable Whisper AI transcription for videos
- Supports video: `.mp4`, `.mkv`, `.mov`, `.avi` and photos: `.jpg`, `.jpeg`, `.png`, `.heic`, `.webp`
- Slideshow mode per folder (auto-advance photos, used for TV display)

---

### Authentication & Accounts

**Profile Select Screen (home page when not logged in):**
- Show a grid of visible profiles (Jellyfin-style profile picker)
- Clicking a visible profile logs in; show password prompt if that profile has a password
- "Sign in to another profile" button at the bottom — clicking it shows a manual username + password form (for hidden profiles like admin)

**Account fields (admin-managed only, no self-registration):**
- Display name
- Avatar image
- Password (optional — if not set, clicking profile logs in immediately)
- `hidden` boolean — if true, profile is not shown on the select screen; requires manual sign-in
- Role: `Admin` or `Viewer`
- Per-library access: admin configures which libraries each account can see

**Admin capabilities:**
- Full CRUD on accounts
- Per-user library access toggle
- Library management (add, edit, delete, scan)
- All scheduled tasks
- Global settings (encoder, TMDB API key, Discord webhook URL, etc.)
- Task run history and logs

---

### Per-User Settings

- Default subtitle language (default: English)
- Default audio track language (default: English)
- Per-show audio/subtitle track memory (remember last chosen track per show)
- Playback quality preference: Auto / 1080p / 4K (user-selectable cap)
- Watchlist: personal queue of items to watch

---

### Library Settings (per library)

- Library name
- Library type (Movies / TV Shows / Mixed / Home Media)
- Root folder path (server filesystem)
- Metadata enabled toggle (default: on for Movies/TV/Mixed, off for Home Media)
- Metadata refresh interval (e.g. every 24h, 7 days, manual only)
- Whisper transcription toggle (Home Media libraries only)

---

### Video Player

**Controls:**
- Play/Pause
- Seek bar with trickplay thumbnail preview on hover/scrub
- Chapter markers on seek bar (if file has chapters)
- Volume control
- Fullscreen
- Picture-in-picture
- Playback speed selector: 0.5x, 0.75x, 1x, 1.25x, 1.5x, 2x
- Audio track selector (all tracks from the file)
- Subtitle track selector (embedded + external files, plus Off)

**Touch gestures:**
- Double-tap left: seek back 10s
- Double-tap right: seek forward 10s
- Hold screen: play at 2x speed while held; return to normal on release
- Single tap: toggle controls visibility

**Streaming:**
- Default: HLS adaptive bitrate via HLS.js
- Direct play if client supports the codec (detected via canPlayType)
- Auto-select between direct play and HLS

**Continue watching:**
- Save progress per user per item
- Resume from last position on next play
- Mark as watched / unwatched

---

### Photo Viewer

- Full-screen display
- Single tap: toggle top bar (filename, back button)
- Swipe left/right: navigate within folder
- Slideshow mode: configurable auto-advance interval

---

### Scheduled Tasks

**Library tasks:**
| Task | Description |
|---|---|
| Scan Media Library | Detect new/removed files, update database |
| Refresh Metadata | Re-pull TMDB data for libraries with metadata enabled |
| Generate Trickplay Images | Create seek bar preview sprite/thumbnails for all video items |
| Extract Chapter Images | Extract chapter thumbnail images from video files |
| Keyframe Extractor | Extract keyframes to improve seek accuracy |
| Whisper Transcription Queue | Process home media videos queued for AI subtitle generation (faster-whisper, runs locally) |

**Maintenance tasks:**
| Task | Description |
|---|---|
| Clean Transcode Cache | Delete old HLS segment files beyond configured age/size |
| Clean Log Directory | Prune old application log files |
| Clean Activity Log | Trim old user activity records from DB |
| Optimize Database | Run SQLite VACUUM and ANALYZE |
| User Data Cleanup | Remove orphaned watch progress and watchlist entries for deleted items |

**Task UI:**
- Each task: enable toggle, cron schedule input, "Run Now" button
- Task history: last run time, duration, status (success/failed), collapsible log output

---

### Discord Notifications

- Global webhook URL in admin settings
- Per-event enable toggles:
  - Library scan completed
  - New media item added to a library
  - Scheduled task failed
  - Whisper transcription completed
  - New user account created

---

### Transcoding Details

- NVENC → AMF → libx264 auto-detect via `ffmpeg -encoders`
- 4K support; HDR tone-mapping to SDR for clients that don't support HDR
- HLS segment cache in configurable directory
- Audio: AAC transcode if needed; passthrough where supported

---

### Subtitles

- External files: `.srt`, `.ass`, `.vtt` matched by filename alongside video
- Embedded subtitle track passthrough
- Bazarr-compatible: reads subtitle files Bazarr drops into the media folder
- Whisper: faster-whisper running locally, generates `.srt` alongside the source video file

---

### Setup Wizard

Shown on first launch when no admin account exists:
1. Create admin account (username + password, both required)
2. Add first library (name, type, root path)
3. Enter TMDB API key (can skip, add later in settings)

---

### Home Screen (when logged in)

- Continue Watching row (items with in-progress watch state)
- Recently Added row (newest items across all accessible libraries)
- Library grid (one card per library the user has access to)

---

### PWA

- `public/manifest.json`: name "Relay", short_name "Relay", display: standalone, background: dark, theme: violet
- `public/sw.js`: service worker caching app shell
- Registered in layout via `ServiceWorkerRegistrar` client component
- Installable on iOS ("Add to Home Screen") and Android

---

### Docker Compose

Produce a `docker-compose.yml` at the repo root with:
- `relay-server` container: port 5000, volumes for `/media` (read-only) and `/config` (db, logs, cache)
- `relay-web` container: port 3000, env `NEXT_PUBLIC_API_URL`
- `faster-whisper` sidecar container: exposes a local HTTP API for transcription requests
- `.env.example` file with all required environment variables documented

---

### Project Structure

```
relay/
├── relay-server/          # ASP.NET Core backend
│   ├── Domain/            # EF Core entities
│   ├── Data/              # DbContext, migrations
│   ├── Services/          # Business logic (scanner, transcoder, metadata, tasks, etc.)
│   ├── Endpoints/         # Minimal API route definitions
│   └── appsettings.json
├── relay-web/             # Next.js frontend
│   ├── app/               # App Router pages and layouts
│   ├── components/        # Shared UI components (use shadcn/ui)
│   ├── lib/               # API client, hooks, utilities
│   └── public/            # manifest.json, sw.js, icons
├── docker-compose.yml
├── .env.example
├── README.md
└── REQUIREMENTS.md
```

---

### Out of Scope

- Music or podcast support
- Disk usage monitoring (handled externally by Proxmox)
- User self-registration
- Multiple profiles per account
- Light mode
- Native mobile app
- External subtitle downloading (Bazarr handles this outside Relay)

---

Build this step by step, starting with the backend domain models and database schema, then the API endpoints, then the frontend. Ask before making any significant architectural decisions not covered by this spec.
