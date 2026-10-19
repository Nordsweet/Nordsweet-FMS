import { angleDiffDeg, normalizeDeg, toDeg, toRad } from "./angles";

// MVP gates documented in docs/agents/WIND_ESTIMATION.md; not statistical confidence bounds.
const LIMITS = {
  gpsAgeMs: 20_000,
  futureToleranceMs: 1_000,
  windAgeMs: 600_000,
  maxGapSeconds: 4,
  minIntervalSeconds: 0.2,
  circleDurationMs: 300_000,
  minSpeedMps: 15,
  maxSpeedMps: 310,
  maxWindMps: 30,
  minAltitudeM: -500,
  maxAltitudeM: 20_000,
  maxGpsAccuracyM: 100,
  circleAltitudeSpreadM: 100,
  windAltitudeDifferenceM: 300,
  minTurnRateDegS: 0.5,
  maxTurnRateDegS: 12,
  minSamples: 30,
  minFitCondition: 0.08,
  maxResidualMps: 1,
  maxResidualFraction: 0.025,
  calmMps: 1852 / 3600,
};

/** Native GPS inputs in SI units. Planned TAS and aircraft nose heading are not inputs. */
export type WindSample = {
  source?: "gps" | "derived" | "replay";
  at: number;
  speedMps: number;
  trackDeg: number;
  altitudeM: number;
  accuracyM: number;
};
export type WindEstimate = {
  at: number;
  altitudeM: number;
  eastMps: number;
  northMps: number;
  speedMps: number;
  fromDeg: number | null;
  residualMps: number;
};
export type WindEstimation = {
  samples: WindSample[];
  travelDeg: number;
  turnSign: number;
  estimate: WindEstimate | null;
  interrupted: boolean;
  lastAcceptedAt: number | null;
  altitudeM: number | null;
};
export const emptyWind = (): WindEstimation => ({
  samples: [],
  travelDeg: 0,
  turnSign: 0,
  estimate: null,
  interrupted: false,
  lastAcceptedAt: null,
  altitudeM: null,
});

export type SimulatorWindSample = {
  at: number;
  altitudeFt: number;
  groundSpeedKt: number;
  trackTrueDeg: number;
  trueAirspeedKt: number;
  headingTrueDeg: number;
  onGround: boolean;
};

/** P3D supplies measured TAS and true heading: W = Vground − Vair needs no circling fit. */
export function simulatorWind(
  sample: SimulatorWindSample | null,
  now: number,
): WindEstimate | null {
  if (
    !sample ||
    sample.onGround ||
    ![
      sample.at,
      sample.altitudeFt,
      sample.groundSpeedKt,
      sample.trackTrueDeg,
      sample.trueAirspeedKt,
      sample.headingTrueDeg,
      now,
    ].every(Number.isFinite) ||
    sample.at > now + LIMITS.futureToleranceMs ||
    now - sample.at > LIMITS.gpsAgeMs ||
    sample.trueAirspeedKt <= 0 ||
    sample.trueAirspeedKt > (LIMITS.maxSpeedMps * 3600) / 1852 ||
    sample.groundSpeedKt < 0 ||
    sample.groundSpeedKt > (LIMITS.maxSpeedMps * 3600) / 1852 ||
    sample.altitudeFt * 0.3048 < LIMITS.minAltitudeM ||
    sample.altitudeFt * 0.3048 > LIMITS.maxAltitudeM ||
    sample.trackTrueDeg < 0 ||
    sample.trackTrueDeg > 360 ||
    sample.headingTrueDeg < 0 ||
    sample.headingTrueDeg > 360
  )
    return null;
  const knot = 1852 / 3600;
  const eastMps =
    knot *
    (sample.groundSpeedKt * Math.sin(toRad(sample.trackTrueDeg)) -
      sample.trueAirspeedKt * Math.sin(toRad(sample.headingTrueDeg)));
  const northMps =
    knot *
    (sample.groundSpeedKt * Math.cos(toRad(sample.trackTrueDeg)) -
      sample.trueAirspeedKt * Math.cos(toRad(sample.headingTrueDeg)));
  const speedMps = Math.hypot(eastMps, northMps);
  return {
    at: sample.at,
    altitudeM: sample.altitudeFt * 0.3048,
    eastMps,
    northMps,
    speedMps,
    residualMps: 0,
    fromDeg:
      speedMps < LIMITS.calmMps
        ? null
        : normalizeDeg(toDeg(Math.atan2(-eastMps, -northMps))),
  };
}

/** Fit |Vground − W| = constant TAS, independently derived from a velocity-circle model. */
function fitVelocityCircle(samples: WindSample[]): WindEstimate | null {
  const vectors = samples.map((p) => ({
    x: p.speedMps * Math.sin(toRad(p.trackDeg)),
    y: p.speedMps * Math.cos(toRad(p.trackDeg)),
  }));
  const n = vectors.length;
  const mx = vectors.reduce((s, p) => s + p.x, 0) / n;
  const my = vectors.reduce((s, p) => s + p.y, 0) / n;
  let xx = 0,
    xy = 0,
    yy = 0,
    xz = 0,
    yz = 0;
  for (const p of vectors) {
    const x = p.x - mx,
      y = p.y - my,
      z = x * x + y * y;
    xx += x * x;
    xy += x * y;
    yy += y * y;
    xz += x * z;
    yz += y * z;
  }
  const det = xx * yy - xy * xy;
  if (!(det / (xx + yy) ** 2 > LIMITS.minFitCondition)) return null;
  const eastMps = mx + (xz * yy - yz * xy) / (2 * det);
  const northMps = my + (yz * xx - xz * xy) / (2 * det);
  const radii = vectors.map((p) => Math.hypot(p.x - eastMps, p.y - northMps));
  const tas = radii.reduce((a, b) => a + b, 0) / n;
  const residualMps = Math.sqrt(
    radii.reduce((s, r) => s + (r - tas) ** 2, 0) / n,
  );
  const speedMps = Math.hypot(eastMps, northMps);
  if (
    !Number.isFinite(speedMps) ||
    tas < LIMITS.minSpeedMps ||
    tas > LIMITS.maxSpeedMps ||
    speedMps >= LIMITS.maxWindMps ||
    residualMps >
      Math.max(LIMITS.maxResidualMps, tas * LIMITS.maxResidualFraction)
  )
    return null;
  return {
    at: samples.at(-1)!.at,
    altitudeM: samples.reduce((s, p) => s + p.altitudeM, 0) / n,
    eastMps,
    northMps,
    speedMps,
    residualMps,
    // Calm (<1 kt) has no useful direction. FROM is opposite the velocity vector.
    fromDeg:
      speedMps < LIMITS.calmMps
        ? null
        : normalizeDeg(toDeg(Math.atan2(-eastMps, -northMps))),
  };
}

/** One full, consistent GPS turn; invalid samples/gaps invalidate live continuity, duplicates do nothing. */
export function observeWind(
  state: WindEstimation,
  sample: WindSample | null,
  now: number,
): WindEstimation {
  if (
    !sample ||
    (sample.source !== undefined && sample.source !== "gps") ||
    ![
      sample.at,
      sample.speedMps,
      sample.trackDeg,
      sample.altitudeM,
      sample.accuracyM,
      now,
    ].every(Number.isFinite) ||
    sample.at > now + LIMITS.futureToleranceMs ||
    now - sample.at > LIMITS.gpsAgeMs ||
    sample.speedMps < LIMITS.minSpeedMps ||
    sample.speedMps > LIMITS.maxSpeedMps ||
    sample.trackDeg < 0 ||
    sample.trackDeg >= 360 ||
    sample.accuracyM < 0 ||
    sample.accuracyM > LIMITS.maxGpsAccuracyM ||
    sample.altitudeM < LIMITS.minAltitudeM ||
    sample.altitudeM > LIMITS.maxAltitudeM
  ) {
    if (
      !state.samples.length &&
      state.interrupted &&
      state.lastAcceptedAt === null
    )
      return state;
    return {
      ...state,
      samples: [],
      travelDeg: 0,
      turnSign: 0,
      interrupted: true,
      lastAcceptedAt: null,
    };
  }
  const previous = state.samples.at(-1);
  if (state.lastAcceptedAt === sample.at) return state;
  const base = {
    ...state,
    lastAcceptedAt: sample.at,
    altitudeM: sample.altitudeM,
  };
  if (state.lastAcceptedAt !== null && sample.at < state.lastAcceptedAt)
    return {
      ...emptyWind(),
      samples: [sample],
      lastAcceptedAt: sample.at,
      altitudeM: sample.altitudeM,
    };
  if (!previous) return { ...base, samples: [sample] };
  const seconds = (sample.at - previous.at) / 1000;
  if (seconds < LIMITS.minIntervalSeconds) return state;
  if (seconds > LIMITS.maxGapSeconds)
    return {
      ...base,
      samples: [sample],
      travelDeg: 0,
      turnSign: 0,
      interrupted: true,
    };
  const delta = angleDiffDeg(previous.trackDeg, sample.trackDeg);
  const rate = Math.abs(delta) / seconds;
  if (
    rate < LIMITS.minTurnRateDegS ||
    rate > LIMITS.maxTurnRateDegS ||
    (state.turnSign && Math.sign(delta) !== state.turnSign)
  )
    return {
      ...base,
      samples: [sample],
      travelDeg: 0,
      turnSign: 0,
      interrupted: rate > LIMITS.maxTurnRateDegS || state.interrupted,
    };
  const samples = [...state.samples, sample];
  const heights = samples.map((p) => p.altitudeM);
  if (
    sample.at - samples[0]!.at > LIMITS.circleDurationMs ||
    Math.max(...heights) - Math.min(...heights) > LIMITS.circleAltitudeSpreadM
  )
    return { ...base, samples: [sample], travelDeg: 0, turnSign: 0 };
  const travelDeg = state.travelDeg + Math.abs(delta);
  if (travelDeg < 360 || samples.length < LIMITS.minSamples)
    return { ...base, samples, travelDeg, turnSign: Math.sign(delta) };
  const estimate = fitVelocityCircle(samples);
  return {
    ...base,
    samples: [sample],
    travelDeg: 0,
    turnSign: 0,
    estimate: estimate ?? state.estimate,
    interrupted: estimate ? false : state.interrupted,
  };
}

/** A result is local to its flight level/time and never stays live through loss of GPS. */
export function windStatus(state: WindEstimation, now: number) {
  if (!state.estimate) return "collecting" as const;
  if (
    state.interrupted ||
    state.lastAcceptedAt === null ||
    now < state.estimate.at ||
    now - state.lastAcceptedAt > LIMITS.gpsAgeMs ||
    now - state.estimate.at > LIMITS.windAgeMs ||
    state.altitudeM === null ||
    Math.abs(state.altitudeM - state.estimate.altitudeM) >
      LIMITS.windAltitudeDifferenceM
  )
    return "stale" as const;
  return "valid" as const;
}

/** Meteorological FROM in degrees true and whole knots, with a calm/unknown direction placeholder. */
export function windReadout(estimate: WindEstimate | null) {
  if (!estimate) return "---°/---";
  const direction =
    estimate.fromDeg === null
      ? "---"
      : String(Math.round(estimate.fromDeg) % 360).padStart(3, "0");
  const speed =
    estimate.fromDeg === null
      ? 0
      : Math.round((estimate.speedMps * 3600) / 1852);
  return `${direction}°/${String(speed).padStart(3, "0")}`;
}

/** Downwind arrow relative to the map's true-north camera bearing. */
export const windArrowRotation = (fromDeg: number, mapBearingDeg: number) =>
  normalizeDeg(fromDeg + 180 - mapBearingDeg);
