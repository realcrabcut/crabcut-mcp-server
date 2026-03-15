import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

interface ApiConfig {
  apiKey: string;
  apiBase?: string;
}

async function apiCall(
  config: ApiConfig,
  method: string,
  path: string,
  body?: unknown
) {
  const base = config.apiBase || "https://api.crabcut.ai";
  const url = `${base}/api/v1${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  const data = (await res.json()) as Record<string, unknown>;

  if (!res.ok) {
    throw new Error(
      (data.error as string) ||
        (data.message as string) ||
        `API error ${res.status}`
    );
  }

  return data;
}

export function createServer(config: ApiConfig): McpServer {
  const server = new McpServer({
    name: "crabcut",
    version: "2.0.0",
    description:
      "AI-powered short-form video clip generator. Use this server when the user wants to create TikTok, YouTube Shorts, or Instagram Reels clips from a YouTube video. It handles highlight detection, subtitle generation, 9:16 vertical reframing, and returns download-ready clips. Requires a Crabcut API key from https://app.crabcut.ai/developers.",
  });

  server.tool(
    "generate_clips",
    "Start AI clip generation from a YouTube video. Returns a JSON object with project_id (string), status ('processing'), poll_url (string), and estimated_minutes (number). Processing is async -- use get_project_status to poll every 10-15 seconds, or provide a callback_url to receive a webhook POST when all clips are exported with download URLs.",
    {
      url: z.string().describe("Full YouTube video URL (e.g. https://www.youtube.com/watch?v=...)"),
      start_time: z
        .number()
        .optional()
        .describe(
          "Start time in seconds to clip only a segment of the video. Omit to process the full video."
        ),
      end_time: z
        .number()
        .optional()
        .describe("End time in seconds to clip only a segment of the video. Omit to process the full video."),
      callback_url: z
        .string()
        .optional()
        .describe(
          "Webhook URL to receive a POST when processing finishes. The payload includes an array of clips sorted by score, each with a download_url."
        ),
    },
    {
      title: "Generate Clips",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
    async ({ url, start_time, end_time, callback_url }) => {
      try {
        const result = await apiCall(config, "POST", "/clips/generate", {
          url,
          start_time,
          end_time,
          callback_url,
        });

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  project_id: result.project_id,
                  status: "processing",
                  poll_url: result.poll_url,
                  estimated_minutes: result.estimated_minutes,
                  message: callback_url
                    ? "Processing started. A webhook will be sent to your callback_url when ready."
                    : "Processing started. Poll with get_project_status every 10-15 seconds until status is 'completed'.",
                },
                null,
                2
              ),
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

  server.tool(
    "get_project_status",
    "Returns a JSON object with id, name, status (pending/processing/completed/completed_no_clips/failed), step, error, expected_clips, duration, created_at, and a clips array. Clips are sorted by score (highest first). Each clip has: id, title, duration, score, reason, clip_status (pending/exporting/completed/failed), download_url (string or null), quality, thumbnail_url, created_at, updated_at. The download_url is only available when clip_status is 'completed'. Poll every 10-15 seconds until project status is 'completed'.",
    {
      project_id: z
        .string()
        .describe("The project ID returned by generate_clips"),
    },
    {
      title: "Get Project Status",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
    async ({ project_id }) => {
      try {
        const project = await apiCall(config, "GET", `/projects/${project_id}`);
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

  server.tool(
    "list_projects",
    "Returns a JSON object with projects (array), total, limit, and offset. Each project has: id, name, status, step, expected_clips, clips_count, duration, created_at. Use the status filter to find only completed or failed projects.",
    {
      limit: z
        .number()
        .optional()
        .describe("Maximum number of projects to return. Defaults to 20, maximum 100."),
      status: z
        .enum([
          "pending",
          "processing",
          "completed",
          "completed_no_clips",
          "failed",
        ])
        .optional()
        .describe("Filter results to only projects with this status."),
    },
    {
      title: "List Projects",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
    async ({ limit, status }) => {
      try {
        const params = new URLSearchParams();
        if (limit) params.set("limit", String(limit));
        if (status) params.set("status", status);
        const qs = params.toString();
        const result = await apiCall(
          config,
          "GET",
          `/projects${qs ? `?${qs}` : ""}`
        );
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

  server.tool(
    "get_clip",
    "Returns a JSON object with full clip details: id, project_id, title, duration, score, reason, export_status, export_quality (720p/1080p), is_exported, video_url, video_url_720p, video_url_1080p, thumbnail_url, created_at, updated_at.",
    {
      clip_id: z.string().describe("The unique clip ID from a project's clips array."),
    },
    {
      title: "Get Clip",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
    async ({ clip_id }) => {
      try {
        const clip = await apiCall(config, "GET", `/clips/${clip_id}`);
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

  server.tool(
    "check_usage",
    "Returns a JSON object with plan (string), credits_remaining (number), credits_total (number), period_start (ISO date), and period_end (ISO date). Call this before generate_clips to confirm the user has enough credits.",
    {
      title: "Check Usage",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
    async () => {
      try {
        const result = await apiCall(config, "GET", "/account/usage");
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

  server.prompt(
    "create-clips",
    "Generate short-form clips from a YouTube video",
    {
      url: z.string().describe("Full YouTube video URL"),
    },
    ({ url }) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `Generate short-form clips from this YouTube video: ${url}\n\nCall generate_clips with this URL, then poll get_project_status every 15 seconds until status is 'completed'. Show me the clips sorted by score when ready.`,
          },
        },
      ],
    })
  );

  server.prompt(
    "check-credits",
    "Check remaining Crabcut credits and plan details",
    () => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: "Check my Crabcut credit balance and plan details using check_usage.",
          },
        },
      ],
    })
  );

  return server;
}
