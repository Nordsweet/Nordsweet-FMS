import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { type CruiseMode } from "~/domain/cruise-performance";
import {
  type ClimbConfig,
  type FlightPhase,
  DEFAULT_CLIMB_CONFIG,
} from "~/domain/flight-phase";
import {
  type Sample,
  type TimerKey,
  type Timers,
  addEvent,
  duePhase,
  newTimers,
  stepTimers,
  toggleTimer,
} from "~/domain/flight-timers";
import { type LatLon, distanceNm } from "~/domain/geo";
import { type NavPoint, directTo, computeProgress } from "~/domain/progress";
import { type TrackPoint } from "~/domain/track";

/** Record a track point at most this often (5 s) unless the aircraft has not moved. */
const TRACK_INTERVAL_MS = 5000;

export type FlightConfig = {
  climb: ClimbConfig;
  /** Checklist flap callouts (legacy takeoffChecklistFlaps / landingChecklistFlaps). */
  takeoffFlaps: "takeoff" | "up";
  landingFlaps: "UP" | "APP" | "LDG";
  cruiseMode: CruiseMode;
};

const DEFAULT_CONFIG: FlightConfig = {
  climb: DEFAULT_CLIMB_CONFIG,
  takeoffFlaps: "takeoff",
  landingFlaps: "LDG",
  cruiseMode: "eco-time",
};

type InFlight = {
  /** null when no flight is in progress. */
  startedAt: string | null;
  route: NavPoint[];
  activeLeg: number;
  track: TrackPoint[];
  lastFredaAt: string | null;
  /** The flight view's phase tab and its CONFIG choices (legacy state). */
  phase: FlightPhase;
  config: FlightConfig;
  /** Block/Air Time, flight events and the pending automatic phase change. */
  timers: Timers;
  setPhase: (phase: FlightPhase) => void;
  /** A GPS sample: timers, events and automatic phase changes (legacy GPS detection). */
  observe: (
    sample: Sample,
    ctx: Omit<Parameters<typeof stepTimers>[2], "phase">,
  ) => void;
  /** Applies a delayed phase change once it is due. */
  tick: (now: number) => void;
  toggleTimer: (key: TimerKey) => void;
  addEvent: (name: string) => void;
  configure: (patch: Partial<FlightConfig>) => void;
  start: (route: NavPoint[]) => void;
  end: () => void;
  setActiveLeg: (leg: number) => void;
  goDirect: (targetIndex: number, position: LatLon) => void;
  goToPoint: (target: NavPoint, position: LatLon) => void;
  insertWaypoint: (index: number, point: NavPoint) => void;
  resumeRoute: (route: NavPoint[], position: LatLon) => void;
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
      phase: "taxiout",
      config: DEFAULT_CONFIG,
      timers: newTimers(),
      setPhase: (phase) => set({ phase }),
      observe: (sample, ctx) =>
        set((s) => {
          const { timers, phase } = stepTimers(s.timers, sample, {
            ...ctx,
            phase: s.phase,
          });
          // Legacy FREDA is due 30 min after take-off.
          const tookOff =
            timers.airTime.startedAt !== null &&
            s.timers.airTime.startedAt === null;
          return {
            timers,
            ...(phase ? { phase } : {}),
            ...(tookOff
              ? {
                  lastFredaAt: new Date(
                    timers.airTime.startedAt!,
                  ).toISOString(),
                }
              : {}),
          };
        }),
      tick: (now) =>
        set((s) => {
          const due = duePhase(s.timers, now);
          return due
            ? { timers: due.timers, ...(due.phase ? { phase: due.phase } : {}) }
            : s;
        }),
      toggleTimer: (key) =>
        set((s) => ({ timers: toggleTimer(s.timers, key, Date.now()) })),
      addEvent: (name) =>
        set((s) => ({ timers: addEvent(s.timers, name, Date.now()) })),
      configure: (patch) => set((s) => ({ config: { ...s.config, ...patch } })),
      start: (route) => {
        const now = new Date().toISOString();
        set({
          startedAt: now,
          route,
          activeLeg: 0,
          track: [],
          lastFredaAt: now,
          phase: "taxiout",
          timers: newTimers(),
        });
      },
      end: () => set({ startedAt: null }),
      setActiveLeg: (activeLeg) => set({ activeLeg }),
      goDirect: (targetIndex, position) =>
        set((s) => ({
          route: directTo(s.route, position, targetIndex),
          activeLeg: 0,
        })),
      goToPoint: (target, position) =>
        set((s) => {
          const index = s.route.findIndex(
            (p) =>
              p.ident === target.ident &&
              p.lat === target.lat &&
              p.lon === target.lon,
          );
          return {
            route: directTo(
              index >= 0 ? s.route : [target],
              position,
              Math.max(0, index),
            ),
            activeLeg: 0,
          };
        }),
      insertWaypoint: (index, point) =>
        set((s) => ({
          route: [...s.route.slice(0, index), point, ...s.route.slice(index)],
          activeLeg: index <= s.activeLeg ? s.activeLeg + 1 : s.activeLeg,
        })),
      resumeRoute: (route, position) =>
        set({
          route,
          activeLeg: computeProgress(route, position, 0)?.activeLeg ?? 0,
        }),
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
      partialize: ({
        startedAt,
        route,
        activeLeg,
        track,
        lastFredaAt,
        phase,
        config,
        timers,
      }) => ({
        startedAt,
        route,
        activeLeg,
        track,
        lastFredaAt,
        phase,
        config,
        timers,
      }),
    },
  ),
);
