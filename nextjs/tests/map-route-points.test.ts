import { expect, test } from "vitest";
import { withoutRoutePoints } from "~/domain/map-route-points";

const route = [
  { ident: "XEVLU", lat: 50, lon: 20 },
  { ident: "EPNT DELTA", lat: 49.5, lon: 20.1 },
  { ident: "EPNT", lat: 49.46, lon: 20.05 },
];
const points = [
  { ident: "XEVLU", lat: 50, lon: 20 },
  { ident: "EPN TD", aliases: ["EPNT DELTA", "EPNTD"], lat: 49.5, lon: 20.1 },
  { ident: "EPNT", lat: 49.4605, lon: 20.05 },
  { ident: "KELEL", lat: 50.1, lon: 20.1 },
  { ident: "XEVLU", lat: 52, lon: 20 },
];
test("route identities and aliases replace ordinary map points, including rounded airport positions", () => {
  expect(withoutRoutePoints(points, route, true)).toEqual(points.slice(3));
  expect(points).toHaveLength(5);
});
test("removing a point or hiding the route restores the ordinary chart point", () => {
  expect(withoutRoutePoints(points, route.slice(1), true)).toContain(points[0]);
  expect(withoutRoutePoints(points, route, false)).toBe(points);
  expect(withoutRoutePoints(points, [], true)).toBe(points);
});
test("nearby points with different identities remain available", () => {
  const nearby = [{ ident: "OTHER", lat: 50, lon: 20 }];
  expect(withoutRoutePoints(nearby, route, true)).toEqual(nearby);
  expect(
    withoutRoutePoints(points, [{ ...route[0]!, ident: "xev-lu" }], true),
  ).not.toContain(points[0]);
});
