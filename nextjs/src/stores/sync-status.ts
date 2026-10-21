import { create } from "zustand";

import { type Offer, type SyncStatus } from "~/api/sync/engine";

/** What the header shows about the session sync; written by the sync engine, never persisted. */
export const useSyncStatus = create<SyncStatus>()(() => ({
  state: "idle",
  reason: null,
  lastSyncAt: null,
  pending: 0,
  rejected: [],
  offers: [] as Offer[],
}));
