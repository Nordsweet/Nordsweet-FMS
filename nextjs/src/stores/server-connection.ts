import { create } from "zustand";

/** Three missing 15-second sync pings make the last server contact stale. */
export const SERVER_CONTACT_TIMEOUT_MS = 45_000;

/** Actual API responses and stream bytes only; cached data and retries cannot refresh this clock. */
export const useServerConnection = create<{
  lastContactAt: number | null;
  received: () => void;
}>((set) => ({
  lastContactAt: null,
  received: () => set({ lastContactAt: Date.now() }),
}));
