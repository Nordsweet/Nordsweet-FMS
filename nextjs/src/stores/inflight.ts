import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import {
  type CruiseMode,
  type ManualSetting,
} from "~/domain/cruise-performance";
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
  isRunning,
  newTimers,
  stepTimers,
  toggleTimer,
  utilityCountdown,
  utilityDone,
  utilityMain,
} from "~/domain/flight-timers";
import { type LatLon, distanceNm } from "~/domain/geo";
import { type NavPoint, directTo, computeProgress } from "~/domain/progress";
import { type TrafficPattern } from "~/data/traffic-pattern";
import {
  trafficPatternGeometry,
  activeRouteWithTrafficPattern,
  trafficPatternReport,
  type PatternReport,
} from "~/domain/traffic-pattern";
import { type TrackPoint } from "~/domain/track";
import { type TurnPerformance } from "~/domain/fly-by";

/** Record a track point at most this often (5 s) unless the aircraft has not moved. */
const TRACK_INTERVAL_MS = 5000;
export const FREDA_INTERVAL_MS = 30 * 60_000;

export type FlightConfig = {
  climb: ClimbConfig;
  /** Checklist flap callouts (legacy takeoffChecklistFlaps / landingChecklistFlaps). */
  takeoffFlaps: "takeoff" | "up";
  landingFlaps: "UP" | "APP" | "LDG";
  /** ECO TIME / ECO DISTANCE, or the manual RPM/MAP below (legacy CONFIG digit buttons). */
  cruiseMode: CruiseMode | "manual";
  manual: ManualSetting;
};

/** The cruise lookup mode for the CONFIG choice. */
export const cruiseModeOf = (config: FlightConfig) =>
  config.cruiseMode === "manual" ? config.manual : config.cruiseMode;

const DEFAULT_CONFIG: FlightConfig = {
  climb: DEFAULT_CLIMB_CONFIG,
  takeoffFlaps: "takeoff",
  landingFlaps: "LDG",
  cruiseMode: "eco-time",
  // Legacy defaults: RPM 1·9·0, MAP 2·0·.0.
  manual: { rpm: 1900, mapInHg: 20 },
};

type InFlight = {
  /** null when no flight is in progress. */
  startedAt: string | null;
  /** Airport selected with Divert, retained across direct-to fixes and reloads. */
  divertAirport: string | null;
  route: NavPoint[];
  trafficPattern: TrafficPattern | null;
  departurePattern: TrafficPattern | null;
  patternReports: PatternReport[];
  patternNotice: { report: PatternReport; expiresAt: number } | null;
  patternPreviousFix: (LatLon & { time: string }) | null;
  joinTrafficPattern: (
    pattern: TrafficPattern,
    position?: LatLon | null,
  ) => void;
  clearTrafficPattern: (
    operation?: "join" | "leave",
    position?: LatLon | null,
  ) => void;
  observePattern: (
    position: LatLon & { time: string },
    performance?: TurnPerformance,
  ) => void;
  dismissPatternNotice: () => void;
  activeLeg: number;
  track: TrackPoint[];
  /** Next FREDA check (legacy: 30 min after take-off, then every 30 min); null before take-off. */
  fredaDueAt: number | null;
  fredaOpen: boolean;
  /** OPTIONS "Debug with GPX": shows the replay dock. */
  replayEnabled: boolean;
  setReplayEnabled: (on: boolean) => void;
  openFreda: () => void;
  /** Closing a due check without completing it postpones it to the next 30 min step. */
  closeFreda: () => void;
  completeFreda: (fuelL: number) => void;
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
  /** Applies a delayed phase change once it is due; true when a countdown just finished. */
  tick: (now: number) => boolean;
  utilityMain: (index: 0 | 1) => void;
  utilityCountdown: (index: 0 | 1, minutes: number) => void;
  toggleTimer: (key: TimerKey) => void;
  addEvent: (name: string) => void;
  configure: (patch: Partial<FlightConfig>) => void;
  start: (
    route: NavPoint[],
    pattern?: TrafficPattern | null,
    departurePattern?: TrafficPattern | null,
  ) => void;
  end: () => void;
  setActiveLeg: (leg: number) => void;
  goDirect: (targetIndex: number, position: LatLon) => void;
  goToPoint: (target: NavPoint, position: LatLon) => void;
  /** Replace the remaining route with the diversion airport, retaining flight timers and track. */
  divertTo: (airport: NavPoint, position: LatLon) => void;
  insertWaypoint: (index: number, point: NavPoint) => void;
  /** Remove one fix and keep the current navigation leg valid without resetting flight state. */
  removeWaypoint: (index: number) => void;
  resumeRoute: (
    route: NavPoint[],
    position: LatLon,
    performance?: TurnPerformance,
  ) => void;
  record: (point: TrackPoint) => void;
};

/** The flight in progress; persisted so a reload in the air keeps the leg, track and timers. */
export const useInFlight = create<InFlight>()(
  persist(
    (set, get) => ({
      startedAt: null,
      divertAirport: null,
      route: [],
      trafficPattern: null,
      departurePattern: null,
      patternReports: [],
      patternNotice: null,
      patternPreviousFix: null,
      joinTrafficPattern: (trafficPattern, position) =>
        set((s) => ({
          ...(trafficPattern.operation === "leave"
            ? { departurePattern: trafficPattern }
            : {
                trafficPattern,
                divertAirport: trafficPattern.airport.ident,
                patternReports: [],
                patternNotice: null,
                patternPreviousFix: null,
              }),
          ...activeRouteWithTrafficPattern(
            s.route,
            s.activeLeg,
            trafficPattern,
            position ?? s.track.at(-1) ?? null,
          ),
        })),
      clearTrafficPattern: (operation = "join", position) =>
        set((s) => {
          const removed = s.route.filter(
            (p) => p.patternId && (p.patternOperation ?? "join") === operation,
          );
          const target = s.route[s.activeLeg + 1];
          const route = s.route.filter((p) => !removed.includes(p));
          if (
            operation === "leave" &&
            s.departurePattern &&
            removed.includes(s.route[0]!)
          )
            route.unshift({ ...s.departurePattern.airport });
          if (operation === "join" && s.trafficPattern)
            route.push({ ...s.trafficPattern.airport });
          // Once the target is in the removed arrival, continue from ownship rather than an old inbound leg.
          if (
            operation === "join" &&
            s.trafficPattern &&
            target &&
            removed.includes(target)
          ) {
            const current = position ?? s.track.at(-1) ?? s.route[s.activeLeg];
            return {
              route: [
                ...(current
                  ? [{ ident: "DCT", lat: current.lat, lon: current.lon }]
                  : []),
                { ...s.trafficPattern.airport },
              ],
              activeLeg: 0,
              trafficPattern: null,
              patternReports: [],
              patternNotice: null,
              patternPreviousFix: null,
            };
          }
          return {
            route,
            activeLeg: Math.max(
              0,
              Math.min(
                target && !removed.includes(target)
                  ? route.indexOf(target) - 1
                  : s.activeLeg,
                route.length - 2,
              ),
            ),
            ...(operation === "leave"
              ? { departurePattern: null }
              : {
                  trafficPattern: null,
                  patternReports: [],
                  patternNotice: null,
                  patternPreviousFix: null,
                }),
          };
        }),
      dismissPatternNotice: () => set({ patternNotice: null }),
      observePattern: (position, performance) =>
        set((s) => {
          if (!s.startedAt || !s.trafficPattern) return s;
          if (s.patternPreviousFix?.time === position.time) return s;
          const elapsed = s.patternPreviousFix
            ? Date.parse(position.time) - Date.parse(s.patternPreviousFix.time)
            : Infinity;
          const previous =
            elapsed > 0 && elapsed <= 30000 ? s.patternPreviousFix : null;
          const report = trafficPatternReport(
            s.trafficPattern,
            s.route,
            s.activeLeg,
            position,
            previous,
            s.patternReports,
            performance,
          );
          return {
            patternPreviousFix: position,
            ...(report
              ? {
                  patternReports: [...s.patternReports, report],
                  patternNotice: { report, expiresAt: Date.now() + 10000 },
                }
              : {}),
          };
        }),
      activeLeg: 0,
      track: [],
      fredaDueAt: null,
      fredaOpen: false,
      replayEnabled: false,
      setReplayEnabled: (replayEnabled) => set({ replayEnabled }),
      openFreda: () => set({ fredaOpen: true }),
      closeFreda: () =>
        set((s) => {
          let due = s.fredaDueAt;
          const now = Date.now();
          while (due !== null && due <= now) due += FREDA_INTERVAL_MS;
          return { fredaOpen: false, fredaDueAt: due };
        }),
      completeFreda: (fuelL) =>
        set((s) => {
          const now = Date.now();
          const takeoff = s.timers.airTime.startedAt;
          return {
            fredaOpen: false,
            fredaDueAt:
              takeoff !== null
                ? takeoff +
                  (Math.floor(Math.max(0, now - takeoff) / FREDA_INTERVAL_MS) +
                    1) *
                    FREDA_INTERVAL_MS
                : now + FREDA_INTERVAL_MS,
            timers: addEvent(
              s.timers,
              `FREDA Fuel check — ${Math.round(fuelL)} L`,
              now,
            ),
          };
        }),
      phase: "taxiout",
      config: DEFAULT_CONFIG,
      timers: newTimers(),
      setPhase: (phase) => set({ phase }),
      observe: (sample, ctx) =>
        set((s) => {
          // Delayed phase changes run on sample time too (a GPX replay runs ahead of the clock).
          const due = duePhase(s.timers, sample.at);
          const current = due?.phase ?? s.phase;
          const step = stepTimers(due?.timers ?? s.timers, sample, {
            ...ctx,
            phase: current,
          });
          const { timers } = step;
          const phase = step.phase ?? (current !== s.phase ? current : null);
          // Legacy FREDA is due 30 min after take-off.
          const tookOff =
            timers.airTime.startedAt !== null &&
            s.timers.airTime.startedAt === null;
          return {
            timers,
            ...(phase ? { phase } : {}),
            ...(tookOff
              ? { fredaDueAt: timers.airTime.startedAt! + FREDA_INTERVAL_MS }
              : {}),
          };
        }),
      tick: (now) => {
        const s = get();
        const due = duePhase(s.timers, now);
        const done = s.timers.utility.map((u) => utilityDone(u, now));
        // Legacy maybePromptFredaCheck: open the check when due while airborne.
        if (
          !s.fredaOpen &&
          s.fredaDueAt !== null &&
          now >= s.fredaDueAt &&
          isRunning(s.timers.airTime)
        )
          set({ fredaOpen: true });
        if (!due && !done.some(Boolean)) return false;
        const timers = due?.timers ?? s.timers;
        set({
          timers: {
            ...timers,
            utility: timers.utility.map((u, i) =>
              done[i] ? { ...u, mode: "complete" as const, stoppedAt: now } : u,
            ) as Timers["utility"],
          },
          ...(due?.phase ? { phase: due.phase } : {}),
        });
        return done.some(Boolean);
      },
      utilityMain: (index) =>
        set((s) => {
          const utility = [...s.timers.utility] as Timers["utility"];
          utility[index] = utilityMain(utility[index], Date.now());
          return { timers: { ...s.timers, utility } };
        }),
      utilityCountdown: (index, minutes) =>
        set((s) => {
          const utility = [...s.timers.utility] as Timers["utility"];
          utility[index] = utilityCountdown(minutes, Date.now());
          return { timers: { ...s.timers, utility } };
        }),
      toggleTimer: (key) =>
        set((s) => {
          const timers = toggleTimer(s.timers, key, Date.now());
          const tookOff =
            key === "airTime" && timers.airTime.stoppedAt === null;
          return {
            timers,
            ...(tookOff
              ? { fredaDueAt: timers.airTime.startedAt! + FREDA_INTERVAL_MS }
              : {}),
          };
        }),
      addEvent: (name) =>
        set((s) => ({ timers: addEvent(s.timers, name, Date.now()) })),
      configure: (patch) => set((s) => ({ config: { ...s.config, ...patch } })),
      start: (route, trafficPattern = null, departurePattern = null) => {
        const now = new Date().toISOString();
        set({
          startedAt: now,
          trafficPattern,
          departurePattern,
          patternReports: [],
          patternNotice: null,
          patternPreviousFix: null,
          divertAirport: null,
          route,
          activeLeg: 0,
          track: [],
          fredaDueAt: null,
          fredaOpen: false,
          phase: "taxiout",
          timers: newTimers(),
        });
      },
      end: () =>
        set({
          startedAt: null,
          departurePattern: null,
          divertAirport: null,
          trafficPattern: null,
          patternNotice: null,
          patternPreviousFix: null,
        }),
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
      divertTo: (airport, position) =>
        set({
          departurePattern: null,
          route: directTo([airport], position, 0),
          divertAirport: airport.ident,
          trafficPattern: null,
          patternNotice: null,
          patternReports: [],
          patternPreviousFix: null,
          activeLeg: 0,
        }),
      insertWaypoint: (index, point) =>
        set((s) => ({
          route: [...s.route.slice(0, index), point, ...s.route.slice(index)],
          activeLeg: index <= s.activeLeg ? s.activeLeg + 1 : s.activeLeg,
        })),
      removeWaypoint: (index) =>
        set((s) => {
          if (!Number.isInteger(index) || index < 0 || index >= s.route.length)
            return s;
          const route = s.route.filter((_, i) => i !== index);
          return {
            route,
            activeLeg: Math.max(
              0,
              Math.min(
                route.length - 2,
                s.activeLeg - (index <= s.activeLeg ? 1 : 0),
              ),
            ),
          };
        }),
      resumeRoute: (route, position, performance) =>
        set({
          route,
          divertAirport: null,
          activeLeg:
            computeProgress(route, position, 0, performance)?.activeLeg ?? 0,
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
    }),
    {
      name: "nordsweet.inflight.v1",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      // Flights saved by an older release lack newer timer and CONFIG fields.
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<InFlight>;
        const departure = p.departurePattern;
        const departureEnd = departure
          ? (p.route
              ?.map((point) => point.patternId)
              .lastIndexOf(departure.id) ?? -1)
          : -1;
        const departureGeometry = departure
          ? trafficPatternGeometry(departure, p.route?.[departureEnd + 1])
          : null;
        const oldOverhead =
          departure?.operation === "leave" &&
          departure.join === "overhead" &&
          p.route?.some(
            (point) =>
              point.patternId === departure.id &&
              point.ident === `TPD1/${departure.airport.ident}`,
          ) &&
          !p.route.some(
            (point) =>
              point.patternId === departure.id &&
              point.ident === `TPD2/${departure.airport.ident}`,
          );
        const upgradeOverhead =
          oldOverhead &&
          p.route?.[0]?.patternId === departure?.id &&
          p.route[0].ident ===
            `${departure.airport.ident} THR${departure.runway.designator}` &&
          p.route[1]?.patternId === departure.id &&
          p.route[1].ident === `TPD1/${departure.airport.ident}`;
        const patternPoints = new Map(
          [p.departurePattern, p.trafficPattern].flatMap((pattern) =>
            pattern
              ? (pattern === departure
                  ? departureGeometry!
                  : trafficPatternGeometry(pattern)
                ).points.map((point) => [point.ident, point] as const)
              : [],
          ),
        );
        let route =
          p.route?.map((point) =>
            !(
              oldOverhead &&
              !upgradeOverhead &&
              point.patternId === departure?.id
            ) &&
            (point.patternId === p.trafficPattern?.id ||
              point.patternId === p.departurePattern?.id) &&
            patternPoints.has(point.ident)
              ? { ...point, ...patternPoints.get(point.ident)! }
              : point,
          ) ?? current.route;
        const target = p.route?.[(p.activeLeg ?? 0) + 1];
        // Old Overhead departures contained only THR → ARP. Upgrade the complete
        // departure prefix, preserving any Direct-to that intentionally skipped it.
        if (upgradeOverhead && departureGeometry)
          route.splice(0, 2, ...departureGeometry.points);
        if (departure && departureGeometry) {
          const canonicalExit =
            trafficPatternGeometry(departure).points.at(-1)!;
          const exit = route.findIndex(
            (point) =>
              point.patternId === departure.id &&
              point.ident === canonicalExit.ident,
          );
          // Add/refresh derived exit guides only if the selected exit is still in
          // the route. Direct-to legs that skipped the pattern remain untouched.
          if (exit >= 0) {
            route = route.filter(
              (point) =>
                point.patternId !== departure.id ||
                !point.ident.startsWith("TPX"),
            );
            route.splice(
              exit + 1,
              0,
              ...departureGeometry.points.filter((point) =>
                point.ident.startsWith("TPX"),
              ),
            );
          }
        }
        const arrival = p.trafficPattern;
        const threshold = arrival
          ? patternPoints.get(
              `${arrival.airport.ident} THR${arrival.runway.designator}`,
            )
          : null;
        const arpIndex = arrival
          ? route.findIndex(
              (point) =>
                point.patternId === arrival.id &&
                point.ident === arrival.airport.ident,
            )
          : -1;
        // Older saved arrivals used the airport ident at the threshold. Keep that threshold before the new ARP endpoint.
        if (
          arrival &&
          threshold &&
          arpIndex > 0 &&
          route.some(
            (point) =>
              point.patternId === arrival.id && point.ident.startsWith("TP"),
          ) &&
          !route.some(
            (point) =>
              point.ident === threshold.ident && point.patternId === arrival.id,
          )
        )
          route.splice(arpIndex, 0, threshold);
        let targetOccurrence =
          p.route
            ?.slice(0, (p.activeLeg ?? 0) + 2)
            .filter(
              (point) =>
                point.ident === target?.ident &&
                point.patternId === target?.patternId,
            ).length ?? 0;
        const targetIndex = target
          ? route.findIndex(
              (point) =>
                point.ident === target.ident &&
                point.patternId === target.patternId &&
                --targetOccurrence === 0,
            )
          : -1;
        return {
          ...current,
          ...p,
          // Regenerate derived vertices when fixed pattern dimensions change between releases.
          route,
          activeLeg:
            targetIndex >= 0
              ? Math.max(0, targetIndex - 1)
              : Math.max(
                  0,
                  Math.min(p.activeLeg ?? current.activeLeg, route.length - 2),
                ),
          config: { ...current.config, ...p.config },
          timers: { ...current.timers, ...p.timers },
        };
      },
      partialize: ({
        startedAt,
        trafficPattern,
        departurePattern,
        patternReports,
        divertAirport,
        route,
        activeLeg,
        track,
        fredaDueAt,
        fredaOpen,
        replayEnabled,
        phase,
        config,
        timers,
      }) => ({
        startedAt,
        trafficPattern,
        departurePattern,
        patternReports,
        divertAirport,
        route,
        activeLeg,
        track,
        fredaDueAt,
        fredaOpen,
        replayEnabled,
        phase,
        config,
        timers,
      }),
    },
  ),
);
