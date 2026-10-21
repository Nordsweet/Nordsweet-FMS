import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  emptyEngineTimers,
  observeEngineTimers,
  type EngineTimers,
} from "~/domain/engine-timers";

type EngineTimerStore = EngineTimers & {
  observe: (input: Parameters<typeof observeEngineTimers>[1]) => void;
  startWarm: (session: string, now: number) => void;
};

/** Warm-up survives reload; cooling starts from a newly observed stop after reload. */
export const useEngineTimers = create<EngineTimerStore>()(
  persist(
    (set) => ({
      ...emptyEngineTimers,
      observe: (input) =>
        set((state) => {
          const next = observeEngineTimers(state, input);
          return next.session === state.session &&
            next.coolStartedAt === state.coolStartedAt &&
            next.stationaryObservedAt === state.stationaryObservedAt
            ? state
            : next;
        }),
      startWarm: (session, now) =>
        set((state) => ({
          ...(state.session === session
            ? {}
            : { ...emptyEngineTimers, session }),
          warmStartedAt: now,
        })),
    }),
    {
      name: "nordsweet.engine-timers.v1",
      partialize: ({ session, warmStartedAt }) => ({ session, warmStartedAt }),
    },
  ),
);
