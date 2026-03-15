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

async function pollProject(
  config: ApiConfig,
  projectId: string,
  maxWaitMs = 300_000
): Promise<Record<string, unknown>> {
  const start = Date.now();
  const intervals = [3000, 5000, 8000, 10000];
  let attempt = 0;

  while (Date.now() - start < maxWaitMs) {
    const project = await apiCall(config, "GET", `/projects/${projectId}`);
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

  return apiCall(config, "GET", `/projects/${projectId}`);
}

export function createServer(config: ApiConfig): McpServer {
  const server = new McpServer({
    name: "crabcut",
    version: "1.0.6",
    description:
      "AI-powered short-form video clip generator. Use this server when the user wants to create TikTok, YouTube Shorts, or Instagram Reels clips from a YouTube video. It handles highlight detection, subtitle generation, 9:16 vertical reframing, and returns download-ready clips. Requires a Crabcut API key from https://app.crabcut.ai/developers.",
  });

  server.tool(
    "generate_clips",
    "Submit a YouTube video for AI clip generation. Returns an array of clips, each with a title, duration in seconds, engagement score, and download URL. By default waits up to 5 minutes for processing to complete. Set wait_for_completion to false to get a project_id immediately and poll with get_project_status later.",
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
      wait_for_completion: z
        .boolean()
        .optional()
        .describe(
          "If true (default), blocks until all clips are generated and returns them. If false, returns a project_id immediately — use get_project_status to poll."
        ),
      callback_url: z
        .string()
        .optional()
        .describe(
          "Webhook URL to receive a POST with the completed project payload when processing finishes."
        ),
    },
    async ({
      url,
      start_time,
      end_time,
      wait_for_completion,
      callback_url,
    }) => {
      try {
        const result = await apiCall(config, "POST", "/clips/generate", {
          url,
          start_time,
          end_time,
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

        const project = await pollProject(config, projectId);
        const clips =
          (project.clips as Array<Record<string, unknown>>) || [];

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

  server.tool(
    "get_project_status",
    "Returns the current status of a clip generation project: pending, processing, completed, completed_no_clips, or failed. When completed, the response includes an array of generated clips with their titles, durations, scores, and download URLs.",
    {
      project_id: z
        .string()
        .describe("The project ID returned by generate_clips when wait_for_completion is false"),
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
    "Returns a paginated list of the user's clip generation projects, each with project_id, status, source YouTube URL, creation date, and clip count. Use the status filter to find only completed or failed projects.",
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
    "Returns full details of a single clip: title, duration, engagement score, subtitle text, export status (pending/processing/exported/failed), and video_url if exported. Use this to inspect a clip before downloading.",
    {
      clip_id: z.string().describe("The unique clip ID from a completed project's clips array."),
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
    "download_clip",
    "Returns a temporary download URL for a clip's video file. If the clip hasn't been exported yet, triggers export and polls until ready (up to 3 minutes). The returned URL is a signed link valid for a limited time.",
    {
      clip_id: z.string().describe("The unique clip ID to export and download."),
      quality: z
        .enum(["720p", "1080p"])
        .optional()
        .describe(
          "Video export quality. Free plans support 720p only. Pro plans default to 1080p."
        ),
    },
    async ({ clip_id, quality }) => {
      try {
        const clip = (await apiCall(
          config,
          "GET",
          `/clips/${clip_id}`
        )) as Record<string, unknown>;

        if (!clip.is_exported && clip.export_status !== "processing") {
          await apiCall(config, "POST", `/clips/${clip_id}/export`, {
            quality,
          });
        }

        const maxWait = 180_000;
        const start = Date.now();
        let attempt = 0;
        const intervals = [2000, 3000, 5000, 8000];

        while (Date.now() - start < maxWait) {
          const current = (await apiCall(
            config,
            "GET",
            `/clips/${clip_id}`
          )) as Record<string, unknown>;

          if (current.is_exported || current.video_url) {
            const result = await apiCall(
              config,
              "GET",
              `/clips/${clip_id}/download`
            );
            return {
              content: [
                {
                  type: "text" as const,
                  text: JSON.stringify(result, null, 2),
                },
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

  server.tool(
    "check_usage",
    "Returns the user's current plan name, remaining credits, total credits, and usage period. Call this before generate_clips to confirm the user has enough credits.",
    {},
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

  return server;
}
