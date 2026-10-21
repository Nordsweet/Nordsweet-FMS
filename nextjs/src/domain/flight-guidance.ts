import { angleDiffDeg, normalizeDeg } from "./angles";
import { type FlightPhase } from "./flight-phase";
import { trueToMagneticDeg } from "./magnetic";
import { windTriangle, type Wind } from "./wind";
import { type NavPoint } from "./progress";
import { type RoutePoint, pointKey } from "./route-plan";

/** TOC/TOD affect altitude guidance even though they are not navigable map fixes. */
export function plannedGuidanceAltitude(
  next: NavPoint,
  remainingNm: number,
  plan: {
    points: Pick<
      RoutePoint,
      | "id"
      | "lat"
      | "lon"
      | "routeDistanceNm"
      | "isProfilePoint"
      | "profileLabels"
    >[];
    pointAltitudeByKey: Record<string, number>;
  } | null,
  cruiseAltitudeFt: number,
) {
  if (next.altitudeFt !== undefined && !next.patternId) return next.altitudeFt;
  const target = plan?.points.find(
    (p) =>
      !p.isProfilePoint &&
      Math.abs(p.lat - next.lat) < 0.00001 &&
      Math.abs(p.lon - next.lon) < 0.00001,
  );
  const distance = target?.routeDistanceNm;
  const profile =
    distance !== undefined
      ? plan?.points.find(
          (p) =>
            p.isProfilePoint &&
            p.routeDistanceNm !== undefined &&
            p.routeDistanceNm > distance - remainingNm &&
            p.routeDistanceNm < distance,
        )
      : null;
  return (
    (profile
      ? plan?.pointAltitudeByKey[pointKey(profile)]
      : (next.altitudeFt ?? plan?.pointAltitudeByKey[pointKey(target)])) ??
    cruiseAltitudeFt
  );
}

export type GuidanceCommand =
  | { category: "heading"; direction: "left" | "right"; headingDeg: number }
  | {
      category: "altitude";
      direction: "climb" | "descend" | "levelOff";
      altitudeFt: number;
    };

export function flightGuidanceAvailable(input: {
  now: number;
  phase: FlightPhase;
  fix: { time: string; paused?: boolean; groundSpeedKt: number | null } | null;
}) {
  const age = input.fix ? input.now - Date.parse(input.fix.time) : Infinity;
  return (
    !!input.fix &&
    !input.fix.paused &&
    Number.isFinite(age) &&
    age >= -5000 &&
    age <= 20000 &&
    Number.isFinite(input.fix.groundSpeedKt) &&
    (input.fix.groundSpeedKt ?? 0) >= 30 &&
    input.phase !== "taxiout" &&
    input.phase !== "taxiin"
  );
}

/** Plan guidance uses fresh moving-aircraft samples; track and heading share the same wind correction. */
export function flightGuidance(input: {
  now: number;
  phase: FlightPhase;
  fix: {
    time: string;
    paused?: boolean;
    groundSpeedKt: number | null;
    trackDeg: number | null;
    headingTrueDeg?: number;
    trueAirspeedKt?: number;
    altitudeFt: number | null;
    verticalSpeedFpm?: number | null;
  } | null;
  courseTrueDeg: number | null;
  targetAltitudeFt: number | null;
  variationDeg: number;
  tasKt: number;
  wind: Wind;
}): GuidanceCommand[] {
  const { fix } = input;
  if (!fix || !flightGuidanceAvailable(input)) return [];
  const result: GuidanceCommand[] = [];
  if (
    input.courseTrueDeg !== null &&
    Number.isFinite(input.courseTrueDeg) &&
    fix.trackDeg !== null &&
    Number.isFinite(fix.trackDeg) &&
    input.tasKt > 0
  ) {
    const target = windTriangle(input.courseTrueDeg, input.tasKt, input.wind);
    const current = Number.isFinite(fix.headingTrueDeg)
      ? { headingDeg: fix.headingTrueDeg! }
      : windTriangle(fix.trackDeg, input.tasKt, input.wind);
    if (
      target &&
      current &&
      Math.abs(angleDiffDeg(current.headingDeg, target.headingDeg)) >= 10
    ) {
      result.push({
        category: "heading",
        direction:
          angleDiffDeg(current.headingDeg, target.headingDeg) > 0
            ? "right"
            : "left",
        headingDeg:
          Math.round(
            normalizeDeg(
              trueToMagneticDeg(target.headingDeg, input.variationDeg),
            ),
          ) % 360 || 360,
      });
    }
  }
  const altitude = input.targetAltitudeFt;
  if (
    altitude !== null &&
    Number.isFinite(altitude) &&
    fix.altitudeFt !== null &&
    Number.isFinite(fix.altitudeFt) &&
    Math.abs(altitude - fix.altitudeFt) >= 150
  ) {
    result.push({
      category: "altitude",
      direction: altitude > fix.altitudeFt ? "climb" : "descend",
      altitudeFt: Math.round(altitude),
    });
  }
  return result;
}
