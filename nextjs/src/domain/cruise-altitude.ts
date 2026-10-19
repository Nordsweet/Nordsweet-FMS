import { type Flight } from "~/data/flight";
import { type FlightPhase } from "./flight-phase";
import { type NavPoint } from "./progress";

export const CRUISE_LEVEL_HOLD_MS = 120000;
const TOLERANCE_FT = 100;
const MAX_SAMPLE_GAP_MS = 20000;
type Sample = { at: number; altitudeFt: number; verticalSpeedFpm?: number };
export type CruiseAltitudeMonitor = {
  context: string | null;
  source: string | null;
  candidateFt: number | null;
  since: number | null;
  last: Sample | null;
  trend: Sample[];
  offeredFt: number | null;
  declined: number[];
};
export const emptyCruiseAltitudeMonitor: CruiseAltitudeMonitor = {
  context: null,
  source: null,
  candidateFt: null,
  since: null,
  last: null,
  trend: [],
  offeredFt: null,
  declined: [],
};

/** Prefer a whole thousand only within the same ±100 ft tolerance used for level flight. */
export function roundedCruiseAltitude(altitudeFt: number) {
  const thousand = Math.round(altitudeFt / 1000) * 1000;
  return Math.abs(thousand - altitudeFt) <= TOLERANCE_FT
    ? thousand
    : Math.round(altitudeFt / 100) * 100;
}

/** Only continuous fresh flight samples count; a moving candidate must never follow a climb. */
export function observeCruiseAltitude(
  previous: CruiseAltitudeMonitor,
  input: {
    session: string | null;
    plannedFt: number;
    phase: FlightPhase;
    source: string;
    sample: Sample | null;
    blocked?: boolean;
  },
): CruiseAltitudeMonitor {
  const context = input.session ? `${input.session}:${input.plannedFt}` : null;
  const state =
    context === previous.context
      ? previous
      : { ...emptyCruiseAltitudeMonitor, context };
  const reset = {
    ...state,
    source: input.source,
    candidateFt: null,
    since: null,
    last: null,
    trend: [],
    offeredFt: null,
  };
  const sample = input.sample;
  if (
    !context ||
    !sample ||
    input.blocked ||
    !["climb", "cruise"].includes(input.phase) ||
    !Number.isFinite(sample.at) ||
    !Number.isFinite(sample.altitudeFt) ||
    sample.altitudeFt <= input.plannedFt + TOLERANCE_FT
  )
    return reset;
  if (state.last?.at === sample.at && state.source === input.source)
    return state;
  const continuous =
    state.source === input.source &&
    state.last &&
    sample.at > state.last.at &&
    sample.at - state.last.at <= MAX_SAMPLE_GAP_MS;
  const base = continuous ? state : reset;
  const trend = [
    ...base.trend.filter((s) => sample.at - s.at <= 30000),
    sample,
  ];
  const oldest = trend[0]!;
  const elapsed = sample.at - oldest.at;
  const climbing =
    sample.verticalSpeedFpm !== undefined &&
    (!Number.isFinite(sample.verticalSpeedFpm) ||
      Math.abs(sample.verticalSpeedFpm) > 100);
  const trending =
    sample.verticalSpeedFpm === undefined &&
    elapsed >= 20000 &&
    Math.abs(((sample.altitudeFt - oldest.altitudeFt) * 60000) / elapsed) > 100;
  if (climbing || trending) return { ...reset, last: sample, trend };
  const candidateFt =
    base.candidateFt !== null &&
    Math.abs(sample.altitudeFt - base.candidateFt) <= TOLERANCE_FT
      ? base.candidateFt
      : roundedCruiseAltitude(sample.altitudeFt);
  if (candidateFt <= input.plannedFt) return { ...reset, last: sample, trend };
  const since =
    candidateFt === base.candidateFt ? (base.since ?? sample.at) : sample.at;
  return {
    ...base,
    source: input.source,
    last: sample,
    trend,
    candidateFt,
    since,
    offeredFt:
      sample.at - since >= CRUISE_LEVEL_HOLD_MS &&
      !base.declined.includes(candidateFt)
        ? candidateFt
        : null,
  };
}

/** Recalculate cruise-based levels without moving passed fixes, restrictions or circuit/airport levels. */
export function changedCruiseAltitude(
  flight: Flight,
  altitudeFt: number,
  route: NavPoint[],
  activeLeg: number,
  protectedKeys: readonly string[] = [],
) {
  const passed = new Set(
    route.slice(0, activeLeg + 1).map((p) => p.ident.toUpperCase()),
  );
  const protectedPoint = (ident: string) => {
    const key = ident.toUpperCase();
    return (
      passed.has(key) ||
      protectedKeys.includes(key) ||
      flight.pointRestrictions[key]?.altitudeFt != null ||
      [flight.departure?.ident, flight.destination?.ident].includes(key)
    );
  };
  return {
    patch: {
      cruiseAltitudeFt: altitudeFt,
      waypointAltitudes: Object.fromEntries(
        Object.entries(flight.waypointAltitudes).map(([key, value]) => [
          key,
          value === flight.cruiseAltitudeFt && !protectedPoint(key)
            ? altitudeFt
            : value,
        ]),
      ),
    },
    route: route.map((point, i) =>
      i > activeLeg &&
      !point.patternId &&
      !protectedPoint(point.ident) &&
      point.altitudeFt === flight.cruiseAltitudeFt
        ? { ...point, altitudeFt }
        : point,
    ),
  };
}
