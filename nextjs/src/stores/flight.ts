import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { type Flight, flightSchema, newFlight } from "~/data/flight";

type FlightStore = {
  flight: Flight;
  legacyCheckNeeded: boolean;
  finishLegacyMigration: (flight: Flight | null) => void;
  update: (patch: Partial<Flight>) => void;
  load: (flight: Flight) => void;
  reset: () => void;
};

/** The flight being planned; survives reloads and works offline. */
export const useFlight = create<FlightStore>()(
  persist(
    (set, get) => ({
      legacyCheckNeeded: true,
      finishLegacyMigration: (flight) => {
        if (get().legacyCheckNeeded)
          set({ legacyCheckNeeded: false, ...(flight ? { flight } : {}) });
      },
      flight: newFlight(),
      update: (patch) =>
        set((s) => ({
          legacyCheckNeeded: false,
          flight: {
            ...s.flight,
            ...patch,
            ...(patch.departure !== undefined &&
            patch.departure?.ident !== s.flight.departure?.ident
              ? {
                  departurePattern: patch.departurePattern ?? null,
                  departureRunway: patch.departureRunway ?? null,
                }
              : {}),
            ...(patch.destination !== undefined &&
            patch.destination?.ident !== s.flight.destination?.ident &&
            patch.trafficPattern === undefined
              ? { trafficPattern: null }
              : {}),
          },
        })),
      load: (flight) => set({ flight, legacyCheckNeeded: false }),
      reset: () => set({ flight: newFlight(), legacyCheckNeeded: false }),
    }),
    {
      name: "nordsweet.flight.v2",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: ({ flight }) => ({ flight }),
      merge: (persisted, current) => {
        const parsed = flightSchema.safeParse(
          (persisted as { flight?: unknown } | undefined)?.flight,
        );
        return parsed.success
          ? { ...current, legacyCheckNeeded: false, flight: parsed.data }
          : current;
      },
    },
  ),
);
