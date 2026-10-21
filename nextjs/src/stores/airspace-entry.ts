import { create } from "zustand";
import {
  emptyEntryMonitor,
  observeEntryMonitor,
  type EntryMonitor,
  type EntryObservation,
} from "~/domain/airspace-entry";

/** Shared between Map/Fly; a new flight or reload requires fresh pilot acknowledgement. */
export const useAirspaceEntry = create<
  EntryMonitor & {
    observe: (session: string | null, observations: EntryObservation[]) => void;
    acknowledge: (key: string, cleared: boolean) => void;
  }
>()((set) => ({
  ...emptyEntryMonitor,
  observe: (session, observations) =>
    set((state) => observeEntryMonitor(state, session, observations)),
  acknowledge: (key, cleared) =>
    set((state) => ({
      visits: state.visits.map((v) =>
        v.key === key ? { ...v, cleared, dismissed: !cleared } : v,
      ),
    })),
}));
