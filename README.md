# Relay

A self-hosted media streaming server for movies, TV shows, anime, home videos, and photos.
Mobile-first PWA with gesture controls and hardware-accelerated transcoding.

## Stack

| Layer | Technology |
|---|---|
| Backend | ASP.NET Core (.NET 10), minimal APIs |
| Database | SQLite via EF Core (auto-migrated on startup) |
| Auth | JWT (cookie + Bearer + query-string token for HLS segments) |
| Transcoding | FFmpeg — auto-detects AMF → NVENC → libx264 fallback |
| Frontend | Next.js 16 (App Router, TypeScript, Tailwind CSS) |
| Streaming | HLS via hls.js, direct play with range requests |
| PWA | Web manifest + service worker (iOS / Android "Add to Home Screen") |

---

## Getting started

### Prerequisites

- [.NET 10 SDK](https://dotnet.microsoft.com/download)
- [Node.js 20+](https://nodejs.org/)
- [FFmpeg](https://ffmpeg.org/download.html) — on your `PATH`, or installed to `%USERPROFILE%\ffmpeg\bin\` on Windows

### Development

**Terminal 1 — backend:**
```bash
cd relay-server
dotnet run
# API → http://localhost:5000
```

**Terminal 2 — frontend:**
```bash
cd relay-web
npm install
npm run dev
# UI → http://localhost:3000
```

Open `http://localhost:3000`. On first run the setup wizard walks you through creating an admin account and adding your first libraries.

### Production (Linux)

```bash
# Backend
cd relay-server
dotnet publish -c Release -o /opt/relay/server
ASPNETCORE_ENVIRONMENT=Production dotnet /opt/relay/server/Relay.Server.dll

# Frontend
cd relay-web
npm run build
npm start   # or proxy via nginx / Caddy on port 3001
```

Set `NEXT_PUBLIC_API_URL` in `relay-web/.env` to the backend address if the two services run on different hosts/ports.

---

## Configuration

**`relay-server/appsettings.json`**

```json
{
  "Jwt": {
    "Secret": "replace-with-a-long-random-secret-at-least-32-chars"
  },
  "Transcode": {
    "CacheDir": "",
    "Encoder":  "auto"
  },
  "Metadata": {
    "TMDbApiKey": ""
  },
  "Urls": "http://0.0.0.0:5000"
}
```

| Key | Description |
|---|---|
| `Jwt.Secret` | Signing secret for JWT tokens — must be ≥ 32 characters |
| `Transcode.CacheDir` | Where HLS segments are cached. Empty = `relay-transcode/` next to the server binary |
| `Transcode.Encoder` | `auto` (default) \| `nvenc` \| `amd` \| `cpu` |
| `Metadata.TMDbApiKey` | Free key from [themoviedb.org](https://www.themoviedb.org/settings/api) — enables movie/TV artwork and descriptions |

Copy `appsettings.json` to `appsettings.Development.json` for local overrides (git-ignored).

---

## Library types

| Type | What it holds |
|---|---|
| Movies | Flat folder of movie files |
| Shows | Series → Season folders → episode files |
| Mixed | Any combination — presents top-level subfolders as categories |
| Home Videos | Video files, no metadata fetching |
| Photos | Image files |

### Folder structure examples

**Movies**
```
/media/movies/
  Dune Part Two (2024).mkv
  The Substance.mp4
```

**Shows / Anime (any depth)**
```
/media/anime/
  Naruto (2002)/
    Season 1/
      Naruto - S01E01 - Enter Naruto Uzumaki.mkv
```

**Mixed** — Relay detects top-level subfolders automatically:
```
/media/
  movies/   ← shown as a folder tile
  shows/    ← shown as a folder tile
```

---

## Metadata

Relay can fetch titles, artwork, and descriptions automatically:

- **TMDb** — movies and TV shows (requires a free API key)
- **AniList** — anime (no API key required)
- **None** — disable for Home Videos / Photos

Set the provider per-library in **Admin → Libraries**. The "Fetch Metadata" scheduled task runs every 24 hours and can also be triggered manually.

---

## Admin dashboard

Accessible at `/admin` (admin accounts only). Provides:

- Server stats (library, series, movie, episode, and user counts)
- **Scheduled tasks** — Scan Libraries, Fetch Metadata, Clean Transcode Cache — with last-run times and manual trigger buttons
- Per-library metadata provider selection

---

## Player

### Gestures (mobile)

| Gesture | Action |
|---|---|
| Double-tap left | Rewind 10 s |
| Double-tap right | Skip forward 10 s |
| Hold anywhere | 2× speed while held |
| Single tap | Toggle controls |

### Controls

- Seek bar with hover-expand
- Volume slider (persisted across sessions)
- Playback speed menu (0.5× – 2×, click to open)
- Fullscreen toggle
- Falls back to direct play if HLS fails

---

## PWA / Mobile

On **iOS Safari**: Share → Add to Home Screen  
On **Android Chrome**: install banner or ⋮ → Add to Home Screen

The app runs full-screen with no browser chrome and works on the local network without an internet connection (after first load).

---

## Roadmap

- [ ] Subtitle support (embedded tracks + external `.srt` / `.ass`)
- [ ] AI subtitle transcription via Whisper
- [ ] TVDB metadata provider
- [ ] Chromecast / AirPlay support
- [ ] Watch party (synchronized playback)
- [ ] Per-user playback history and continue-watching across devices
