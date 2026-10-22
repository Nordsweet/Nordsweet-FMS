import { type TrafficAircraft } from "~/api/aviation/schemas";
import { destinationPoint, distanceNm, initialBearingDeg } from "./geo";
import { isOwnTraffic, type AircraftIdentity } from "./traffic-identity";

export type TrafficMotion = {
  accuracyM?: number;
  lat: number;
  lon: number;
  altitudeFt: number | null;
  groundSpeedKt: number | null;
  trackDeg: number | null;
  verticalSpeedFpm?: number;
  time: string;
  paused?: boolean;
};
export type TrafficAdvisory = {
  hex: string;
  level: "ta" | "close";
  distanceNm: number;
  relativeAltitudeFt: number;
  bearingDeg: number;
  seconds: number;
};

/** Fixed owner-selected SL5 illustration thresholds: warning volumes only, never maneuver resolutions. */
export const TRAFFIC_THRESHOLDS = {
  ta: { seconds: 40, verticalFt: 850, dmodNm: 0.75 },
  close: { seconds: 25, verticalFt: 600, dmodNm: 0.55 },
} as const;

export const TRAFFIC_CLOCK_LOOKAHEAD_SECONDS = 120;

type TrafficSituation = {
  advisory: TrafficAdvisory | null;
  clockVisible: boolean;
};

/** Time-aligned CPA, vertical convergence and slow-closure DMOD reject nearby but non-conflicting tracks. */
export function trafficSituation(
  own: TrafficMotion | null,
  target: TrafficAircraft,
  now: number,
  identity?: AircraftIdentity,
): TrafficSituation | null {
  if (!own || own.paused || target.on_ground || isOwnTraffic(target, identity))
    return null;
  if (
    Math.abs(own.lat) > 90 ||
    Math.abs(target.lat) > 90 ||
    Math.abs(own.lon) > 180 ||
    Math.abs(target.lon) > 180 ||
    (own.accuracyM !== undefined && own.accuracyM > 500) ||
    (target.ground_speed_kt !== null && target.ground_speed_kt < 0)
  )
    return null;
  const ownAge = (now - Date.parse(own.time)) / 1000,
    age = (now - Date.parse(target.position_time)) / 1000;
  if (
    ![ownAge, age].every((n) => Number.isFinite(n) && n >= -5 && n <= 20) ||
    own.altitudeFt === null ||
    target.altitude_ft === null ||
    own.groundSpeedKt === null ||
    own.groundSpeedKt < 30 ||
    own.trackDeg === null ||
    target.ground_speed_kt === null ||
    target.track_deg === null
  )
    return null;
  if (
    ![
      own.lat,
      own.lon,
      own.altitudeFt,
      own.groundSpeedKt,
      own.trackDeg,
      target.lat,
      target.lon,
      target.altitude_ft,
      target.ground_speed_kt,
      target.track_deg,
    ].every(Number.isFinite)
  )
    return null;
  const position = destinationPoint(
    own,
    own.trackDeg,
    (own.groundSpeedKt * Math.max(0, ownAge)) / 3600,
  );
  const intruder = destinationPoint(
    target,
    target.track_deg,
    (target.ground_speed_kt * Math.max(0, age)) / 3600,
  );
  const range = distanceNm(position, intruder);
  if (range > 20) return null;
  const velocity = (speed: number, track: number) => ({
    e: (speed / 3600) * Math.sin((track * Math.PI) / 180),
    n: (speed / 3600) * Math.cos((track * Math.PI) / 180),
  });
  const a = velocity(own.groundSpeedKt, own.trackDeg),
    b = velocity(target.ground_speed_kt, target.track_deg);
  const bearing = (initialBearingDeg(position, intruder) * Math.PI) / 180;
  const e = range * Math.sin(bearing),
    n = range * Math.cos(bearing),
    ve = b.e - a.e,
    vn = b.n - a.n;
  const dot = e * ve + n * vn,
    speed2 = ve * ve + vn * vn;
  const seconds = speed2 > 1e-10 ? -dot / speed2 : 0;
  const missNm = Math.hypot(
    e + ve * Math.max(0, seconds),
    n + vn * Math.max(0, seconds),
  );
  const ownVs = Number.isFinite(own.verticalSpeedFpm)
    ? own.verticalSpeedFpm!
    : 0;
  const targetVs = Number.isFinite(target.vertical_rate_fpm)
    ? target.vertical_rate_fpm!
    : 0;
  const vertical =
    target.altitude_ft +
    (targetVs * Math.max(0, age)) / 60 -
    own.altitudeFt -
    (ownVs * Math.max(0, ownAge)) / 60;
  // The visual search aid starts earlier; it does not promote a two-minute encounter to a TA.
  const clockVisible =
    dot < 0 &&
    seconds >= 0 &&
    seconds <= TRAFFIC_CLOCK_LOOKAHEAD_SECONDS &&
    missNm <= TRAFFIC_THRESHOLDS.ta.dmodNm &&
    (Math.abs(vertical) <= TRAFFIC_THRESHOLDS.ta.verticalFt ||
      Math.abs(vertical + ((targetVs - ownVs) * seconds) / 60) <=
        TRAFFIC_THRESHOLDS.ta.verticalFt);
  for (const level of ["close", "ta"] as const) {
    const threshold = TRAFFIC_THRESHOLDS[level];
    const modifiedTau =
      dot < 0 ? (range * range - threshold.dmodNm ** 2) / -dot : Infinity;
    const horizontal =
      range <= threshold.dmodNm ||
      (seconds >= 0 &&
        modifiedTau <= threshold.seconds &&
        missNm <= threshold.dmodNm);
    const predicted =
      vertical +
      ((targetVs - ownVs) * Math.min(threshold.seconds, Math.max(0, seconds))) /
        60;
    if (
      horizontal &&
      (Math.abs(vertical) <= threshold.verticalFt ||
        Math.abs(predicted) <= threshold.verticalFt)
    )
      return {
        clockVisible,
        advisory: {
          hex: target.hex,
          level,
          distanceNm: range,
          relativeAltitudeFt: vertical,
          bearingDeg: initialBearingDeg(position, intruder),
          seconds: Math.max(0, seconds),
        },
      };
  }
  return { clockVisible, advisory: null };
}

/** Existing alert thresholds are independent of the earlier visual traffic-search cue. */
export function trafficAdvisory(
  own: TrafficMotion | null,
  target: TrafficAircraft,
  now: number,
  identity?: AircraftIdentity,
): TrafficAdvisory | null {
  return trafficSituation(own, target, now, identity)?.advisory ?? null;
}
