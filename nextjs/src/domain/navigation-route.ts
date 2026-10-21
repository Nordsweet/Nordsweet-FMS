import { type RoutePlan, formatRoutePoint, pointKey } from "./route-plan";
import { type NavPoint } from "./progress";

/** Map, preview and accepted FPL share the same fixes, turn flags and published circuit levels. */
export function navigationRoute(plan: RoutePlan): NavPoint[] {
  return plan.points
    .filter((p) => !p.isProfilePoint)
    .map((p) => ({
      ident: formatRoutePoint({ ...p, profileLabels: undefined }),
      lat: p.lat,
      lon: p.lon,
      flyOver: p.flyOver,
      ...(p.patternId
        ? {
            patternId: p.patternId,
            patternOperation: p.patternOperation,
            altitudeFt:
              p.patternOperation === "leave"
                ? plan.pointAltitudeByKey[pointKey(p)]
                : p.patternAltitudeFt,
            turnPerformance: p.turnPerformance,
          }
        : {}),
    }));
}
