import { createParser } from "eventsource-parser";

import { ApiError } from "../errors.js";

/**
 * Consumes the run event stream `GET /runs/:id/events` and resolves when the
 * stream closes — which the server does when the run reaches a terminal state
 * (there is no explicit "done" payload). The caller then re-queries
 * `GET /pulls/:id/runs` for the authoritative status.
 *
 * Each SSE message carries `event: <kind>` and `data: <JSON RunEvent>`.
 * Aborting the signal cancels the fetch (read() rejects with AbortError).
 */
export interface RunStreamEvent {
  kind: string;
  msg: string;
  seq: number;
}

export type StreamRunEvents = (
  baseUrl: string,
  runId: string,
  opts: { signal: AbortSignal; onEvent?: (e: RunStreamEvent) => void },
) => Promise<void>;

export const streamRunEvents: StreamRunEvents = async (baseUrl, runId, opts) => {
  const res = await fetch(`${baseUrl}/runs/${runId}/events`, {
    headers: { accept: "text/event-stream" },
    signal: opts.signal,
  });

  if (!res.ok || !res.body) {
    throw new ApiError(
      `Failed to open run event stream (status ${res.status}).`,
      res.status,
      "sse_open_failed",
    );
  }

  const parser = createParser({
    onEvent(event) {
      try {
        const parsed = JSON.parse(event.data) as {
          kind?: string;
          msg?: string;
          seq?: number;
        };
        opts.onEvent?.({
          kind: parsed.kind ?? event.event ?? "info",
          msg: parsed.msg ?? "",
          seq: parsed.seq ?? 0,
        });
      } catch {
        /* ignore malformed event lines */
      }
    },
  });

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    parser.feed(decoder.decode(value, { stream: true }));
  }
};
