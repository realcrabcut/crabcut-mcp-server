import express from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createServer } from "./server.js";

const API_BASE = process.env.CRABCUT_API_URL || "https://api.crabcut.ai";
const PORT = parseInt(process.env.PORT || "8080");

const app = express();
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "crabcut-mcp-server" });
});

app.get("/.well-known/mcp/server-card.json", (_req, res) => {
  res.json({
    serverInfo: { name: "crabcut", version: "2.0.0" },
    authentication: {
      required: true,
      schemes: ["bearer"],
      description:
        "Pass your Crabcut API key as: Authorization: Bearer sk_live_...",
      get_api_key: "https://app.crabcut.ai/developers",
    },
    tools: [
      {
        name: "generate_clips",
        description:
          "Start AI clip generation from a YouTube video. Returns {project_id, status, poll_url, estimated_minutes}. Poll with get_project_status every 10-15 seconds, or provide a callback_url for webhook notification.",
        inputSchema: {
          type: "object",
          properties: {
            url: { type: "string", description: "Full YouTube video URL (e.g. https://www.youtube.com/watch?v=...)" },
            start_time: { type: "number", description: "Start time in seconds to clip only a segment. Omit to process the full video." },
            end_time: { type: "number", description: "End time in seconds to clip only a segment. Omit to process the full video." },
            callback_url: { type: "string", description: "Webhook URL to receive a POST when all clips are ready with download links." },
          },
          required: ["url"],
        },
      },
      {
        name: "get_project_status",
        description: "Returns {id, name, status, step, error, expected_clips, duration, clips[]}. Clips sorted by score, each with clip_status (pending/exporting/completed/failed) and download_url when ready.",
        inputSchema: {
          type: "object",
          properties: { project_id: { type: "string", description: "The project ID returned by generate_clips." } },
          required: ["project_id"],
        },
      },
      {
        name: "list_projects",
        description: "Returns {projects[], total, limit, offset}. Each project has id, name, status, step, expected_clips, clips_count, duration, created_at.",
        inputSchema: {
          type: "object",
          properties: {
            limit: { type: "number", description: "Maximum projects to return. Defaults to 20, max 100." },
            status: { type: "string", enum: ["pending", "processing", "completed", "completed_no_clips", "failed"], description: "Filter by status." },
          },
        },
      },
      {
        name: "get_clip",
        description: "Returns full clip details: id, project_id, title, duration, score, reason, export_status, export_quality, is_exported, video_url, thumbnail_url.",
        inputSchema: {
          type: "object",
          properties: { clip_id: { type: "string", description: "The unique clip ID from a project's clips array." } },
          required: ["clip_id"],
        },
      },
      {
        name: "check_usage",
        description: "Returns {plan, credits_remaining, credits_total, period_start, period_end}. Check before generate_clips to confirm enough credits.",
        inputSchema: { type: "object", properties: {} },
      },
    ],
    resources: [],
    prompts: [],
  });
});

app.post("/mcp", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    res.status(401).json({
      error: "Missing API key. Pass your Crabcut API key as: Authorization: Bearer sk_live_...",
      docs: "https://app.crabcut.ai/developers",
    });
    return;
  }

  const apiKey = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7)
    : authHeader;

  try {
    const server = createServer({ apiKey, apiBase: API_BASE });
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });

    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    console.error("MCP request error:", err);
    if (!res.headersSent) {
      res.status(500).json({ error: "Internal server error" });
    }
  }
});

app.get("/mcp", (_req, res) => {
  res.status(405).json({
    error: "Method not allowed. This is a stateless MCP server — use POST.",
  });
});

app.delete("/mcp", (_req, res) => {
  res.status(405).json({
    error: "Method not allowed. This is a stateless MCP server — no sessions to delete.",
  });
});

app.get("/", (_req, res) => {
  res.json({
    name: "Crabcut MCP Server",
    description: "Turn YouTube videos into short-form clips from any AI assistant",
    docs: "https://github.com/realcrabcut/crabcut-mcp-server",
    mcp_endpoint: "/mcp",
    auth: "Bearer <your-crabcut-api-key>",
    get_api_key: "https://app.crabcut.ai/developers",
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Crabcut MCP server (Streamable HTTP) listening on port ${PORT}`);
});
