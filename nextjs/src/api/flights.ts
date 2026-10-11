import { createStore, del, entries, get, set } from "idb-keyval";

import { type Flight, flightSchema } from "~/data/flight";
import { flightFromNordRoute } from "~/data/nord";

import { loadDataset } from "./datasets";

// shortcut: one IndexedDB store on this device; replace with a sync queue once the backend exists.
const store =
  typeof indexedDB === "undefined"
    ? undefined
    : createStore("nordsweet-flights", "flights");
const MIGRATED_KEY = "legacy-saved-routes-imported";

/** Imports the legacy planner's saved routes (localStorage) once. */
async function migrateLegacy() {
  if (await get(MIGRATED_KEY, store)) return;
  const known = (await loadDataset("aircraft")).map((a) => a.id);
  let routes: unknown[] = [];
  try {
    routes = JSON.parse(
      localStorage.getItem("nordsweet.savedRoutes.v1") ?? "[]",
    ) as unknown[];
  } catch {
    // unreadable legacy data: nothing to import
  }
  for (const route of Array.isArray(routes) ? routes : []) {
    try {
      const flight = flightFromNordRoute(
        route as Parameters<typeof flightFromNordRoute>[0],
        known,
      );
      await set(flight.id, flight, store);
    } catch {
      // skip routes without coordinates
    }
  }
  await set(MIGRATED_KEY, true, store);
}

export async function listFlights(): Promise<Flight[]> {
  await migrateLegacy();
  return (await entries(store))
    .filter(([key]) => key !== MIGRATED_KEY)
    .map(([, value]) => flightSchema.safeParse(value))
    .filter((r) => r.success)
    .map((r) => r.data)
    .sort((a, b) => b.savedAt.localeCompare(a.savedAt));
}

export async function saveFlight(flight: Flight) {
  const saved = flightSchema.parse({
    ...flight,
    savedAt: new Date().toISOString(),
  });
  await set(saved.id, saved, store);
  return saved;
}

export async function removeFlight(id: string) {
  await del(id, store);
}
