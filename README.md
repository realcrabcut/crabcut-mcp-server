# @crabcut/mcp-server

Turn YouTube videos into short clips -- from Claude, Cursor, or any AI assistant that supports MCP.

You give it a YouTube link. It finds the best moments, reframes them for vertical video (9:16), adds subtitles, and gives you download links. All from a chat or automation workflow.

[![CrabCut MCP server](https://glama.ai/mcp/servers/realcrabcut/crabcut-mcp-server/badges/card.svg)](https://glama.ai/mcp/servers/realcrabcut/crabcut-mcp-server)

## Quick Start

1. Get an API key at [app.crabcut.ai/developers](https://app.crabcut.ai/developers)
2. Run:

```bash
CRABCUT_API_KEY=sk_live_... npx @crabcut/mcp-server
```

That's it. The server connects via stdio and works with any MCP client.

## Setup

### Claude Desktop

Add this to your Claude config (`claude_desktop_config.json`):

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

### Cursor

Add to `.cursor/mcp.json` in your project:

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

### Smithery

[![smithery badge](https://smithery.ai/badge/crabcut/crabcut-mcp-server)](https://smithery.ai/servers/crabcut/crabcut-mcp-server)

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

Clip generation takes a few minutes. Here is the flow:

1. Call `generate_clips` with a YouTube URL
2. You get back a `project_id` immediately
3. Wait for results using one of two methods (polling or webhook)
4. When done, you get an array of clips sorted by score (best first), each with a `download_url`

### Project Statuses

As your project moves through the pipeline, `status` changes:

| status | Meaning |
|---|---|
| `pending` | Job is queued, not started yet |
| `processing` | Video is being downloaded, analyzed, or clips are being cut/exported |
| `completed` | All clips are exported and ready to download |
| `completed_no_clips` | Processing finished but no good clips were found |
| `failed` | Something went wrong (check `error` field) |

The `step` field gives more detail during `processing`:

| step | Meaning |
|---|---|
| `queued` | Waiting to start |
| `DOWNLOADING_VIDEO` | Downloading from YouTube |
| `EXTRACTING_AUDIO` | Extracting audio for transcription |
| `TRANSCRIBING` | Transcribing speech to text |
| `DETECTING_HIGHLIGHTS` | AI is finding the best moments |
| `CUTTING_CLIPS` | Creating individual clips |
| `EXPORTING_CLIPS` | Rendering final videos with subtitles |
| `done` | Everything is finished |

### Clip Statuses

Each clip in the response has its own `clip_status`:

| clip_status | Meaning |
|---|---|
| `pending` | Clip is created, export not started yet |
| `exporting` | Video is being rendered with subtitles |
| `completed` | Ready -- `download_url` is available |
| `failed` | Export failed for this clip |

## API Reference

### `generate_clips`

Start clip generation from a YouTube video.

**Input:**

| Field | Type | Required | Description |
|---|---|---|---|
| `url` | string | Yes | Full YouTube video URL |
| `start_time` | number | No | Start time in seconds (to process only a segment) |
| `end_time` | number | No | End time in seconds (to process only a segment) |
| `callback_url` | string | No | Webhook URL to receive results when done |

**Response:**

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

Check progress and get clips. Poll every 10-15 seconds.

**Input:**

| Field | Type | Required | Description |
|---|---|---|---|
| `project_id` | string | Yes | The project ID from `generate_clips` |

**Response (while processing):**

```json
{
  "id": "43dbe622-8ac6-4579-9625-0ad7f0f9db0b",
  "name": "Video Title",
  "status": "processing",
  "step": "CUTTING_CLIPS",
  "error": null,
  "expected_clips": 9,
  "duration": 639,
  "created_at": "2026-03-15T02:21:46.226Z",
  "clips": [
    {
      "id": "a567a875-...",
      "title": "They Overthink a Chair Like a Crisis",
      "duration": 29.19,
      "score": 74,
      "reason": "Focused on one absurd premise with escalating comedy.",
      "clip_status": "exporting",
      "download_url": null,
      "quality": "1080p",
      "thumbnail_url": null,
      "created_at": "2026-03-15T02:27:16.629Z",
      "updated_at": "2026-03-15T02:27:16.666Z"
    }
  ]
}
```

**Response (when completed):**

```json
{
  "id": "43dbe622-8ac6-4579-9625-0ad7f0f9db0b",
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
    },
    {
      "id": "a567a875-...",
      "title": "They Overthink a Chair Like a Crisis",
      "duration": 29.19,
      "score": 74,
      "reason": "Focused on one absurd premise with escalating comedy.",
      "clip_status": "completed",
      "download_url": "https://cdn.crabcut.ai/exports/premium/.../clip-a567a875-....mp4",
      "quality": "1080p",
      "thumbnail_url": "https://cdn.crabcut.ai/exports/premium/.../clip-a567a875-...-thumb.jpg",
      "created_at": "2026-03-15T02:27:16.629Z",
      "updated_at": "2026-03-15T02:28:22.816Z"
    }
  ]
}
```

Clips are sorted by `score` (highest first). The first clip in the array is the best one.

### `list_projects`

List your projects.

**Input:**

| Field | Type | Required | Description |
|---|---|---|---|
| `limit` | number | No | Max projects to return. Default 20, max 100. |
| `status` | string | No | Filter by status: `pending`, `processing`, `completed`, `completed_no_clips`, `failed` |

**Response:**

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

Get full details for a single clip.

**Input:**

| Field | Type | Required | Description |
|---|---|---|---|
| `clip_id` | string | Yes | The clip ID from a project's clips array |

**Response:**

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

Check your credits and plan.

**Input:** None.

**Response:**

```json
{
  "plan": "pro",
  "credits_remaining": 450,
  "credits_total": 500,
  "period_start": "2026-03-01T00:00:00.000Z",
  "period_end": "2026-04-01T00:00:00.000Z"
}
```

## Error Responses

When something goes wrong, the API returns an error object:

```json
{ "error": "Insufficient credits", "required": 10, "available": 3 }
```

Common errors:

| HTTP Status | Error | What to do |
|---|---|---|
| 400 | Invalid YouTube URL | Check the URL format |
| 401 | Unauthorized | Check your API key |
| 402 | Insufficient credits | Buy more credits or use a shorter video |
| 429 | Rate limit exceeded | Wait and try again |
| 500 | Internal server error | Try again later |

## Callback Webhook

Pass a `callback_url` when calling `generate_clips`. We will POST to that URL when all clips are exported and ready.

**Payload:**

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

For failed projects:

```json
{
  "event": "project.failed",
  "project_id": "43dbe622-...",
  "status": "failed",
  "source_url": "https://www.youtube.com/watch?v=...",
  "error": "YouTube video is unavailable",
  "clips": []
}
```

Clips are sorted by score (highest first). We retry the webhook up to 3 times if your server doesn't respond.

**Verifying webhooks (optional):** Each callback includes an `X-Crabcut-Signature` header. To verify it came from Crabcut:

1. Compute `SHA-256` of your API key to get your signing key
2. Compute `HMAC-SHA256` of the raw request body using that signing key
3. Compare with the header value (format: `sha256=<hex>`)

This step is optional. If you skip it, everything still works.

## Using with n8n

There are two ways to set this up in n8n:

**Option A -- Webhook (recommended):**

1. Create a new workflow with a **Webhook** trigger node. Copy its URL (e.g. `https://your-n8n.com/webhook/abc123`).
2. Add an **HTTP Request** node:
   - Method: `POST`
   - URL: `https://api.crabcut.ai/api/v1/clips/generate`
   - Authentication: Header Auth
   - Header Name: `Authorization`
   - Header Value: `Bearer sk_live_...`
   - Body (JSON):
     ```json
     {
       "url": "https://www.youtube.com/watch?v=...",
       "callback_url": "https://your-n8n.com/webhook/abc123"
     }
     ```
3. When clips are ready, the Webhook node receives the payload and your workflow continues.
4. Access the best clip: `{{ $json.clips[0].download_url }}`

**Option B -- Polling loop:**

1. **HTTP Request** node: `POST https://api.crabcut.ai/api/v1/clips/generate` with body `{"url": "..."}`. Same auth as above.
2. **Wait** node: 15 seconds.
3. **HTTP Request** node: `GET https://api.crabcut.ai/api/v1/projects/{{ $json.project_id }}`
4. **IF** node: if `{{ $json.status }}` is not `completed`, loop back to the Wait node.
5. When complete, the response includes all clips with download URLs.
6. Access the best clip: `{{ $json.clips[0].download_url }}`

**Tips for n8n:**
- `clips` is sorted by score. Index `0` is always the best clip.
- Use `{{ $json.clips.length }}` to check how many clips were generated.
- Each clip has a `clip_status`. You can filter for only completed clips.
- Free plans export at 720p. Pro plans export at 1080p.

## REST API

If you want to call the API directly (without MCP), here are the endpoints:

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `https://api.crabcut.ai/api/v1/clips/generate` | Start clip generation |
| `GET` | `https://api.crabcut.ai/api/v1/projects/:id` | Get project status and clips |
| `GET` | `https://api.crabcut.ai/api/v1/projects` | List projects |
| `GET` | `https://api.crabcut.ai/api/v1/clips/:id` | Get single clip details |
| `GET` | `https://api.crabcut.ai/api/v1/account/usage` | Check credits and plan |

All endpoints require the header: `Authorization: Bearer sk_live_...`

## Billing

Each minute of source video costs credits. A 10-minute video costs more credits than a 2-minute video. Check your balance with `check_usage`. Get credits at [crabcut.ai/pricing](https://crabcut.ai/pricing).

## Environment Variables

| Variable | Required | Default |
|---|---|---|
| `CRABCUT_API_KEY` | Yes | -- |
| `CRABCUT_API_URL` | No | `https://api.crabcut.ai` |

## Links

- Website: [crabcut.ai](https://crabcut.ai)
- Get your API key: [app.crabcut.ai/developers](https://app.crabcut.ai/developers)
- REST API base: `https://api.crabcut.ai/api/v1`

## License

MIT
