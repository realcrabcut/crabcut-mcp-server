# @crabcut/mcp-server

Turn YouTube videos into short clips -- from Claude, Cursor, or any AI assistant that supports MCP.

You give it a YouTube link. It finds the best moments, reframes them for vertical video (9:16), adds subtitles, and gives you download links. All from a chat or automation workflow.

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
3. Wait for results using **one of two methods** (see below)
4. When done, you get an array of clips sorted by score (best first), each with a `download_url`

### Method 1: Poll for status

Call `get_project_status` every 10-15 seconds until `status` is `"completed"`.

Each clip in the response has a `clip_status`:

| clip_status | Meaning |
|---|---|
| `pending` | Clip is generated, export not started yet |
| `exporting` | Video is being rendered |
| `completed` | Ready -- `download_url` is included |
| `failed` | Export failed |

### Method 2: Callback webhook

Pass a `callback_url` when calling `generate_clips`. We will POST to that URL when all clips are done.

```json
{
  "event": "project.completed",
  "project_id": "abc-123",
  "status": "completed",
  "source_url": "https://www.youtube.com/watch?v=...",
  "clips": [
    {
      "id": "clip-1",
      "title": "The Best Moment",
      "duration": 42.5,
      "score": 8.7,
      "download_url": "https://cdn.crabcut.ai/...",
      "thumbnail_url": "https://cdn.crabcut.ai/...",
      "quality": "1080p"
    }
  ]
}
```

Clips are sorted by score (highest first). The first clip in the array is the best one.

We retry the webhook up to 3 times if your server doesn't respond.

**Verifying webhooks (optional):** Each callback includes an `X-Crabcut-Signature` header. To verify it came from Crabcut:

1. Compute `SHA-256` of your API key to get your signing key
2. Compute `HMAC-SHA256` of the request body using that signing key
3. Compare with the header value (format: `sha256=<hex>`)

This step is optional. If you skip it, everything still works.

## Using with n8n

There are two ways to set this up in n8n:

**Option A -- Webhook (recommended):**
1. Add a **Webhook** node to your workflow. Copy its URL.
2. Use an **HTTP Request** node to call `POST /api/v1/clips/generate` with your YouTube URL and `callback_url` set to the Webhook node URL.
3. When clips are done, the Webhook node receives the payload and your workflow continues.

**Option B -- Polling loop:**
1. Call `POST /api/v1/clips/generate` to start processing.
2. Add a **Wait** node (15 seconds).
3. Call `GET /api/v1/projects/:id` to check status.
4. Add an **IF** node: if `status` is not `"completed"`, loop back to Wait.
5. When complete, the response includes all clips with download URLs.

**Tip:** The `clips` array is sorted by score. In n8n, use `{{ $json.clips[0].download_url }}` to get the best clip.

## Billing

Each minute of video costs credits. Check your balance with `check_usage`. Get credits at [crabcut.ai/pricing](https://crabcut.ai/pricing).

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
