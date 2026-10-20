import { afterEach, beforeEach, expect, it, vi } from "vitest";

import {
  type Collection,
  type SyncApi,
  SyncError,
  type SyncHint,
} from "./contract";
import { type Engine } from "./engine";
import { startRunner } from "./runner";

const hint: SyncHint = {
  collection: "settings",
  id: "main",
  rev: 2,
  seq: 2,
  device_id: "ipad-00001",
};

function setup(options: { failWith?: SyncError } = {}) {
  const sync = vi.fn(async (_: { pull?: boolean }) => {
    if (options.failWith) throw options.failWith;
    return { retryInMs: null as number | null };
  });
  const markDirty = vi.fn();
  const engine = { sync, markDirty } as unknown as Engine;
  const streams: {
    signal: AbortSignal;
    onHint: (h: SyncHint) => void;
    end: (e?: Error) => void;
  }[] = [];
  const api = {
    stream: (signal: AbortSignal, onHint: (h: SyncHint) => void) =>
      new Promise<void>((resolve, reject) => {
        streams.push({
          signal,
          onHint,
          end: (e) => (e ? reject(e) : resolve()),
        });
        signal.addEventListener("abort", () => resolve());
      }),
  } as unknown as SyncApi;
  let notify: (c: Collection) => void = () => undefined;
  let wake: () => void = () => undefined;
  const unsubscribed = vi.fn();
  const stop = startRunner({
    engine,
    api,
    subscribe: (cb) => {
      notify = cb;
      return unsubscribed;
    },
    wake: (cb) => {
      wake = cb;
      return () => undefined;
    },
  });
  return {
    sync,
    markDirty,
    streams,
    stop,
    unsubscribed,
    notify: (c: Collection) => notify(c),
    wake: () => wake(),
  };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

it("pulls once, then opens the stream, and pulls again on every hint", async () => {
  const r = setup();
  await vi.advanceTimersByTimeAsync(0);
  expect(r.sync).toHaveBeenCalledTimes(1);
  expect(r.sync).toHaveBeenLastCalledWith({ pull: true });
  expect(r.streams).toHaveLength(1);
  r.streams[0]!.onHint(hint);
  await vi.advanceTimersByTimeAsync(0);
  expect(r.sync).toHaveBeenCalledTimes(2);
  r.stop();
});

it("pulls once after a reconnect, with backoff", async () => {
  const r = setup();
  await vi.advanceTimersByTimeAsync(0);
  r.streams[0]!.end(new SyncError(0, "dropped"));
  await vi.advanceTimersByTimeAsync(999);
  expect(r.streams).toHaveLength(1);
  await vi.advanceTimersByTimeAsync(1);
  expect(r.sync).toHaveBeenCalledTimes(2);
  expect(r.streams).toHaveLength(2);
  r.stop();
});

it("waking up (online, tab visible) reconnects at once and pulls", async () => {
  const r = setup();
  await vi.advanceTimersByTimeAsync(0);
  r.wake();
  await vi.advanceTimersByTimeAsync(0);
  expect(r.streams[0]!.signal.aborted).toBe(true);
  expect(r.streams).toHaveLength(2);
  expect(r.sync.mock.calls.length).toBeGreaterThanOrEqual(2);
  r.stop();
});

it("a local change marks the collection and pushes shortly after, without pulling", async () => {
  const r = setup();
  await vi.advanceTimersByTimeAsync(0);
  r.sync.mockClear();
  r.notify("settings");
  r.notify("settings");
  expect(r.markDirty).toHaveBeenCalledWith("settings");
  await vi.advanceTimersByTimeAsync(1500);
  expect(r.sync).toHaveBeenCalledTimes(1);
  expect(r.sync).toHaveBeenCalledWith({ pull: false });
  r.stop();
});

it("retries a failed run with backoff and comes back after a Retry-After", async () => {
  const r = setup();
  await vi.advanceTimersByTimeAsync(0);
  r.sync.mockRejectedValueOnce(new SyncError(500, "boom"));
  r.streams[0]!.onHint(hint);
  await vi.advanceTimersByTimeAsync(0);
  const calls = r.sync.mock.calls.length;
  await vi.advanceTimersByTimeAsync(1000);
  expect(r.sync.mock.calls.length).toBe(calls + 1);
  r.sync.mockResolvedValueOnce({ retryInMs: 12_000 });
  r.notify("flights");
  await vi.advanceTimersByTimeAsync(1500);
  const after = r.sync.mock.calls.length;
  await vi.advanceTimersByTimeAsync(12_000);
  expect(r.sync.mock.calls.length).toBe(after + 1);
  r.stop();
});

it("stop aborts the stream and unsubscribes; a 401 stops everything", async () => {
  const r = setup();
  await vi.advanceTimersByTimeAsync(0);
  r.stop();
  expect(r.streams[0]!.signal.aborted).toBe(true);
  expect(r.unsubscribed).toHaveBeenCalled();

  const s = setup({ failWith: new SyncError(401, "no token") });
  await vi.advanceTimersByTimeAsync(0);
  await vi.advanceTimersByTimeAsync(60_000);
  expect(s.sync).toHaveBeenCalledTimes(1);
  expect(s.unsubscribed).toHaveBeenCalled();
});
