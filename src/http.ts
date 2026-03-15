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
    serverInfo: { name: "crabcut", version: "1.0.6" },
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
          "Submit a YouTube video for AI clip generation. Returns an array of clips, each with a title, duration in seconds, engagement score, and download URL. By default waits up to 5 minutes for processing to complete.",
        inputSchema: {
          type: "object",
          properties: {
            url: { type: "string", description: "Full YouTube video URL (e.g. https://www.youtube.com/watch?v=...)" },
            start_time: { type: "number", description: "Start time in seconds to clip only a segment of the video. Omit to process the full video." },
            end_time: { type: "number", description: "End time in seconds to clip only a segment of the video. Omit to process the full video." },
            wait_for_completion: { type: "boolean", description: "If true (default), blocks until all clips are generated. If false, returns a project_id immediately." },
            callback_url: { type: "string", description: "Webhook URL to receive a POST with the completed project payload." },
          },
          required: ["url"],
        },
      },
      {
        name: "get_project_status",
        description: "Returns the current status of a clip generation project: pending, processing, completed, completed_no_clips, or failed. When completed, includes the clips array.",
        inputSchema: {
          type: "object",
          properties: { project_id: { type: "string", description: "The project ID returned by generate_clips when wait_for_completion is false." } },
          required: ["project_id"],
        },
      },
      {
        name: "list_projects",
        description: "Returns a paginated list of the user's clip generation projects, each with project_id, status, source YouTube URL, creation date, and clip count.",
        inputSchema: {
          type: "object",
          properties: {
            limit: { type: "number", description: "Maximum number of projects to return. Defaults to 20, maximum 100." },
            status: { type: "string", enum: ["pending", "processing", "completed", "completed_no_clips", "failed"], description: "Filter results to only projects with this status." },
          },
        },
      },
      {
        name: "get_clip",
        description: "Returns full details of a single clip: title, duration, engagement score, subtitle text, export status, and video_url if exported.",
        inputSchema: {
          type: "object",
          properties: { clip_id: { type: "string", description: "The unique clip ID from a completed project's clips array." } },
          required: ["clip_id"],
        },
      },
      {
        name: "download_clip",
        description: "Returns a temporary signed download URL for a clip's video file. Triggers export automatically if not yet exported and polls until ready.",
        inputSchema: {
          type: "object",
          properties: {
            clip_id: { type: "string", description: "The unique clip ID to export and download." },
            quality: { type: "string", enum: ["720p", "1080p"], description: "Video export quality. Free plans support 720p only. Pro plans default to 1080p." },
          },
          required: ["clip_id"],
        },
      },
      {
        name: "check_usage",
        description: "Returns the user's current plan name, remaining credits, total credits, and usage period.",
        inputSchema: { type: "object", properties: {} },
      },
    ],
    resources: [],
    prompts: [],
  });
});

app.post("/mcp", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({
      error: "Missing or invalid API key. Pass your Crabcut API key as: Authorization: Bearer sk_live_...",
      docs: "https://app.crabcut.ai/developers",
    });
    return;
  }

  const apiKey = authHeader.slice(7);

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
