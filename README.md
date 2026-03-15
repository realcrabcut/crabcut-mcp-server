# @crabcut/mcp-server

Turn YouTube videos into short clips — from Claude, Cursor, or any AI assistant that supports MCP.

Give it a YouTube link. It finds the best moments, reframes for vertical video (9:16), adds subtitles, and returns download-ready clips.

[![smithery badge](https://smithery.ai/badge/crabcut/crabcut-mcp-server)](https://smithery.ai/servers/crabcut/crabcut-mcp-server) [![CrabCut MCP server](https://glama.ai/mcp/servers/realcrabcut/crabcut-mcp-server/badges/card.svg)](https://glama.ai/mcp/servers/realcrabcut/crabcut-mcp-server)

## Quick Start

1. Get an API key at [app.crabcut.ai/developers](https://app.crabcut.ai/developers)
2. Run:

```bash
CRABCUT_API_KEY=sk_live_... npx @crabcut/mcp-server
```

## Setup

### Claude Desktop / Cursor

Add to your config file — `claude_desktop_config.json` for Claude, `.cursor/mcp.json` for Cursor:

```json
{
  "mcpServers": {
    "crabcut": {
      "command": "npx",
      "args": ["@crabcut/mcp-server"],
      "env": {
        "CRABCUT_API_KEY": "sk_live_..."
      }
    }
  }
}
```

### Cursor Directory

[Install in Cursor](https://cursor.directory/plugins/mcp-crabcut)

### Smithery

```bash
npx @smithery/cli mcp add crabcut/crabcut-mcp-server
```

### Remote (Streamable HTTP)

For n8n, custom integrations, or any client that supports remote MCP:

- **Endpoint:** `https://mcp.crabcut.ai/mcp`
- **Auth:** `Authorization: Bearer sk_live_...`
- **Transport:** Streamable HTTP (POST)

## Tools

| Tool | What it does |
|---|---|
| `generate_clips` | Start clip generation from a YouTube URL. Returns a `project_id` right away. |
| `get_project_status` | Check progress and get clips when ready. Clips are sorted by score (best first). |
| `list_projects` | List your projects with status and clip counts. |
| `get_clip` | Get full details for a single clip. |
| `check_usage` | See your plan, remaining credits, and usage. |

## How It Works

1. Call `generate_clips` with a YouTube URL
2. Get back a `project_id` immediately
3. Poll `get_project_status` every 10–15 seconds (or pass a `callback_url` for webhook)
4. When done, clips are sorted by score (best first), each with a `download_url`

### Statuses

**Project:** `pending` → `processing` → `completed` (or `completed_no_clips` / `failed`)

**Processing steps:** `queued` → `DOWNLOADING_VIDEO` → `EXTRACTING_AUDIO` → `TRANSCRIBING` → `DETECTING_HIGHLIGHTS` → `CUTTING_CLIPS` → `EXPORTING_CLIPS` → `done`

**Clips:** `pending` → `exporting` → `completed` (or `failed`). The `download_url` is available when `clip_status` is `completed`.

## API Reference

### `generate_clips`

Start clip generation from a YouTube video.

| Field | Type | Required | Description |
|---|---|---|---|
| `url` | string | Yes | Full YouTube video URL |
| `start_time` | number | No | Start time in seconds (to process only a segment) |
| `end_time` | number | No | End time in seconds (to process only a segment) |
| `callback_url` | string | No | Webhook URL to receive results when done |

```json
{
  "project_id": "43dbe622-8ac6-4579-9625-0ad7f0f9db0b",
  "status": "processing",
  "poll_url": "/api/v1/projects/43dbe622-8ac6-4579-9625-0ad7f0f9db0b",
  "estimated_minutes": 5,
  "message": "Processing started. Poll with get_project_status every 10-15 seconds until status is 'completed'."
}
```

### `get_project_status`

Check progress and get clips.

| Field | Type | Required | Description |
|---|---|---|---|
| `project_id` | string | Yes | The project ID from `generate_clips` |

```json
{
  "id": "43dbe622-...",
  "name": "Video Title",
  "status": "completed",
  "step": "done",
  "error": null,
  "expected_clips": 9,
  "duration": 639,
  "created_at": "2026-03-15T02:21:46.226Z",
  "clips": [
    {
      "id": "32538b9c-...",
      "title": "One Dating Theory Leads to Chaos",
      "duration": 41.83,
      "score": 90,
      "reason": "Sharp universal joke that hooks instantly with strong reactions.",
      "clip_status": "completed",
      "download_url": "https://cdn.crabcut.ai/exports/premium/.../clip-32538b9c-....mp4",
      "quality": "1080p",
      "thumbnail_url": "https://cdn.crabcut.ai/exports/premium/.../clip-32538b9c-...-thumb.jpg",
      "created_at": "2026-03-15T02:29:10.954Z",
      "updated_at": "2026-03-15T02:30:43.907Z"
    }
  ]
}
```

Clips are sorted by `score` (highest first).

### `list_projects`

| Field | Type | Required | Description |
|---|---|---|---|
| `limit` | number | No | Max projects to return. Default 20, max 100. |
| `status` | string | No | Filter: `pending`, `processing`, `completed`, `completed_no_clips`, `failed` |

```json
{
  "projects": [
    {
      "id": "43dbe622-...",
      "name": "Video Title",
      "status": "completed",
      "step": "done",
      "expected_clips": 9,
      "clips_count": 8,
      "duration": 639,
      "created_at": "2026-03-15T02:21:46.226Z"
    }
  ],
  "total": 1,
  "limit": 20,
  "offset": 0
}
```

### `get_clip`

| Field | Type | Required | Description |
|---|---|---|---|
| `clip_id` | string | Yes | The clip ID from a project's clips array |

```json
{
  "id": "32538b9c-...",
  "project_id": "43dbe622-...",
  "title": "One Dating Theory Leads to Chaos",
  "duration": 41.83,
  "score": 90,
  "reason": "Sharp universal joke that hooks instantly.",
  "export_status": "completed",
  "export_quality": "1080p",
  "is_exported": true,
  "video_url": "https://cdn.crabcut.ai/...",
  "video_url_720p": "https://cdn.crabcut.ai/...",
  "video_url_1080p": "https://cdn.crabcut.ai/...",
  "thumbnail_url": "https://cdn.crabcut.ai/...",
  "created_at": "2026-03-15T02:29:10.954Z",
  "updated_at": "2026-03-15T02:30:43.907Z"
}
```

### `check_usage`

No input required.

```json
{
  "plan": "pro",
  "credits_remaining": 450,
  "credits_total": 500,
  "period_start": "2026-03-01T00:00:00.000Z",
  "period_end": "2026-04-01T00:00:00.000Z"
}
```

## Errors

| HTTP Status | Error | What to do |
|---|---|---|
| 400 | Invalid YouTube URL | Check the URL format |
| 401 | Unauthorized | Check your API key |
| 402 | Insufficient credits | Buy more credits or use a shorter video |
| 429 | Rate limit exceeded | Wait and try again |
| 500 | Internal server error | Try again later |

## Webhooks

Pass a `callback_url` when calling `generate_clips` to receive a POST when all clips are ready.

**Completed:**

```json
{
  "event": "project.completed",
  "project_id": "43dbe622-...",
  "status": "completed",
  "source_url": "https://www.youtube.com/watch?v=H51iLa1leOU",
  "clips": [
    {
      "id": "32538b9c-...",
      "title": "One Dating Theory Leads to Chaos",
      "duration": 41.83,
      "score": 90,
      "download_url": "https://cdn.crabcut.ai/exports/premium/.../clip-32538b9c-....mp4",
      "thumbnail_url": "https://cdn.crabcut.ai/exports/premium/.../clip-32538b9c-...-thumb.jpg",
      "quality": "1080p"
    }
  ]
}
```

**Failed:**

```json
{
  "event": "project.failed",
  "project_id": "43dbe622-...",
  "status": "failed",
  "error": "YouTube video is unavailable",
  "clips": []
}
```

Clips are sorted by score (highest first). We retry up to 3 times if your server doesn't respond.

**Signature verification (optional):** Each callback includes an `X-Crabcut-Signature` header. Compute `HMAC-SHA256` of the request body using `SHA-256(your_api_key)` as the signing key. Compare with the header value (`sha256=<hex>`).

## Using with n8n

**Option A — Webhook (recommended):**

1. Create a workflow with a **Webhook** trigger node. Copy its URL.
2. Add an **HTTP Request** node: `POST https://api.crabcut.ai/api/v1/clips/generate` with Header Auth (`Authorization: Bearer sk_live_...`) and body:
   ```json
   {
     "url": "https://www.youtube.com/watch?v=...",
     "callback_url": "https://your-n8n.com/webhook/abc123"
   }
   ```
3. When clips are ready, the Webhook node receives the payload.
4. Best clip: `{{ $json.clips[0].download_url }}`

**Option B — Polling loop:**

1. `POST` to generate clips (same as above, without `callback_url`).
2. **Wait** 15 seconds → **GET** `https://api.crabcut.ai/api/v1/projects/{{ $json.project_id }}` → **IF** status is not `completed`, loop back to Wait.

## REST API

For direct HTTP calls without MCP:

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/v1/clips/generate` | Start clip generation |
| `GET` | `/api/v1/projects/:id` | Get project status and clips |
| `GET` | `/api/v1/projects` | List projects |
| `GET` | `/api/v1/clips/:id` | Get single clip details |
| `GET` | `/api/v1/account/usage` | Check credits and plan |

Base URL: `https://api.crabcut.ai` — All endpoints require `Authorization: Bearer sk_live_...`

## Environment Variables

| Variable | Required | Default |
|---|---|---|
| `CRABCUT_API_KEY` | Yes | — |
| `CRABCUT_API_URL` | No | `https://api.crabcut.ai` |

## Links

- Website: [crabcut.ai](https://crabcut.ai)
- API key: [app.crabcut.ai/developers](https://app.crabcut.ai/developers)
- Pricing: [crabcut.ai/pricing](https://crabcut.ai/pricing)

## License

MIT
