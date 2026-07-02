import { afterEach, describe, expect, it, vi } from "vitest";

import { createApiClient } from "../src/api/client.js";
import { ApiError } from "../src/errors.js";

const config = {
  apiBaseUrl: "http://localhost:3001",
  workspaceId: undefined,
  runTimeoutMs: 180_000,
  pollIntervalMs: 2_000,
};

function okJson(data: unknown): Response {
  return { ok: true, status: 200, json: async () => data } as unknown as Response;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("createApiClient", () => {
  it("GETs /agents and parses the rows", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      okJson([
        { id: "a1", name: "Sec", provider: "openai", model: "gpt", enabled: true, extra: "ignored" },
      ]),
    );
    vi.stubGlobal("fetch", fetchMock);

    const api = createApiClient(config);
    const agents = await api.listAgents();

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3001/agents",
      expect.objectContaining({ headers: expect.any(Object) }),
    );
    expect(agents).toEqual([
      { id: "a1", name: "Sec", provider: "openai", model: "gpt", enabled: true },
    ]);
  });

  it("maps a network failure to a forward-leading ApiError", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNREFUSED")));
    const api = createApiClient(config);
    await expect(api.listAgents()).rejects.toMatchObject({
      name: "ApiError",
      status: 0,
      code: "network_error",
    });
  });

  it("unwraps the {error:{...}} envelope on non-2xx", async () => {
    const res = {
      ok: false,
      status: 404,
      statusText: "Not Found",
      json: async () => ({ error: { code: "not_found", message: "Repo not found" } }),
    } as unknown as Response;
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(res));

    const api = createApiClient(config);
    const err = await api.listPullsForRepo("r1").catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 404, code: "not_found", message: "Repo not found" });
  });
});
