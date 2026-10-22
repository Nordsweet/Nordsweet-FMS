import type { Airport } from "~/data/schemas";
import { flyByRoute, type TurnPerformance } from "./fly-by";
import { distanceNm, initialBearingDeg, type LatLon } from "./geo";
import { nearestLeg, type NavPoint } from "./progress";
import { windTriangle, type Wind } from "./wind";

export type ArrivalLeg = {
  tasKt: number;
  fuelFlowLph: number;
  wind: Wind;
};

/** Remaining curved FPL to the next occurrence of an airport, otherwise present-position Direct. */
export function airportArrival(input: {
  airport: Pick<Airport, "ident" | "aliases" | "lat" | "lon">;
  position: LatLon;
  route: NavPoint[];
  activeLeg: number;
  turns: TurnPerformance;
  legs: ArrivalLeg[];
  direct: ArrivalLeg;
  currentFuelL: number;
}) {
  const { airport, position, route, activeLeg, turns, legs, direct } = input;
  const codes = [airport.ident, ...airport.aliases].map((s) => s.toUpperCase());
  const target = route.findIndex(
    (p, i) =>
      i > activeLeg &&
      ((codes.includes(p.ident.toUpperCase()) &&
        distanceNm(p, airport) < 0.3) ||
        (i === route.length - 1 &&
          codes.some(
            (code) =>
              p.ident.toUpperCase().endsWith("/" + code) ||
              p.ident.toUpperCase().startsWith(code + " THR"),
          ) &&
          distanceNm(p, airport) < 3)),
  );
  const mode = target < 0 ? "direct" : "route";
  const segments: {
    from: LatLon;
    to: LatLon;
    nm: number;
    model: ArrivalLeg;
  }[] = [];
  if (target < 0) {
    segments.push({
      from: position,
      to: airport,
      nm: distanceNm(position, airport),
      model: direct,
    });
  } else {
    // A landing is a stop at this occurrence, even when the FPL continues afterwards.
    const remaining = route.slice(0, target + 1);
    remaining[target] = { ...remaining[target]!, flyOver: true };
    const path = flyByRoute(remaining, turns);
    const projection = nearestLeg(path, position, activeLeg);
    if (!projection) return null;
    for (let i = projection.index; i < path.legs.length; i++) {
      const from = path.points[i]!;
      const to = path.points[i + 1]!;
      const model = legs[path.legs[i]!] ?? direct;
      segments.push({
        from,
        to,
        nm:
          i === projection.index
            ? projection.remaining + projection.distance
            : distanceNm(from, to),
        model,
      });
    }
  }
  let distance = 0;
  let hours = 0;
  let fuelBurnL = 0;
  for (const { from, to, nm, model } of segments) {
    if (
      !Number.isFinite(model.tasKt) ||
      model.tasKt <= 0 ||
      !Number.isFinite(model.fuelFlowLph) ||
      model.fuelFlowLph < 0
    )
      return null;
    if (nm < 1e-8) continue;
    const speed = windTriangle(
      initialBearingDeg(from, to),
      model.tasKt,
      model.wind,
    );
    if (!speed || !Number.isFinite(speed.groundSpeedKt)) return null;
    const duration = nm / speed.groundSpeedKt;
    distance += nm;
    hours += duration;
    fuelBurnL += duration * model.fuelFlowLph;
  }
  if (!Number.isFinite(input.currentFuelL) || input.currentFuelL < 0)
    return null;
  return {
    mode,
    distanceNm: distance,
    minutes: hours * 60,
    fuelBurnL,
    fuelL: Math.max(0, input.currentFuelL - fuelBurnL),
    enoughFuel: fuelBurnL <= input.currentFuelL,
  };
}
