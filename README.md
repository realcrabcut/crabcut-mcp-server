# @crabcut/mcp-server

Turn YouTube videos into short clips — from Claude, Cursor, or any AI assistant that supports MCP.

You give it a YouTube link. It finds the best moments, reframes them for vertical video, adds subtitles, and gives you download links. All from a chat.

## Setup

1. Get an API key at [app.crabcut.ai/developers](https://app.crabcut.ai/developers)
2. Run:

```bash
CRABCUT_API_KEY=sk_live_... npx @crabcut/mcp-server
```

That's it. The server connects via stdio and works with any MCP-compatible client.

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

For n8n, custom integrations, or any client that supports remote MCP servers:

- **Endpoint:** `https://mcp.crabcut.ai/mcp`
- **Auth:** `Authorization: Bearer sk_live_...`
- **Transport:** Streamable HTTP (POST)

## Tools

| Tool | Description |
|---|---|
| `generate_clips` | Submit a YouTube URL, returns an array of clips with titles, durations, scores, and download URLs. Waits for completion by default. |
| `get_project_status` | Returns current status (pending/processing/completed/failed) and clips array for a project. |
| `list_projects` | Returns a paginated list of projects with IDs, statuses, source URLs, and clip counts. |
| `get_clip` | Returns full clip details: title, duration, score, subtitle text, export status, and video URL. |
| `download_clip` | Returns a signed download URL for a clip. Triggers export automatically if needed. |
| `check_usage` | Returns current plan, remaining credits, total credits, and usage period. |

## Examples

**"Make clips from this video"**

Just paste a YouTube link in the chat. The assistant will call `generate_clips` and return your clips when they're ready.

**"Only clip the first 5 minutes"**

Use `start_time: 0` and `end_time: 300` to process a specific segment.

## How billing works

Each minute of video you process costs credits. You can check your balance anytime with `check_usage`. Buy credits at [crabcut.ai/pricing](https://crabcut.ai/pricing).

## Environment variables

| Variable | Required | Default |
|---|---|---|
| `CRABCUT_API_KEY` | Yes | — |
| `CRABCUT_API_URL` | No | `https://api.crabcut.ai` |

## Links

- Website: [crabcut.ai](https://crabcut.ai)
- Get your key: [app.crabcut.ai/developers](https://app.crabcut.ai/developers)
- REST API base: `https://api.crabcut.ai/api/v1`

## License

MIT
