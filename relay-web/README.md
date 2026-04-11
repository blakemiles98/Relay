# relay-web

Next.js 16 frontend for Relay. See the [root README](../README.md) for full setup and configuration instructions.

## Development

```bash
npm install
npm run dev   # http://localhost:3000
```

Requires the backend (`relay-server`) to be running at `http://localhost:5000`.

## Environment

| Variable | Default | Description |
|---|---|---|
| `NEXT_BACKEND_URL` | `http://localhost:5000` | Backend URL used by the Next.js proxy (server-side only) |

Create a `.env.local` file (git-ignored) to override:

```env
NEXT_BACKEND_URL=http://192.168.1.10:5000
```

## Build

```bash
npm run build
npm start
```
