"use client";

import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import {
  QueryClient,
  defaultShouldDehydrateQuery,
} from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { del, get, set } from "idb-keyval";
import { useEffect, useState, useSyncExternalStore } from "react";

import { TooltipProvider } from "~/components/ui/tooltip";
import { api } from "~/api";
import { useFlight } from "~/stores/flight";
import { useSettings } from "~/stores/settings";

const DAY_MS = 24 * 60 * 60 * 1000;

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      // Offline-first: serve cached data when there is no network, keep it for a day.
      queries: {
        retry: 1, // offline should show "unavailable" quickly, not after 3 back-off retries
        gcTime: DAY_MS,
        staleTime: 60_000,
        networkMode: "offlineFirst",
      },
      mutations: { networkMode: "offlineFirst" },
    },
  });
}

const subscribeNever = () => () => undefined;

const persister = createAsyncStoragePersister({
  storage: { getItem: get, setItem: set, removeItem: del },
  key: "nordsweet.query-cache.v1",
});

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(createQueryClient);
  // Everything below depends on device storage (settings, IndexedDB), so render on the client only.
  const mounted = useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false,
  );
  const language = useSettings((s) => s.language);

  useEffect(() => {
    if (!useFlight.getState().legacyCheckNeeded) return;
    void api.flights.legacyDraft
      .call(undefined)
      .then((flight) => useFlight.getState().finishLegacyMigration(flight))
      .catch(() => useFlight.getState().finishLegacyMigration(null));
  }, []);
  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);
  useEffect(() => {
    // Shared with the legacy screens; precaches the whole export for offline use.
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js", { updateViaCache: "none" })
        .catch((error: unknown) =>
          console.error("Service worker registration failed", error),
        );
    }
  }, []);

  return (
    <PersistQueryClientProvider
      client={queryClient}
      // A new release discards data cached by the previous one (its shapes may have changed).
      persistOptions={{
        persister,
        dehydrateOptions: {
          // DEM Float32Arrays have their own structured-clone IndexedDB cache.
          shouldDehydrateQuery: (query) =>
            query.queryKey[0] !== "terrain.region" &&
            query.queryKey[0] !== "charts.pdf" &&
            query.queryKey[0] !== "atisCalls.account" &&
            // Finished flights hold GPS tracks: read from the server, never kept in the offline cache.
            !String(query.queryKey[0]).startsWith("flightLogs.") &&
            defaultShouldDehydrateQuery(query),
        },
        maxAge: DAY_MS,
        buster: process.env.BUILD_ID ?? "dev",
      }}
    >
      <TooltipProvider>{mounted ? children : null}</TooltipProvider>
    </PersistQueryClientProvider>
  );
}
