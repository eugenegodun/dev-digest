import { z } from "zod";

/**
 * Server configuration, loaded once from the environment and validated.
 * On invalid config we throw; index.ts catches and exits non-zero to stderr.
 */
const ConfigSchema = z.object({
  apiBaseUrl: z.string().url(),
  workspaceId: z.string().uuid().optional(),
  runTimeoutMs: z.number().int().min(10_000).max(600_000),
  pollIntervalMs: z.number().int().min(250).max(60_000),
});

export type Config = z.infer<typeof ConfigSchema>;

function intFromEnv(value: string | undefined, fallback: number): number {
  if (value === undefined || value.trim() === "") return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : NaN;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const raw = {
    apiBaseUrl: env.DEVDIGEST_API_BASE_URL?.trim() || "http://localhost:3001",
    workspaceId: env.DEVDIGEST_WORKSPACE_ID?.trim() || undefined,
    runTimeoutMs: intFromEnv(env.DEVDIGEST_RUN_TIMEOUT_MS, 180_000),
    pollIntervalMs: intFromEnv(env.DEVDIGEST_POLL_INTERVAL_MS, 2_000),
  };

  const result = ConfigSchema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid MCP server configuration:\n${issues}`);
  }
  return result.data;
}
