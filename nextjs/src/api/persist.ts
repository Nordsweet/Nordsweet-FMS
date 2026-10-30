import { defaultShouldDehydrateQuery, type Query } from "@tanstack/react-query";

/**
 * Queries whose answer is cheaper to get again than to keep in the offline copy. The copy is rewritten
 * whole after any query update, so every byte in it is paid for again and again.
 */
const NOT_PERSISTED = new Set([
  // DEM Float32Arrays have their own structured-clone IndexedDB cache.
  "terrain.region",
  "charts.pdf",
  "atisCalls.account",
  // Bundled aircraft plus the pilot's own, re-read from local storage on every mount.
  "aircraft.list",
  // Bundled points plus the API's VFR points, which have their own offline cache (remote-cache.ts).
  "navpoints.list",
]);

/**
 * What goes into the persisted query cache. Bundled reference data (`staleTime: Infinity`) is left out:
 * the service worker already holds the files. Finished flights hold GPS tracks: read from the server,
 * never kept in the offline cache.
 */
export function shouldPersistQuery(query: Query) {
  const key = String(query.queryKey[0]);
  return (
    !NOT_PERSISTED.has(key) &&
    !key.startsWith("flightLogs.") &&
    // `staleTime` is an observer option the library does not put in the query's type, but it is there.
    (query.options as { staleTime?: unknown }).staleTime !== Infinity &&
    defaultShouldDehydrateQuery(query)
  );
}
