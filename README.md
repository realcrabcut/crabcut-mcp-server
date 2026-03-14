# @crabcut/mcp-server

Turn YouTube videos into short clips — from Claude, Cursor, or any AI assistant that supports MCP.

You give it a YouTube link. It finds the best moments, reframes them for vertical video, adds subtitles, and gives you download links. All from a chat.

[![CrabCut MCP server](https://glama.ai/mcp/servers/realcrabcut/crabcut-mcp-server/badges/card.svg)](https://glama.ai/mcp/servers/realcrabcut/crabcut-mcp-server)

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

## Tools

| Tool | What it does |
|---|---|
| `generate_clips` | Send a YouTube URL, get back clips. Waits for processing by default. |
| `get_project_status` | Check how a generation job is going. |
| `list_projects` | See your recent projects. |
| `get_clip` | Get details about a specific clip. |
| `download_clip` | Get a download link. Handles export automatically if needed. |
| `check_usage` | See how many credits you have left. |

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