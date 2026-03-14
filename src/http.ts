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
