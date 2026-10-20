import { type z } from "zod";

import { env } from "~/env";
import { aviationFetch } from "~/api/aviation/client";

import {
  changesSchema,
  conflictSchema,
  hintSchema,
  putResultSchema,
  SyncError,
  type SyncApi,
  type SyncHint,
} from "./contract";

const DEVICE_KEY = "nordsweet.deviceId.v1";
/** No bytes (not even the 15 s ping) for this long: the connection is dead, reconnect. */
const STREAM_SILENCE_MS = 45_000;

/** One id per browser profile; tabs share it, so the server never sends them each other's hints. */
export function deviceId(
  storage: Pick<Storage, "getItem" | "setItem"> = localStorage,
) {
  let id = storage.getItem(DEVICE_KEY);
  if (!id || id.length < 8 || id.length > 64) {
    id = crypto.randomUUID();
    storage.setItem(DEVICE_KEY, id);
  }
  return id;
}

/** Events of a Server-Sent-Events text buffer; the unfinished tail is returned for the next chunk. */
export function parseSse(buffer: string) {
  const blocks = buffer.split(/\r?\n\r?\n/);
  const rest = blocks.pop() ?? "";
  const events = blocks.flatMap((block) => {
    let event = "message";
    const data: string[] = [];
    for (const line of block.split(/\r?\n/)) {
      if (line.startsWith(":")) continue;
      if (line.startsWith("event:")) event = line.slice(6).trim();
      else if (line.startsWith("data:")) data.push(line.slice(5).trimStart());
    }
    return data.length ? [{ event, data: data.join("\n") }] : [];
  });
  return { events, rest };
}

type Request = (url: URL, init?: RequestInit) => Promise<Response>;

export function createSyncApi({
  baseUrl = env.NEXT_PUBLIC_AVIATION_API_URL,
  device = deviceId(),
  request = aviationFetch,
}: { baseUrl?: string; device?: string; request?: Request } = {}): SyncApi {
  const call = async (path: string, init: RequestInit = {}) => {
    const headers = new Headers(init.headers);
    headers.set("X-Device-Id", device);
    let response: Response;
    try {
      response = await request(new URL(path, baseUrl), { ...init, headers });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError")
        throw error;
      throw new SyncError(0, "Network unavailable");
    }
    if (response.ok) return response;
    const body: unknown = await response.json().catch(() => null);
    const retry = Number(response.headers.get("Retry-After"));
    const conflict = conflictSchema.safeParse(body);
    const detail = (body as { detail?: unknown } | null)?.detail;
    throw new SyncError(
      response.status,
      conflict.success
        ? conflict.data.detail.message
        : typeof detail === "string"
          ? detail
          : `Sync ${path} failed (${response.status})`,
      Number.isFinite(retry) && retry > 0 ? retry : null,
      conflict.success ? conflict.data.detail.current : null,
    );
  };
  // A 200 that is not the documented shape is a server problem, not something to retry as a bug of ours.
  const json = async <S extends z.ZodType>(response: Response, schema: S) => {
    const parsed = schema.safeParse(await response.json().catch(() => null));
    if (!parsed.success) throw new SyncError(502, "Unexpected sync response");
    return parsed.data;
  };
  const item = (collection: string, id: string) =>
    `/sync/items/${encodeURIComponent(collection)}/${encodeURIComponent(id)}`;

  return {
    changes: async (since, limit = 100) =>
      json(
        await call(`/sync/changes?since=${since}&limit=${limit}`),
        changesSchema,
      ),
    put: async (collection, id, { data, schemaVersion, baseRev }) =>
      json(
        await call(item(collection, id), {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            data,
            schema_version: schemaVersion,
            base_rev: baseRev,
          }),
        }),
        putResultSchema,
      ),
    remove: async (collection, id, baseRev) => {
      await call(`${item(collection, id)}?base_rev=${baseRev}`, {
        method: "DELETE",
      });
    },
    // fetch, not EventSource: the stream needs the Authorization and X-Device-Id headers.
    stream: async (signal, onHint) => {
      const inner = new AbortController();
      const abort = () => inner.abort();
      signal.addEventListener("abort", abort);
      let silence: ReturnType<typeof setTimeout> | undefined;
      const watch = () => {
        clearTimeout(silence);
        silence = setTimeout(abort, STREAM_SILENCE_MS);
      };
      try {
        watch();
        const response = await call("/sync/stream", {
          signal: inner.signal,
          headers: { Accept: "text/event-stream" },
        });
        if (!response.body) throw new SyncError(0, "Empty stream");
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        for (;;) {
          const { done, value } = await reader.read();
          if (done) return;
          watch();
          const parsed = parseSse(
            buffer + decoder.decode(value, { stream: true }),
          );
          buffer = parsed.rest;
          for (const { event, data } of parsed.events) {
            if (event !== "change") continue;
            const hint = hintSchema.safeParse(JSON.parse(data));
            if (hint.success) onHint(hint.data satisfies SyncHint);
          }
        }
      } catch (error) {
        if (signal.aborted) return;
        if (error instanceof SyncError) throw error;
        throw new SyncError(0, "Stream interrupted");
      } finally {
        clearTimeout(silence);
        signal.removeEventListener("abort", abort);
      }
    },
  };
}
