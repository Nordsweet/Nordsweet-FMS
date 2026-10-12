import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { type LatLon, distanceNm } from "~/domain/geo";
import { type NavPoint } from "~/domain/navlog";
import { directTo } from "~/domain/progress";
import { type TrackPoint } from "~/domain/track";

/** Record a track point at most this often (5 s) unless the aircraft has not moved. */
const TRACK_INTERVAL_MS = 5000;

type InFlight = {
  /** null when no flight is in progress. */
  startedAt: string | null;
  route: NavPoint[];
  activeLeg: number;
  track: TrackPoint[];
  lastFredaAt: string | null;
  start: (route: NavPoint[]) => void;
  end: () => void;
  setActiveLeg: (leg: number) => void;
  goDirect: (targetIndex: number, position: LatLon) => void;
  record: (point: TrackPoint) => void;
  confirmFreda: () => void;
};

/** The flight in progress; persisted so a reload in the air keeps the leg, track and timers. */
export const useInFlight = create<InFlight>()(
  persist(
    (set) => ({
      startedAt: null,
      route: [],
      activeLeg: 0,
      track: [],
      lastFredaAt: null,
      start: (route) => {
        const now = new Date().toISOString();
        set({
          startedAt: now,
          route,
          activeLeg: 0,
          track: [],
          lastFredaAt: now,
        });
      },
      end: () => set({ startedAt: null }),
      setActiveLeg: (activeLeg) => set({ activeLeg }),
      goDirect: (targetIndex, position) =>
        set((s) => ({
          route: directTo(s.route, position, targetIndex),
          activeLeg: 0,
        })),
      record: (point) =>
        set((s) => {
          const last = s.track.at(-1);
          const due =
            !last ||
            Date.parse(point.time) - Date.parse(last.time) >= TRACK_INTERVAL_MS;
          return due && (!last || distanceNm(last, point) > 0.005)
            ? { track: [...s.track, point] }
            : s;
        }),
      confirmFreda: () => set({ lastFredaAt: new Date().toISOString() }),
    }),
    {
      name: "nordsweet.inflight.v1",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: ({ startedAt, route, activeLeg, track, lastFredaAt }) => ({
        startedAt,
        route,
        activeLeg,
        track,
        lastFredaAt,
      }),
    },
  ),
);
