#!/usr/bin/env node

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server.js";

const API_KEY = process.env.CRABCUT_API_KEY;
const API_BASE = process.env.CRABCUT_API_URL || "https://api.crabcut.ai";

if (!API_KEY) {
  console.error("Error: CRABCUT_API_KEY environment variable is required.");
  console.error("Get your API key at https://app.crabcut.ai/developers");
  process.exit(1);
}

const server = createServer({ apiKey: API_KEY, apiBase: API_BASE });

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
