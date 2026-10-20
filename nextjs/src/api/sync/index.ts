import { type QueryClient } from "@tanstack/react-query";
import { createStore, del, get, keys, set } from "idb-keyval";

import { useAircraftState } from "~/stores/aircraft-state";
import { useFlight } from "~/stores/flight";
import { useSettings } from "~/stores/settings";
import { useSyncStatus } from "~/stores/sync-status";

import { syncAdapters } from "./adapters";
import { createSyncApi, deviceId } from "./client";
import { type Collection } from "./contract";
import { createEngine, type Engine, type Kv } from "./engine";
import { startRunner } from "./runner";

export { deviceLabel } from "./device";
export { type LiveFlight } from "./adapters";

const OWNER_KEY = "nordsweet.syncOwner.v1";
const dbName = (username: string) => `nordsweet-sync-${username}`;

function idbKv(username: string): Kv {
  const store = createStore(dbName(username), "sync");
  return {
    get: <T>(key: string) => get<T>(key, store),
    set: (key, value) => set(key, value, store),
    del: (key) => del(key, store),
    keys: async () => (await keys(store)).map(String),
  };
}

/** Tabs of one browser share the local copy; a write by another tab reloads it here. */
function followOtherTabs() {
  const reload = new Map(
    [useSettings, useAircraftState, useFlight].map((store) => [
      store.persist.getOptions().name ?? "",
      () => void store.persist.rehydrate(),
    ]),
  );
  const onStorage = (event: StorageEvent) => {
    if (event.key) reload.get(event.key)?.();
  };
  window.addEventListener("storage", onStorage);
  return () => window.removeEventListener("storage", onStorage);
}

/** Cached answers that read the local copy must follow what changed it (sync in this tab or another). */
const staleQueries: Partial<Record<Collection, string[]>> = {
  flights: ["flights.list"],
  "custom-aircraft": ["aircraft.list", "aircraft.customDrafts"],
};

/** Another user's data must not reach this account: wipe the copy and the old sync state. */
async function claimDevice(username: string) {
  const owner = localStorage.getItem(OWNER_KEY);
  if (owner && owner !== username) {
    for (const adapter of syncAdapters) await adapter.clear();
    indexedDB.deleteDatabase(dbName(owner));
  }
  localStorage.setItem(OWNER_KEY, username);
}

async function begin(username: string) {
  await claimDevice(username);
  const device = deviceId();
  const api = createSyncApi({ device });
  const engine: Engine = createEngine({
    api,
    kv: idbKv(username),
    device,
    adapters: syncAdapters,
    onStatus: (patch) => useSyncStatus.setState(patch),
  });
  await engine.start();
  const stopRunner = startRunner({
    engine,
    api,
    subscribe: (onChange) => {
      const unsubscribe = syncAdapters.map((adapter) =>
        adapter.subscribe(() => onChange(adapter.collection)),
      );
      return () => unsubscribe.forEach((u) => u());
    },
  });
  return { engine, stop: stopRunner };
}

let active: Engine | null = null;
/** The pilot's answer to the flight-in-progress prompt. */
export const answerOffer = (
  collection: Collection,
  id: string,
  answer: "take" | "keep",
) => active?.resolve(collection, id, answer);

/**
 * Starts syncing for a signed-in user. One tab per browser and user holds the lock and does the
 * work (a second engine would race it on the queue); the rest take over when it closes.
 */
export function startSync(username: string, queryClient: QueryClient) {
  const stopFollowing = followOtherTabs();
  const stopRefreshing = syncAdapters.flatMap((adapter) => {
    const keys = staleQueries[adapter.collection];
    return keys
      ? [
          adapter.subscribe(() =>
            keys.forEach(
              (key) => void queryClient.invalidateQueries({ queryKey: [key] }),
            ),
          ),
        ]
      : [];
  });
  const cancelled = new AbortController();
  let end: (() => void) | undefined;
  const hold = async () => {
    const running = await begin(username);
    active = running.engine;
    await new Promise<void>((release) => {
      end = () => {
        running.stop();
        active = null;
        release();
      };
      if (cancelled.signal.aborted) end();
    });
  };
  const locked = navigator.locks
    ? navigator.locks.request(
        `nordsweet-sync:${username}`,
        { signal: cancelled.signal },
        hold,
      )
    : hold();
  locked.catch(() => undefined); // an aborted wait for the lock is a normal stop
  return () => {
    stopFollowing();
    stopRefreshing.forEach((stop) => stop());
    cancelled.abort();
    end?.();
    useSyncStatus.setState({
      state: "idle",
      reason: null,
      pending: 0,
      rejected: [],
      offers: [],
    });
  };
}
