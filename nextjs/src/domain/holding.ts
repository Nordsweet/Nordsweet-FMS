import { type Holding } from "~/data/holding";
import { angleDiffDeg, normalizeDeg, toRad, toDeg } from "./angles";
import {
  type LatLon,
  destinationPoint,
  distanceNm,
  initialBearingDeg,
  trackOffset,
} from "./geo";
import { computeProgress, type NavPoint, type Progress } from "./progress";
import { type TurnPerformance } from "./fly-by";

export type HoldEntry = "direct" | "parallel" | "teardrop";
export type HoldFix = LatLon & {
  time: string;
  trackDeg: number | null;
  groundSpeedKt: number | null;
};
export type HoldingRuntime = {
  config: Holding;
  entry: HoldEntry;
  phase: "armed" | "turn" | "outbound" | "return";
  timerStartedAt: number | null;
  previous: HoldFix | null;
  departedFix: boolean;
  circuits: number;
};

export const holdingLegSeconds = (levelFt: number) =>
  levelFt > 14000 ? 90 : 60;

/** FAA AIM 5-3-8/Fig 5-3-4: 70° teardrop, 110° parallel, mirrored for left turns. */
export function holdingEntry(
  inboundTrueDeg: number,
  approachTrueDeg: number,
  direction: Holding["direction"],
): HoldEntry {
  const delta = normalizeDeg(
    (direction === "right" ? 1 : -1) * (approachTrueDeg - inboundTrueDeg),
  );
  return delta > 110 && delta < 180
    ? "teardrop"
    : delta >= 180 && delta < 290
      ? "parallel"
      : "direct";
}

export function armHolding(config: Holding): HoldingRuntime {
  return {
    config,
    entry: holdingEntry(
      config.inboundTrueDeg,
      config.approachTrueDeg,
      config.direction,
    ),
    phase: "armed",
    timerStartedAt: null,
    previous: null,
    departedFix: false,
    circuits: 0,
  };
}

type Vec = { x: number; y: number };
const plus = (a: Vec, b: Vec): Vec => ({ x: a.x + b.x, y: a.y + b.y });
const unit = (h: number): Vec => ({
  x: Math.sin(toRad(h)),
  y: Math.cos(toRad(h)),
});
const move = (p: Vec, h: number, d: number) =>
  plus(p, { x: unit(h).x * d, y: unit(h).y * d });
const sweep = (a: number, b: number, sign: number) => {
  const change = normalizeDeg(sign * (b - a));
  // Tangent headings can differ by floating-point noise across the 0/360 seam.
  // Treat coincident headings as zero, never as an extra full-circle capture.
  return change < 1e-7 || 360 - change < 1e-7 ? 0 : change;
};

/** Sampled constant-radius turns; no fly-by cut of the holding fix. */
function turn(
  p: Vec,
  heading: number,
  change: number,
  sign: number,
  radius: number,
) {
  const c = move(p, heading + sign * 90, radius);
  const count = Math.max(1, Math.ceil(change / 3));
  return Array.from({ length: count + 1 }, (_, i) =>
    move(c, heading - sign * 90 + (sign * change * i) / count, radius),
  );
}

/** Tangent inbound capture with explicit reversal and capture directions. */
function returnPath(
  p: Vec,
  heading: number,
  inbound: number,
  sign: number,
  radius: number,
  minimumTurn: number,
  endSign: number,
): Vec[] {
  const firstCentre = move(p, heading + sign * 90, radius);
  const lastCentre = move({ x: 0, y: 0 }, inbound + endSign * 90, radius);
  const dx = lastCentre.x - firstCentre.x,
    dy = lastCentre.y - firstCentre.y;
  const distance = Math.hypot(dx, dy);
  if (distance < 1e-7 && endSign === sign)
    return turn(p, heading, sweep(heading, inbound, sign), sign, radius);
  const reversalCapture = () => {
    // Very short legs may not fit an inner tangent. Complete the opposite reversal,
    // then capture with holding-direction arcs instead of a sharp join or wrong-way turn.
    const reversal = turn(p, heading, 270, sign, radius);
    return [
      ...reversal,
      ...returnPath(
        reversal.at(-1)!,
        heading + sign * 270,
        inbound,
        endSign,
        radius,
        0,
        endSign,
      ),
    ];
  };
  if (endSign !== sign && distance < 2 * radius) return reversalCapture();
  const bearing = toDeg(Math.atan2(dx, dy));
  const tangent =
    bearing +
    (endSign === sign ? 0 : toDeg(Math.asin((2 * sign * radius) / distance)));
  const firstTurn = sweep(heading, tangent, sign);
  if (firstTurn + 1e-5 < minimumTurn) return reversalCapture();
  const lastTurn = sweep(tangent, inbound, endSign);
  const a = turn(p, heading, firstTurn, sign, radius);
  const bStart = move(lastCentre, tangent - endSign * 90, radius);
  const b = turn(bStart, tangent, lastTurn, endSign, radius);
  return [...a, ...b];
}

/** Nominal still-air geometry, including the selected automatic entry and a rate-one racetrack. */
export function holdingGeometry(
  config: Holding,
  entry = holdingEntry(
    config.inboundTrueDeg,
    config.approachTrueDeg,
    config.direction,
  ),
) {
  const sign = config.direction === "right" ? 1 : -1;
  const radius = config.tasKt / (60 * Math.PI);
  const length = (config.tasKt * config.legSeconds) / 3600;
  const outboundDeg = normalizeDeg(
    config.inboundTrueDeg + 180 - (entry === "teardrop" ? 30 * sign : 0),
  );
  const turnSign = entry === "parallel" ? -sign : sign;
  // An oblique direct arrival needs a wider initial turn to reach the racetrack's
  // outbound offset. Otherwise its rate-one return overshoots inbound and the
  // same-direction capture makes an almost complete extra circle at the fix.
  const entryRadius =
    entry === "direct"
      ? (2 * radius) /
        (1 + Math.cos(toRad(config.approachTrueDeg - config.inboundTrueDeg)))
      : radius;
  const firstTurn = turn(
    { x: 0, y: 0 },
    config.approachTrueDeg,
    sweep(config.approachTrueDeg, outboundDeg, turnSign),
    turnSign,
    entryRadius,
  );
  const outboundStart = firstTurn.at(-1)!;
  // If the turn finishes before abeam, reach abeam before timing outbound,
  // matching the timer's existing wings-level AND abeam condition.
  const beforeAbeam =
    entry === "direct"
      ? Math.max(
          0,
          outboundStart.x * unit(config.inboundTrueDeg).x +
            outboundStart.y * unit(config.inboundTrueDeg).y,
        )
      : 0;
  const outboundEnd = move(outboundStart, outboundDeg, length + beforeAbeam);
  const inbound = returnPath(
    outboundEnd,
    outboundDeg,
    config.inboundTrueDeg,
    entry === "parallel" ? -sign : sign,
    radius,
    entry === "parallel" ? 180 : 0,
    sign,
  );
  const nominalTurn = turn(
    { x: 0, y: 0 },
    config.inboundTrueDeg,
    180,
    sign,
    radius,
  );
  const nominalOutbound = move(
    nominalTurn.at(-1)!,
    config.inboundTrueDeg + 180,
    length,
  );
  const nominalReturn = turn(
    nominalOutbound,
    config.inboundTrueDeg + 180,
    180,
    sign,
    radius,
  );
  const project = (v: Vec) =>
    destinationPoint(
      config.fix,
      toDeg(Math.atan2(v.x, v.y)),
      Math.hypot(v.x, v.y),
    );
  return {
    entry,
    outboundDeg,
    radiusNm: radius,
    turn: firstTurn.map(project),
    outbound: [outboundStart, outboundEnd].map(project),
    return: inbound.map(project),
    entryPath: [...firstTurn, outboundEnd, ...inbound].map(project),
    racetrack: [
      ...nominalTurn,
      nominalOutbound,
      ...nominalReturn,
      { x: 0, y: 0 },
    ].map(project),
  };
}

/** Arm only the next occurrence of this fix; far-away holds must not skip intervening legs. */
export function holdingFixIndex(
  route: readonly NavPoint[],
  config: Holding,
  activeLeg: number,
) {
  return route.findIndex(
    (p, i) =>
      i > activeLeg &&
      p.ident === config.fix.ident &&
      distanceNm(p, config.fix) < 0.01,
  );
}

export function navigationProgress(
  route: NavPoint[],
  position: LatLon,
  activeLeg: number,
  performance: TurnPerformance,
  holding: HoldingRuntime | null,
) {
  const active = holdingProgress(holding, position, activeLeg);
  if (active) return active;
  const index = holding
    ? holdingFixIndex(route, holding.config, activeLeg)
    : -1;
  return computeProgress(
    index >= 0
      ? route
          .slice(0, index + 1)
          .map((p, i) => (i === index ? { ...p, flyOver: true } : p))
      : route,
    position,
    activeLeg,
    performance,
  );
}

function passedFix(previous: LatLon | null, current: LatLon, fix: LatLon) {
  if (distanceNm(current, fix) < 0.08) return true;
  if (!previous || distanceNm(previous, current) < 0.001) return false;
  const offset = trackOffset(previous, current, fix);
  return (
    Math.abs(offset.crossTrackNm) < 0.08 &&
    offset.alongTrackNm >= 0 &&
    offset.alongTrackNm <= distanceNm(previous, current)
  );
}

/** GPS-driven transitions; timestamps are persisted so duplicates/reloads never restart a leg. */
export function observeHolding(
  state: HoldingRuntime,
  fix: HoldFix,
  nextFix: boolean,
  now: number,
): HoldingRuntime {
  const at = Date.parse(fix.time);
  const previousAt = state.previous
    ? Date.parse(state.previous.time)
    : -Infinity;
  if (
    !Number.isFinite(at) ||
    now - at > 20000 ||
    at > now + 2000 ||
    at <= previousAt
  )
    return state;
  const previous =
    state.previous && at - previousAt <= 20000 ? state.previous : null;
  const moved = previous && distanceNm(previous, fix) > 0.003;
  const heading =
    fix.trackDeg ?? (moved ? initialBearingDeg(previous, fix) : null);
  let result = { ...state, previous: { ...fix, trackDeg: heading } };
  if (
    state.phase === "outbound" &&
    state.timerStartedAt !== null &&
    at >= state.timerStartedAt + state.config.legSeconds * 1000
  )
    return { ...result, phase: "return", departedFix: true };
  if (!moved || (fix.groundSpeedKt !== null && fix.groundSpeedKt < 5))
    return result;
  if (state.phase === "armed") {
    if (nextFix && passedFix(previous, fix, state.config.fix)) {
      const approach = heading ?? initialBearingDeg(previous, fix);
      const config = { ...state.config, approachTrueDeg: approach };
      result = {
        ...result,
        config,
        entry: holdingEntry(config.inboundTrueDeg, approach, config.direction),
        phase: "turn",
        timerStartedAt: null,
        departedFix: false,
      };
    }
    return result;
  }
  if (state.phase === "turn") {
    const geometry = holdingGeometry(state.config, state.entry);
    // Wings level outbound AND fix abeam/behind: the imaginary TO→FROM transition.
    const toFix = initialBearingDeg(fix, state.config.fix);
    const behind =
      Math.cos(toRad(angleDiffDeg(geometry.outboundDeg, toFix))) <= 0.00001;
    // A 3°/s turn can already be past abeam while still approaching outbound.
    // Wait for a steady track, rather than starting during its final degrees.
    const steady =
      previous?.trackDeg !== null &&
      previous?.trackDeg !== undefined &&
      heading !== null &&
      Math.abs(angleDiffDeg(previous.trackDeg, heading)) /
        ((at - previousAt) / 1000) <=
        1;
    if (
      heading !== null &&
      Math.abs(angleDiffDeg(heading, geometry.outboundDeg)) <= 5 &&
      steady &&
      behind &&
      distanceNm(fix, state.config.fix) > 0.1
    )
      result = {
        ...result,
        phase: "outbound",
        timerStartedAt: at,
        departedFix: true,
      };
  } else if (
    state.phase === "return" &&
    state.departedFix &&
    passedFix(previous, fix, state.config.fix)
  ) {
    result = {
      ...result,
      config: { ...state.config, approachTrueDeg: state.config.inboundTrueDeg },
      entry: "direct",
      phase: "turn",
      timerStartedAt: null,
      departedFix: false,
      circuits: state.circuits + 1,
    };
  }
  return result;
}

/** Guidance uses the same sampled curve as the map; normal route sequencing is suspended. */
export function holdingProgress(
  state: HoldingRuntime | null,
  position: LatLon,
  activeLeg: number,
): Progress | null {
  if (!state || state.phase === "armed") return null;
  const geometry = holdingGeometry(state.config, state.entry);
  const phasePath =
    state.phase === "turn"
      ? geometry.turn
      : state.phase === "outbound"
        ? geometry.outbound
        : geometry.return;
  const path = phasePath.every((p) => distanceNm(p, phasePath[0]!) < 1e-6)
    ? geometry.outbound
    : phasePath;
  let best = { distance: Infinity, index: 0, cross: 0, remaining: 0 };
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i]!,
      b = path[i + 1]!,
      length = distanceNm(a, b);
    if (length < 1e-6) continue;
    const offset = trackOffset(a, b, position);
    const distance =
      offset.alongTrackNm < 0
        ? distanceNm(position, a)
        : offset.alongTrackNm > length
          ? distanceNm(position, b)
          : Math.abs(offset.crossTrackNm);
    if (distance < best.distance)
      best = {
        distance,
        index: i,
        cross: offset.crossTrackNm,
        remaining: length - Math.max(0, Math.min(length, offset.alongTrackNm)),
      };
  }
  const a = path[best.index] ?? state.config.fix,
    b = path[best.index + 1] ?? state.config.fix;
  const distance =
    best.remaining +
    path
      .slice(best.index + 1, -1)
      .reduce((sum, p, i) => sum + distanceNm(p, path[best.index + i + 2]!), 0);
  return {
    activeLeg,
    next: {
      ...state.config.fix,
      ident: `${state.config.fix.ident} HOLD`,
      altitudeFt: state.config.levelFt,
    },
    distanceToNextNm: distance,
    distanceToDestinationNm: distance,
    bearingToNextDeg:
      state.phase === "outbound"
        ? geometry.outboundDeg
        : initialBearingDeg(position, b),
    desiredTrackDeg:
      state.phase === "outbound"
        ? geometry.outboundDeg
        : initialBearingDeg(a, b),
    crossTrackNm: best.cross,
  };
}
