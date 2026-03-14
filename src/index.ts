#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const API_KEY = process.env.CRABCUT_API_KEY;
const API_BASE = process.env.CRABCUT_API_URL || "https://api.crabcut.ai";

if (!API_KEY) {
  console.error("Error: CRABCUT_API_KEY environment variable is required.");
  console.error("Get your API key at https://crabcut.ai/developers");
  process.exit(1);
}

const headers = {
  Authorization: `Bearer ${API_KEY}`,
  "Content-Type": "application/json",
};

async function apiCall(method: string, path: string, body?: unknown) {
  const url = `${API_BASE}/api/v1${path}`;
  const res = await fetch(url, {
    method,
    headers,
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  const data = await res.json() as Record<string, unknown>;

  if (!res.ok) {
    throw new Error(
      (data.error as string) || (data.message as string) || `API error ${res.status}`
    );
  }

  return data;
}

async function pollProject(
  projectId: string,
  maxWaitMs = 300_000
): Promise<Record<string, unknown>> {
  const start = Date.now();
  const intervals = [3000, 5000, 8000, 10000]; // escalating poll intervals
  let attempt = 0;

  while (Date.now() - start < maxWaitMs) {
    const project = await apiCall("GET", `/projects/${projectId}`);
    const status = project.status as string;

    if (status === "completed" || status === "completed_no_clips") {
      return project;
    }
    if (status === "failed") {
      throw new Error(
        `Clip generation failed: ${(project.error as string) || "Unknown error"}`
      );
    }

    const delay = intervals[Math.min(attempt, intervals.length - 1)];
    await new Promise((r) => setTimeout(r, delay));
    attempt++;
  }

  // Timed out but still processing — return current state
  return apiCall("GET", `/projects/${projectId}`);
}

const server = new McpServer({
  name: "crabcut",
  version: "1.0.0",
});

// ── Tool: generate_clips ─────────────────────────────────────────────────────

server.tool(
  "generate_clips",
  "Generate short-form video clips from a YouTube URL. Processes the video with AI to find the most engaging moments and creates vertical clips ready for TikTok, Shorts, and Reels. Returns clip details with download URLs once processing completes.",
  {
    url: z.string().describe("YouTube video URL to generate clips from"),
    start_time: z
      .number()
      .optional()
      .describe("Start time in seconds (optional, to process only a segment)"),
    end_time: z
      .number()
      .optional()
      .describe("End time in seconds (optional, to process only a segment)"),
    aspect_ratio: z
      .enum(["9:16", "16:9"])
      .optional()
      .describe("Output aspect ratio — 9:16 for vertical/TikTok (default), 16:9 for landscape"),
    wait_for_completion: z
      .boolean()
      .optional()
      .describe("If true (default), polls until clips are ready. If false, returns immediately with a project ID to check later."),
    callback_url: z
      .string()
      .optional()
      .describe("Optional webhook URL — Crabcut will POST results here when done"),
  },
  async ({ url, start_time, end_time, aspect_ratio, wait_for_completion, callback_url }) => {
    try {
      const result = await apiCall("POST", "/clips/generate", {
        url,
        start_time,
        end_time,
        aspect_ratio,
        callback_url,
      });

      const projectId = result.project_id as string;
      const shouldWait = wait_for_completion !== false;

      if (!shouldWait) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  status: "processing",
                  project_id: projectId,
                  message:
                    "Clip generation started. Use get_project_status to check progress.",
                },
                null,
                2
              ),
            },
          ],
        };
      }

      const project = await pollProject(projectId);
      const clips = (project.clips as Array<Record<string, unknown>>) || [];

      const summary =
        clips.length > 0
          ? clips
              .map(
                (c, i) =>
                  `Clip ${i + 1}: "${c.title || "Untitled"}" (${c.duration}s, score: ${c.score || "N/A"})`
              )
              .join("\n")
          : "No clips were generated from this video.";

      return {
        content: [
          {
            type: "text" as const,
            text: `Generated ${clips.length} clips from the video.\n\n${summary}\n\nFull details:\n${JSON.stringify(project, null, 2)}`,
          },
        ],
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: "text" as const, text: `Error: ${message}` }],
        isError: true,
      };
    }
  }
);

// ── Tool: get_project_status ─────────────────────────────────────────────────

server.tool(
  "get_project_status",
  "Check the status of a clip generation project. Returns the current processing step and any generated clips.",
  {
    project_id: z.string().describe("The project ID returned from generate_clips"),
  },
  async ({ project_id }) => {
    try {
      const project = await apiCall("GET", `/projects/${project_id}`);
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(project, null, 2),
          },
        ],
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: "text" as const, text: `Error: ${message}` }],
        isError: true,
      };
    }
  }
);

// ── Tool: list_projects ──────────────────────────────────────────────────────

server.tool(
  "list_projects",
  "List your recent clip generation projects with their status.",
  {
    limit: z.number().optional().describe("Max results to return (default 20, max 100)"),
    status: z
      .enum(["pending", "processing", "completed", "completed_no_clips", "failed"])
      .optional()
      .describe("Filter by project status"),
  },
  async ({ limit, status }) => {
    try {
      const params = new URLSearchParams();
      if (limit) params.set("limit", String(limit));
      if (status) params.set("status", status);
      const qs = params.toString();
      const result = await apiCall("GET", `/projects${qs ? `?${qs}` : ""}`);
      return {
        content: [
          { type: "text" as const, text: JSON.stringify(result, null, 2) },
        ],
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: "text" as const, text: `Error: ${message}` }],
        isError: true,
      };
    }
  }
);

// ── Tool: get_clip ───────────────────────────────────────────────────────────

server.tool(
  "get_clip",
  "Get details of a specific clip including its export status and URLs.",
  {
    clip_id: z.string().describe("The clip ID"),
  },
  async ({ clip_id }) => {
    try {
      const clip = await apiCall("GET", `/clips/${clip_id}`);
      return {
        content: [
          { type: "text" as const, text: JSON.stringify(clip, null, 2) },
        ],
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: "text" as const, text: `Error: ${message}` }],
        isError: true,
      };
    }
  }
);

// ── Tool: download_clip ──────────────────────────────────────────────────────

server.tool(
  "download_clip",
  "Get a download URL for a clip. Automatically handles export if not yet exported — waits until the clip is ready, then returns the download link.",
  {
    clip_id: z.string().describe("The clip ID to download"),
    quality: z
      .enum(["720p", "1080p"])
      .optional()
      .describe("Export quality — 720p (free users) or 1080p (pro users, default)"),
  },
  async ({ clip_id, quality }) => {
    try {
      // Check clip status first
      const clip = (await apiCall("GET", `/clips/${clip_id}`)) as Record<string, unknown>;

      // If not exported, trigger export
      if (!clip.is_exported && clip.export_status !== "processing") {
        await apiCall("POST", `/clips/${clip_id}/export`, { quality });
      }

      // Poll until export is done (auto-export may already be in progress)
      const maxWait = 180_000; // 3 minutes
      const start = Date.now();
      let attempt = 0;
      const intervals = [2000, 3000, 5000, 8000];

      while (Date.now() - start < maxWait) {
        const current = (await apiCall("GET", `/clips/${clip_id}`)) as Record<string, unknown>;

        if (current.is_exported || current.video_url) {
          // Exported — get download URL
          const result = await apiCall("GET", `/clips/${clip_id}/download`);
          return {
            content: [
              { type: "text" as const, text: JSON.stringify(result, null, 2) },
            ],
          };
        }

        if (current.export_status === "failed") {
          throw new Error("Clip export failed");
        }

        const delay = intervals[Math.min(attempt, intervals.length - 1)];
        await new Promise((r) => setTimeout(r, delay));
        attempt++;
      }

      return {
        content: [
          {
            type: "text" as const,
            text: "Export is still processing. Try again in a minute with the same clip_id.",
          },
        ],
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: "text" as const, text: `Error: ${message}` }],
        isError: true,
      };
    }
  }
);

// ── Tool: check_usage ────────────────────────────────────────────────────────

server.tool(
  "check_usage",
  "Check your remaining credits and current plan.",
  {},
  async () => {
    try {
      const result = await apiCall("GET", "/account/usage");
      return {
        content: [
          { type: "text" as const, text: JSON.stringify(result, null, 2) },
        ],
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: "text" as const, text: `Error: ${message}` }],
        isError: true,
      };
    }
  }
);

// ── Start server ─────────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
