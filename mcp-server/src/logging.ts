/**
 * stderr-ONLY logger.
 *
 * Hard rule for a stdio MCP server: stdout carries the MCP protocol. Anything
 * written to stdout (a stray console.log) corrupts the stream. Every log here
 * goes to stderr.
 */

type Level = "debug" | "info" | "warn" | "error";

function emit(level: Level, msg: string, meta?: unknown): void {
  const line =
    meta === undefined
      ? `[mcp-server] ${level}: ${msg}`
      : `[mcp-server] ${level}: ${msg} ${safeJson(meta)}`;
  process.stderr.write(line + "\n");
}

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export const log = {
  debug: (msg: string, meta?: unknown) => emit("debug", msg, meta),
  info: (msg: string, meta?: unknown) => emit("info", msg, meta),
  warn: (msg: string, meta?: unknown) => emit("warn", msg, meta),
  error: (msg: string, meta?: unknown) => emit("error", msg, meta),
};
