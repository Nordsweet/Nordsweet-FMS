import { useAircraftState } from "~/stores/aircraft-state";
import { useInspiration } from "~/stores/inspiration";
import { useSettings } from "~/stores/settings";
import { type SourceStatus, useUserDataStatus } from "~/stores/userdata-status";

import { listFlights } from "../flights";
import { readCustomDrafts } from "../aircraft";
import { createEngine, type Engine } from "../sync/engine";
import { idbKv } from "../sync/kv";
import { startRunner } from "../sync/runner";
import { startAirframeSync } from "./airframes";
import { adaptersByCollection, documentAdapters } from "./adapters";
import { createUserDataApi, type UserDataApi } from "./client";
import { type DocumentCollection, documentSyncApi } from "./documents";
import { startFlightLogs } from "./flight-logs";
import {
  aircraftItems,
  airframeStateItems,
  flightItems,
  importLocalData,
  settingsBody,
  wasImported,
} from "./import";
import { failure, startFavoritesSync, startSettingsSync } from "./preferences";
import { wakeOnReturn } from "./wake";

export { documentAdapters } from "./adapters";
export { createUserDataApi } from "./client";

const reportTo = (name: string) => (patch: Partial<SourceStatus>) =>
  useUserDataStatus.getState().report(name, patch);
const kvName = (username: string, source: string) =>
  `nordsweet-userdata-${username}-${source}`;

/** Another user signed in on this device: their copy and sync state must not reach this account. */
export async function clearUserData(previousOwner: string) {
  for (const adapter of documentAdapters) {
    await adapter.clear();
    indexedDB.deleteDatabase(kvName(previousOwner, adapter.collection));
  }
  indexedDB.deleteDatabase(`nordsweet-flight-logs-${previousOwner}`);
  useAircraftState.setState({ states: {}, covered: {} });
  useInspiration.setState({ favorites: [] });
  for (const key of Object.keys(localStorage))
    if (key.includes(`.${previousOwner}.`) && key.startsWith("nordsweet."))
      localStorage.removeItem(key);
}

/**
 * Runs one document collection's sync: the engine of the session sync (queue, three-way merge,
 * `409` handling), with the server's version as its `rev`. Pull first, push after; another pull
 * once something was pushed. Other devices are picked up on start, focus and reconnect.
 */
async function startDocuments(
  collection: DocumentCollection,
  username: string,
  api: UserDataApi,
) {
  const adapter = adaptersByCollection[collection];
  const source = reportTo(collection);
  const syncApi = documentSyncApi(collection, api);
  let pushed = false;
  const put = syncApi.put;
  syncApi.put = async (...args) => {
    const result = await put(...args);
    pushed = true;
    return result;
  };
  const engine: Engine = createEngine({
    api: syncApi,
    kv: idbKv(kvName(username, collection)),
    // Rows carry no device id (it is ""), so no remote row is mistaken for this device's own write.
    device: "userdata",
    adapters: [adapter],
    onStatus: ({ state, reason, pending, rejected }) =>
      source({
        ...(state ? { state } : {}),
        ...(reason !== undefined ? { reason } : {}),
        ...(pending !== undefined ? { pending } : {}),
        ...(rejected ? { rejected } : {}),
      }),
  });
  await engine.start();
  const stop = startRunner({
    engine: {
      ...engine,
      sync: async () => {
        pushed = false;
        const result = await engine.sync({ pull: true });
        if (pushed) await engine.sync({ pull: true });
        return result;
      },
    },
    api: syncApi,
    subscribe: (onChange) =>
      adapter.subscribe(() => onChange(adapter.collection)),
    wake: wakeOnReturn,
  });
  return stop;
}
/** Uploads this device's data once per user (never overwrites the server), then lets the server copy win. */
async function importOnce(username: string, api: UserDataApi) {
  if (wasImported(username)) return;
  const status = reportTo("import");
  status({ state: "syncing", reason: null });
  try {
    const rejected = await importLocalData({
      api,
      username,
      local: {
        flights: flightItems(await listFlights()),
        custom_aircraft: aircraftItems(readCustomDrafts()),
        airframe_states: airframeStateItems(useAircraftState.getState().states),
        settings: settingsBody(useSettings.getState()),
        favorites: useInspiration.getState().favorites,
      },
    });
    if (rejected?.length)
      useUserDataStatus.getState().setImportRejected(rejected);
    status({ state: "idle", reason: null });
  } catch (error) {
    // The flag stays unset: the (idempotent) import is repeated at the next start.
    status(failure(error));
  }
}

/**
 * Starts the typed user-data sync for a signed-in user: the first-sign-in import, then flights and
 * custom aircraft (versioned documents), settings, favorites, airframe readings and finished flight logs.
 * Call it from the one tab that holds the sync lock (`api/sync`). Returns the function that stops it.
 */
export function startUserData(
  username: string,
  { onLogPosted = () => undefined }: { onLogPosted?: () => void } = {},
) {
  const api = createUserDataApi();
  const status = useUserDataStatus.getState();
  const stops: (() => void)[] = [];
  let cancelled = false;
  void (async () => {
    await importOnce(username, api);
    if (cancelled) return;
    for (const collection of Object.keys(
      adaptersByCollection,
    ) as DocumentCollection[]) {
      const stop = await startDocuments(collection, username, api);
      if (cancelled) return stop();
      stops.push(stop);
    }
    stops.push(
      startSettingsSync({ api, username, report: reportTo("settings") }),
      startFavoritesSync({ api, username, report: reportTo("favorites") }),
      startAirframeSync({
        api,
        username,
        report: reportTo("airframes"),
        notify: status.notify,
      }),
      startFlightLogs({
        api,
        username,
        report: reportTo("flight-logs"),
        notify: status.notify,
        posted: onLogPosted,
      }),
    );
  })();
  return () => {
    cancelled = true;
    stops.forEach((stop) => stop());
    useUserDataStatus.getState().reset();
  };
}
