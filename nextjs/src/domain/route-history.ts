import { flyByRoute, type TurnPerformance } from "./fly-by";
import { distanceNm, type LatLon } from "./geo";
import { type NavPoint } from "./progress";

export type RouteHistory = { paths: LatLon[][]; lastPassed: NavPoint };

/** Freeze passed FPL legs before a redirect; repeated DCTs replace only the last-fix connector. */
export function retainPassedRoute(
  history: RouteHistory | null,
  route: NavPoint[],
  activeLeg: number,
  performance: TurnPerformance = { tasKt: 100 },
): RouteHistory | null {
  const index = Math.min(Math.max(0, activeLeg), route.length - 1);
  const lastPassed = route[index];
  if (!lastPassed || (index === 0 && lastPassed.ident === "DCT"))
    return history;
  const prefix = route.slice(0, index + 1);
  const path = flyByRoute(prefix, performance).points;
  return {
    lastPassed,
    paths: [
      ...routeHistoryPaths(history, route),
      ...(path.length > 1 ? [path] : []),
    ],
  };
}

/** Completed geometry remains solid; its last fix connects straight to the current DCT origin. */
export function routeHistoryPaths(
  history: RouteHistory | null,
  route: NavPoint[],
): LatLon[][] {
  if (!history) return [];
  const origin = route[0];
  return [
    ...history.paths,
    ...(origin?.ident === "DCT" &&
    distanceNm(history.lastPassed, origin) > 0.000001
      ? [[history.lastPassed, origin]]
      : []),
  ];
}
