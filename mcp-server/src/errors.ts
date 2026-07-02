/**
 * Errors that lead forward.
 *
 * Tool handlers never throw to the stdio transport (a thrown error corrupts the
 * protocol stream). They catch and return an MCP tool error whose message tells
 * the model what to do next.
 */

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export interface ToolResult {
  content: { type: "text"; text: string }[];
  isError?: boolean;
  // The SDK's CallToolResult carries an index signature (for _meta etc.);
  // mirror it so handlers are assignable to registerTool's callback type.
  [key: string]: unknown;
}

/** Wrap a value (object → JSON, string → as-is) in a successful tool result. */
export function textResult(value: unknown): ToolResult {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return { content: [{ type: "text", text }] };
}

/**
 * Map any thrown value to a forward-leading MCP tool error.
 * `forwardHint` is appended for non-network errors to suggest the next action.
 */
export function toToolError(err: unknown, forwardHint?: string): ToolResult {
  let text: string;
  if (err instanceof ApiError) {
    if (err.code === "network_error" || err.status === 0) {
      text =
        "Cannot reach the DevDigest API. Start it with `pnpm dev` in server/ " +
        "(port 3001) and ensure the DB is migrated + seeded, then retry.";
    } else {
      text = forwardHint ? `${err.message}. ${forwardHint}` : `${err.message}.`;
    }
  } else {
    const msg = err instanceof Error ? err.message : String(err);
    text = forwardHint ? `${msg}. ${forwardHint}` : `${msg}.`;
  }
  return { content: [{ type: "text", text }], isError: true };
}
