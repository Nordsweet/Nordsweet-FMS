import { describe, expect, it, vi } from "vitest";

import { createSyncApi, deviceId, parseSse } from "./client";
import { SyncError, type SyncHint } from "./contract";

const json = (
  body: unknown,
  status = 200,
  headers: Record<string, string> = {},
) => new Response(JSON.stringify(body), { status, headers });
const item = {
  collection: "settings",
  id: "main",
  rev: 2,
  schema_version: 1,
  deleted: false,
  updated_at: "2026-01-01T00:00:00Z",
  device_id: "phone-0001",
  data: { language: "en" },
  seq: 4,
};

function api(request: (url: URL, init?: RequestInit) => Promise<Response>) {
  return createSyncApi({
    baseUrl: "https://api.test",
    device: "phone-0001",
    request,
  });
}

describe("requests", () => {
  it("sends the device id and the documented bodies", async () => {
    const request = vi.fn(async (_url: URL, _init?: RequestInit) =>
      json({ rev: 1, updated_at: "x", seq: 1 }),
    );
    await api(request).put("flights", "a b", {
      data: { n: 1 },
      schemaVersion: 3,
      baseRev: 0,
    });
    const [url, init] = request.mock.calls[0]!;
    expect(url.href).toBe("https://api.test/sync/items/flights/a%20b");
    expect(init?.method).toBe("PUT");
    expect(new Headers(init?.headers).get("X-Device-Id")).toBe("phone-0001");
    expect(JSON.parse(init?.body as string)).toEqual({
      data: { n: 1 },
      schema_version: 3,
      base_rev: 0,
    });
  });

  it("reads changes and deletes with the base rev in the query", async () => {
    const request = vi.fn(async (url: URL, init?: RequestInit) =>
      init?.method === "DELETE"
        ? new Response(null, { status: 204 })
        : json({ items: [item], cursor: 4, has_more: false }),
    );
    const client = api(request);
    expect((await client.changes(2, 50)).items[0]?.id).toBe("main");
    expect(request.mock.calls[0]![0].search).toBe("?since=2&limit=50");
    await client.remove("flights", "a", 7);
    expect(request.mock.calls[1]![0].search).toBe("?base_rev=7");
  });

  it("turns error answers into SyncError with Retry-After and the conflicting item", async () => {
    const conflict = json(
      { detail: { message: "rev conflict", current: item } },
      409,
    );
    await expect(api(async () => conflict).changes(0)).rejects.toMatchObject({
      status: 409,
      current: { rev: 2 },
    });
    await expect(
      api(async () =>
        json(
          { detail: { message: "rev conflict", current: null } },
          409,
        ).clone(),
      ).changes(0),
    ).rejects.toMatchObject({ current: null });
    await expect(
      api(async () =>
        json({ detail: "slow down" }, 429, { "Retry-After": "12" }),
      ).changes(0),
    ).rejects.toMatchObject({
      status: 429,
      retryAfterS: 12,
      message: "slow down",
    });
    await expect(
      api(async () => json({ detail: "gone" }, 410)).changes(0),
    ).rejects.toMatchObject({ status: 410 });
  });

  it("treats an answer of the wrong shape as a server error", async () => {
    await expect(
      api(async () => json({ places: [] })).changes(0),
    ).rejects.toMatchObject({ status: 502 });
    await expect(
      api(async () => new Response("<html>")).changes(0),
    ).rejects.toMatchObject({ status: 502 });
  });

  it("reports an unreachable server as status 0", async () => {
    const down = api(async () => {
      throw new TypeError("Failed to fetch");
    });
    await expect(down.changes(0)).rejects.toBeInstanceOf(SyncError);
    await expect(down.changes(0)).rejects.toMatchObject({ status: 0 });
  });
});

describe("device id", () => {
  it("is created once and kept", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (k: string) => values.get(k) ?? null,
      setItem: (k: string, v: string) => void values.set(k, v),
    };
    const id = deviceId(storage);
    expect(id.length).toBeGreaterThanOrEqual(8);
    expect(id.length).toBeLessThanOrEqual(64);
    expect(deviceId(storage)).toBe(id);
  });
});

describe("stream", () => {
  const hint: SyncHint = {
    collection: "flights",
    id: "a",
    rev: 3,
    seq: 9,
    device_id: "ipad-00001",
  };
  const sse = (...chunks: string[]) =>
    new Response(
      new ReadableStream({
        start(controller) {
          for (const chunk of chunks)
            controller.enqueue(new TextEncoder().encode(chunk));
          controller.close();
        },
      }),
    );

  it("parses events split across chunks and ignores pings", () => {
    const first = parseSse(': ping\n\nevent: change\ndata: {"a"');
    expect(first.events).toEqual([]);
    const second = parseSse(first.rest + ":1}\n\n: ping\n\n");
    expect(second.events).toEqual([{ event: "change", data: '{"a":1}' }]);
  });

  it("hands every change event to the callback", async () => {
    const hints: SyncHint[] = [];
    const text = `event: change\ndata: ${JSON.stringify(hint)}\n\n`;
    await api(async () =>
      sse(": ping\n\n", text.slice(0, 20), text.slice(20)),
    ).stream(new AbortController().signal, (h) => hints.push(h));
    expect(hints).toEqual([hint]);
  });

  it("fails with the status of a refused stream and ends quietly when aborted", async () => {
    await expect(
      api(async () => json({ detail: "no" }, 401)).stream(
        new AbortController().signal,
        () => undefined,
      ),
    ).rejects.toMatchObject({ status: 401 });
    const stop = new AbortController();
    const pending = api(
      (_url, init) =>
        new Promise<Response>((_, reject) =>
          init?.signal?.addEventListener("abort", () =>
            reject(new DOMException("aborted", "AbortError")),
          ),
        ),
    ).stream(stop.signal, () => undefined);
    stop.abort();
    await expect(pending).resolves.toBeUndefined();
  });
});
