"use client";

import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { del, get, set } from "idb-keyval";
import { useEffect, useState, useSyncExternalStore } from "react";

import { TooltipProvider } from "~/components/ui/tooltip";
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
      persistOptions={{ persister, maxAge: DAY_MS, buster: "1" }}
    >
      <TooltipProvider>{mounted ? children : null}</TooltipProvider>
    </PersistQueryClientProvider>
  );
}
