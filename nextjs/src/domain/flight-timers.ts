import { type FlightPhase } from "./flight-phase";

/**
 * Legacy flight timers (handleFlightTimerGpsSample): Block Time and Air Time with GPS detection,
 * the operational events, and the automatic phase changes. Pure: the caller stores the result.
 */
export type TimerKey = "offBlock" | "airTime";
export type Timer = {
  startedAt: number | null;
  stoppedAt: number | null;
  source: "auto" | "manual" | null;
  /** GPS may still start it (a manual start or stop disarms it). */
  autoArmed: boolean;
  candidateAt: number | null;
};
export type FlightEvent = {
  name: string;
  at: number;
  /** When it was recorded (landing is back-dated to its candidate time); drives the toast. */
  notedAt?: number;
  source: "auto" | "manual";
  lat: number | null;
  lon: number | null;
  altitudeFt: number | null;
};
export type Sample = {
  at: number;
  lat: number;
  lon: number;
  altitudeFt: number | null;
  speedKt: number | null;
  headingDeg: number | null;
};
export type Timers = {
  offBlock: Timer;
  airTime: Timer;
  last: Sample | null;
  /** Taxi altitudes (≤ 35 kt): their median is the take-off ground reference (GNSS vs AIP offset). */
  groundSamples: number[];
  groundReferenceFt: number | null;
  rollHeadingDeg: number | null;
  rollStartedAt: number | null;
  landingCandidateAt: number | null;
  onBlockCandidateAt: number | null;
  todCandidateAt: number | null;
  events: FlightEvent[];
  /** Legacy delayed phase changes: climb 10 s after take-off, taxi-in 20 s after landing. */
  pendingPhase: { phase: "climb" | "taxiin"; dueAt: number } | null;
  /** TIMER 1 and TIMER 2: stopwatch or 1/2 minute countdown. */
  utility: [UtilityTimer, UtilityTimer];
};
export type UtilityTimer = {
  mode: "idle" | "stopwatch" | "countdown" | "stopped" | "complete";
  startedAt: number | null;
  stoppedAt: number | null;
  durationMs: number;
};
const utilityTimer = (): UtilityTimer => ({
  mode: "idle",
  startedAt: null,
  stoppedAt: null,
  durationMs: 0,
});

const CLIMB_DELAY_MS = 10_000;
const TAXIIN_DELAY_MS = 20_000;
const STABLE_ROLL_MS = 10_000;

const timer = (): Timer => ({
  startedAt: null,
  stoppedAt: null,
  source: null,
  autoArmed: true,
  candidateAt: null,
});
export const newTimers = (): Timers => ({
  offBlock: timer(),
  airTime: timer(),
  last: null,
  groundSamples: [],
  groundReferenceFt: null,
  rollHeadingDeg: null,
  rollStartedAt: null,
  landingCandidateAt: null,
  onBlockCandidateAt: null,
  todCandidateAt: null,
  events: [],
  pendingPhase: null,
  utility: [utilityTimer(), utilityTimer()],
});

const EVENT_NAMES: Record<TimerKey, [start: string, stop: string]> = {
  offBlock: ["Off-block", "On-block"],
  airTime: ["Take-off", "Landing"],
};
export const isRunning = (t: Timer) =>
  t.startedAt !== null && t.stoppedAt === null;
const headingDelta = (a: number, b: number) => {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
};
const median = (values: number[]) => {
  const v = [...values].sort((a, b) => a - b);
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m]! : (v[m - 1]! + v[m]!) / 2;
};

/** One mutable working copy per step; helpers below act on it. */
function working(t: Timers, at: number, where: Sample | null) {
  const next = structuredClone(t);
  const event = (name: string, when: number, source: "auto" | "manual") => {
    // Operational events are recorded once per flight (legacy createOperationalFlightEvent).
    if (next.events.some((e) => e.name === name)) return;
    next.events.push({
      name,
      at: when,
      notedAt: at,
      source,
      lat: where?.lat ?? null,
      lon: where?.lon ?? null,
      altitudeFt: where?.altitudeFt ?? null,
    });
  };
  const start = (key: TimerKey, when: number, source: "auto" | "manual") => {
    Object.assign(next[key], {
      startedAt: when,
      stoppedAt: null,
      source,
      autoArmed: false,
      candidateAt: null,
    });
    event(EVENT_NAMES[key][0], when, source);
    if (key === "airTime")
      next.pendingPhase = { phase: "climb", dueAt: at + CLIMB_DELAY_MS };
  };
  const stop = (key: TimerKey, when: number, source: "auto" | "manual") => {
    if (!isRunning(next[key])) return;
    Object.assign(next[key], {
      stoppedAt: when,
      autoArmed: false,
      candidateAt: null,
    });
    event(EVENT_NAMES[key][1], when, source);
    if (key === "airTime")
      next.pendingPhase = { phase: "taxiin", dueAt: at + TAXIIN_DELAY_MS };
  };
  return { next, event, start, stop };
}

/** Manual OFF-BLOCK/ON-BLOCK and TAKE-OFF/LANDING buttons. */
export function toggleTimer(t: Timers, key: TimerKey, now: number): Timers {
  const { next, start, stop } = working(t, now, t.last);
  if (isRunning(t[key])) stop(key, now, "manual");
  else start(key, now, "manual");
  return next;
}

/** A manual entry in the event log ("Add event"). */
export function addEvent(t: Timers, name: string, now: number): Timers {
  const next = structuredClone(t);
  next.events.push({
    name,
    at: now,
    notedAt: now,
    source: "manual",
    lat: t.last?.lat ?? null,
    lon: t.last?.lon ?? null,
    altitudeFt: t.last?.altitudeFt ?? null,
  });
  return next;
}

/** A delayed phase change that is due and still valid (climb only while airborne, taxi-in after landing). */
export function duePhase(t: Timers, now: number) {
  const pending = t.pendingPhase;
  if (!pending || now < pending.dueAt) return null;
  const valid =
    pending.phase === "climb"
      ? isRunning(t.airTime)
      : t.airTime.stoppedAt !== null;
  return {
    phase: valid ? pending.phase : null,
    timers: { ...t, pendingPhase: null },
  };
}

export function stepTimers(
  t: Timers,
  s: Sample,
  ctx: {
    phase: FlightPhase;
    departureElevationFt: number;
    cruiseAltitudeFt: number;
    /** The ground under the aircraft (nearest planned airport). */
    groundElevationFt: number;
  },
): { timers: Timers; phase: FlightPhase | null } {
  const previous = t.last;
  const { next, event, start, stop } = working(t, s.at, s);
  next.last = s;
  let phase: FlightPhase | null = null;
  const speed = s.speedKt;
  const alt = s.altitudeFt;
  if (speed === null) return { timers: next, phase };

  // Off-block: groundspeed above 2 kt for 5 s.
  const off = next.offBlock;
  if (off.autoArmed && off.startedAt === null) {
    if (speed > 2) {
      off.candidateAt ??= s.at;
      if (s.at - off.candidateAt >= 5000)
        start("offBlock", off.candidateAt, "auto");
    } else off.candidateAt = null;
  }

  // Take-off: a 10 s accelerating run within 10° of track, confirmed passing +50 ft.
  const air = next.airTime;
  if (air.autoArmed && air.startedAt === null) {
    if (alt !== null && speed <= 35) {
      next.groundSamples = [...next.groundSamples, alt].slice(-25);
      next.groundReferenceFt = median(next.groundSamples);
    }
    const prevSpeed = previous?.speedKt ?? null;
    const rolling =
      prevSpeed !== null && speed >= 5 && speed >= prevSpeed - 0.35;
    const accelerating = rolling && speed > prevSpeed + 0.2;
    const stableTrack =
      s.headingDeg !== null &&
      (next.rollHeadingDeg === null ||
        headingDelta(next.rollHeadingDeg, s.headingDeg) <= 10);
    const continuing = next.rollStartedAt !== null && rolling && stableTrack;
    if ((accelerating || continuing) && stableTrack) {
      next.rollHeadingDeg ??= s.headingDeg;
      next.rollStartedAt ??= previous!.at;
    } else {
      next.rollHeadingDeg = null;
      next.rollStartedAt = null;
    }
    const groundFt = next.groundReferenceFt ?? ctx.departureElevationFt;
    const verifiedRoll =
      next.rollStartedAt !== null &&
      s.at - next.rollStartedAt >= STABLE_ROLL_MS;
    const crossed50ft =
      previous?.altitudeFt != null &&
      alt !== null &&
      previous.altitudeFt < groundFt + 50 &&
      alt >= groundFt + 50;
    if (verifiedRoll && crossed50ft) start("airTime", s.at, "auto");
  }

  // Top of climb: at the cruise altitude (−50 ft GNSS tolerance) in take-off or climb.
  const groundRefFt = next.groundReferenceFt ?? ctx.departureElevationFt;
  if (
    isRunning(air) &&
    alt !== null &&
    (ctx.phase === "takeoff" || ctx.phase === "climb") &&
    ctx.cruiseAltitudeFt > groundRefFt + 100 &&
    alt >= ctx.cruiseAltitudeFt - 50
  ) {
    event("Top of Climb", s.at, "auto");
    if (next.pendingPhase?.phase === "climb") next.pendingPhase = null;
    phase = "cruise";
  }

  const hasEvent = (name: string) => next.events.some((e) => e.name === name);
  const elapsed = previous ? Math.max(1, s.at - previous.at) : 0;
  const verticalFpm =
    previous?.altitudeFt != null && alt !== null && elapsed > 0
      ? ((alt - previous.altitudeFt) * 60000) / elapsed
      : null;

  // Top of descent: 10 s of at least 200 ft/min down, more than 700 ft above the ground.
  if (
    isRunning(air) &&
    hasEvent("Top of Climb") &&
    !hasEvent("Top of Descent")
  ) {
    const descending =
      verticalFpm !== null &&
      verticalFpm <= -200 &&
      alt !== null &&
      alt > ctx.groundElevationFt + 700;
    if (descending) {
      next.todCandidateAt ??= s.at;
      if (s.at - next.todCandidateAt >= 10_000) {
        event("Top of Descent", next.todCandidateAt, "auto");
        next.todCandidateAt = null;
        if (next.pendingPhase?.phase === "climb") next.pendingPhase = null;
        phase = "descent";
      }
    } else next.todCandidateAt = null;
  }

  // Landing: within 100 ft of the ground at 30 kt or less for 10 s.
  if (isRunning(air)) {
    const settled =
      alt !== null && alt <= ctx.groundElevationFt + 100 && speed <= 30;
    if (settled) {
      next.landingCandidateAt ??= s.at;
      if (s.at - next.landingCandidateAt >= 10_000) {
        stop("airTime", next.landingCandidateAt, "auto");
        next.landingCandidateAt = null;
      }
    } else next.landingCandidateAt = null;
  }

  // On-block: after landing, 2 kt or less for 5 s.
  if (air.stoppedAt !== null && isRunning(next.offBlock) && speed <= 2) {
    next.onBlockCandidateAt ??= s.at;
    if (s.at - next.onBlockCandidateAt >= 5000) {
      stop("offBlock", next.onBlockCandidateAt, "auto");
      next.onBlockCandidateAt = null;
    }
  } else next.onBlockCandidateAt = null;

  return { timers: next, phase };
}

/** Legacy "HH:MM:SS" since start (to the stop, else `now`); "--:--:--" before it starts. */
export function timerElapsed(t: Timer, now: number) {
  if (t.startedAt === null) return "--:--:--";
  const total = Math.max(
    0,
    Math.floor(((t.stoppedAt ?? now) - t.startedAt) / 1000),
  );
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(Math.floor(total / 3600))}:${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`;
}

/** The utility timer's main button: stop a running one, reset a stopped one, else start a stopwatch. */
export function utilityMain(u: UtilityTimer, now: number): UtilityTimer {
  if (u.mode === "stopwatch" || u.mode === "countdown")
    return { ...u, mode: "stopped", stoppedAt: now };
  if (u.mode !== "idle") return utilityTimer();
  return { mode: "stopwatch", startedAt: now, stoppedAt: null, durationMs: 0 };
}

export const utilityCountdown = (
  minutes: number,
  now: number,
): UtilityTimer => ({
  mode: "countdown",
  startedAt: now,
  stoppedAt: null,
  durationMs: minutes * 60_000,
});

/** A countdown that has run out becomes complete (the caller chimes). */
export const utilityDone = (u: UtilityTimer, now: number) =>
  u.mode === "countdown" && now - u.startedAt! >= u.durationMs;

/** Legacy "MM:SS" (with hours when needed): time left on a countdown, else elapsed. */
export function utilityValue(u: UtilityTimer, now: number) {
  let total = 0;
  if (u.mode === "countdown")
    total = Math.max(
      0,
      Math.ceil((u.durationMs - (now - u.startedAt!)) / 1000),
    );
  else if (u.startedAt !== null)
    total = Math.max(
      0,
      Math.floor(((u.stoppedAt ?? now) - u.startedAt) / 1000),
    );
  const pad = (n: number) => String(n).padStart(2, "0");
  const hours = Math.floor(total / 3600);
  const rest = `${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`;
  return hours ? `${pad(hours)}:${rest}` : rest;
}
