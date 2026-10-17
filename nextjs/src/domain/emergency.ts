import { type Airport, type Runway } from "~/data/schemas";
import { type EmergencyPhase } from "~/data/emergency";
import { type FlightPhase } from "./flight-phase";
import { isRunning, type Timers } from "./flight-timers";
import { destinationPoint, distanceNm, trackOffset, type LatLon } from "./geo";
import { flyByRoute } from "./fly-by";

export const EMERGENCY_MAX_AGE_MS = 20_000;
export type EmergencyTarget = {
  airport: string;
  runway: string;
  threshold: LatLon & { elevationFt: number };
  final: LatLon;
  inboundTrueDeg: number;
  suitability: "unknown";
};
export type EmergencyMeasurement = {
  at: number;
  altitudeAmslFt: number | null;
  altitudeDatum: "AMSL" | "ellipsoid" | "unknown";
  groundSpeedKt: number | null;
  verticalSpeedFpm: number | null;
};

/** No altitude/speed threshold establishes an emergency phase. Takeoff criteria require a pilot. */
export function emergencyContext(
  phase: FlightPhase,
  timers: Timers,
  fixAt: number | null,
  now: number,
): { airborne: boolean; phase: EmergencyPhase | null } {
  const fresh =
    fixAt !== null && now - fixAt >= 0 && now - fixAt <= EMERGENCY_MAX_AGE_MS;
  const airborne =
    fresh &&
    isRunning(timers.airTime) &&
    ["climb", "cruise", "descent", "landing"].includes(phase);
  return {
    airborne,
    phase:
      airborne && ["cruise", "descent", "landing"].includes(phase)
        ? "flight"
        : null,
  };
}

/** Current trend, threshold AMSL reference, no wind or landing margin. Zero GS is valid. */
export function emergencyRange(
  samples: readonly EmergencyMeasurement[],
  referenceFt: number | null,
  now: number,
) {
  const last = samples.at(-1);
  if (
    !last ||
    now - last.at < 0 ||
    now - last.at > EMERGENCY_MAX_AGE_MS ||
    referenceFt === null ||
    !Number.isFinite(referenceFt)
  )
    return null;
  const window = samples.filter(
    (s) => last.at - s.at >= 0 && last.at - s.at <= 10_000,
  );
  if (
    !window.length ||
    window.some(
      (s) =>
        s.altitudeDatum !== "AMSL" ||
        s.altitudeAmslFt === null ||
        !Number.isFinite(s.altitudeAmslFt) ||
        s.groundSpeedKt === null ||
        !Number.isFinite(s.groundSpeedKt) ||
        s.groundSpeedKt < 0 ||
        s.verticalSpeedFpm === null ||
        !Number.isFinite(s.verticalSpeedFpm),
    )
  )
    return null;
  const average = (read: (s: EmergencyMeasurement) => number) =>
    window.reduce((a, s) => a + read(s), 0) / window.length;
  const descentFpm = -average((s) => s.verticalSpeedFpm!);
  if (descentFpm < 50) return null;
  const heightFt = Math.max(0, last.altitudeAmslFt! - referenceFt);
  const minutes = heightFt / descentFpm;
  return {
    radiusNm: (average((s) => s.groundSpeedKt!) * minutes) / 60,
    minutes,
    heightFt,
    referenceFt,
    ageMs: now - last.at,
  };
}

function validPosition(p: LatLon) {
  return (
    Number.isFinite(p.lat) &&
    Math.abs(p.lat) <= 90 &&
    Number.isFinite(p.lon) &&
    Math.abs(p.lon) <= 180
  );
}

/** Uses only explicit landing thresholds and true headings; never synthesizes a threshold from ARP. */
export function emergencyTarget(
  airport: Airport,
  runway: Runway,
): EmergencyTarget | null {
  const t = runway.threshold;
  // Bundled legacy notes have no machine-readable runway status. Any closure mention
  // conservatively disqualifies the airport until structured, current availability exists.
  if (
    /zamkni|zamknie|nieczynn|\bclosed\b|\bunavailable\b/i.test(
      airport.remarks ?? "",
    )
  )
    return null;
  if (
    !t ||
    !validPosition(t) ||
    !Number.isFinite(t.elevationFt) ||
    !Number.isFinite(runway.trueHeadingDeg) ||
    runway.lengthM === 0 ||
    runway.ldaM === 0
  )
    return null;
  return {
    airport: airport.ident,
    runway: runway.designator,
    threshold: { ...t },
    final: destinationPoint(t, runway.trueHeadingDeg + 180, 0.5),
    inboundTrueDeg: runway.trueHeadingDeg,
    suitability: "unknown",
  };
}

/** Reverse the existing rate-one departure connector: its turn must finish by F, then retain all F→T. */
export function emergencyApproach(
  position: LatLon,
  target: EmergencyTarget,
  speedKt: number | null,
) {
  if (!validPosition(position)) return null;
  const offset = trackOffset(target.final, target.threshold, position);
  if (
    Math.abs(offset.crossTrackNm) < 0.01 &&
    offset.alongTrackNm >= 0 &&
    offset.alongTrackNm < 0.5
  )
    return {
      points: [position, target.threshold],
      distanceNm: distanceNm(position, target.threshold),
      established: true,
    };
  if (speedKt === null || !Number.isFinite(speedKt) || speedKt <= 0)
    return null;
  const candidates = (["left", "right"] as const)
    .map((direction) => {
      const path = flyByRoute(
        [
          {
            ...target.final,
            initialCourseDeg: target.inboundTrueDeg + 180,
            initialTurnDirection: direction,
          },
          position,
        ],
        { tasKt: speedKt },
      );
      if (path.issues.length) return null;
      const points = [...path.points].reverse();
      points.push(target.threshold);
      return {
        points,
        established: false,
        distanceNm: points.reduce(
          (sum, p, i) => sum + (i ? distanceNm(points[i - 1]!, p) : 0),
          0,
        ),
      };
    })
    .filter((p) => p !== null)
    .sort((a, b) => a.distanceNm - b.distanceNm);
  return candidates[0] ?? null;
}

/** Nearest airport by threshold distance, then shortest feasible runway approach; deterministic ties. */
export function emergencyCandidates(
  airports: readonly Airport[],
  position: LatLon,
  speedKt: number | null,
  maxAirports = Infinity,
) {
  const groups = airports
    .map((airport) => {
      const targets = airport.runways.flatMap((r) => {
        const t = emergencyTarget(airport, r);
        return t ? [t] : [];
      });
      const nearestNm = Math.min(
        ...targets.map((t) => distanceNm(position, t.threshold)),
      );
      return { targets, nearestNm, ident: airport.ident };
    })
    .filter((group) => group.targets.length)
    .sort(
      (a, b) => a.nearestNm - b.nearestNm || a.ident.localeCompare(b.ident),
    );
  const candidates: {
    target: EmergencyTarget;
    approach: NonNullable<ReturnType<typeof emergencyApproach>>;
    nearestNm: number;
  }[] = [];
  let feasibleAirports = 0;
  for (const group of groups) {
    const runways = group.targets.flatMap((target) => {
      const approach = emergencyApproach(position, target, speedKt);
      return approach ? [{ target, approach, nearestNm: group.nearestNm }] : [];
    });
    candidates.push(
      ...runways.sort(
        (a, b) =>
          a.approach.distanceNm - b.approach.distanceNm ||
          a.target.runway.localeCompare(b.target.runway),
      ),
    );
    if (runways.length && ++feasibleAirports >= maxAirports) break;
  }
  return candidates;
}
