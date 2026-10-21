import { describe, expect, it } from "vitest";

import {
  type InspirationFilters,
  filterRoutes,
  filterSpots,
  flightMinutes,
  inspirationPoint,
  routeOutline,
  routeToPlan,
  routeTrip,
  tilePreview,
} from "./inspiration";

const kraków = { lat: 50.0777, lon: 19.7848 };
const spot = (id: string, lat: number, lon: number, rest = {}) => ({
  id,
  lat,
  lon,
  icao: null,
  kind: "scenic",
  interests: ["nature"],
  ...rest,
});
const wawel = spot("wawel", 50.054, 19.935, {
  kind: "attraction",
  interests: ["history", "city"],
});
const hel = spot("hel", 54.6, 18.8, { interests: ["coast"] });
const none: InspirationFilters = {
  maxDistanceNm: null,
  maxMinutes: null,
  interests: [],
  kinds: [],
  favoritesOnly: false,
};
const ids = (list: { id: string }[]) => list.map((s) => s.id);

describe("filterSpots", () => {
  it("sorts nearest first from an origin and keeps list order without one", () => {
    expect(ids(filterSpots([hel, wawel], none, kraków, 100, []))).toEqual([
      "wawel",
      "hel",
    ]);
    expect(ids(filterSpots([hel, wawel], none, null, 100, []))).toEqual([
      "hel",
      "wawel",
    ]);
  });

  it("limits by distance and by flight time at the cruise speed", () => {
    // Hel is ~265 NM from Kraków: 159 min at 100 kt, 80 min at 200 kt.
    const far = { ...none, maxDistanceNm: 100 };
    expect(ids(filterSpots([hel, wawel], far, kraków, 100, []))).toEqual([
      "wawel",
    ]);
    const quick = { ...none, maxMinutes: 120 };
    expect(ids(filterSpots([hel, wawel], quick, kraków, 100, []))).toEqual([
      "wawel",
    ]);
    expect(ids(filterSpots([hel, wawel], quick, kraków, 200, []))).toEqual([
      "wawel",
      "hel",
    ]);
  });

  it("cannot measure limits without an origin, so it shows everything", () => {
    const limited = { ...none, maxDistanceNm: 1, maxMinutes: 1 };
    expect(filterSpots([hel, wawel], limited, null, 100, [])).toHaveLength(2);
  });

  it("matches any chosen interest or kind, and favorites only", () => {
    const history = { ...none, interests: ["history", "coast"] };
    expect(filterSpots([hel, wawel], history, null, 100, [])).toHaveLength(2);
    expect(
      ids(
        filterSpots(
          [hel, wawel],
          { ...none, kinds: ["scenic"] },
          null,
          100,
          [],
        ),
      ),
    ).toEqual(["hel"]);
    expect(
      ids(
        filterSpots([hel, wawel], { ...none, favoritesOnly: true }, null, 100, [
          "wawel",
        ]),
      ),
    ).toEqual(["wawel"]);
  });
});

describe("routes", () => {
  const stop = (
    id: string,
    lat: number,
    lon: number,
    icao: string | null = null,
  ) => ({
    id,
    lat,
    lon,
    icao,
  });
  const route = {
    id: "r",
    interests: ["coast"],
    distance_nm: 130,
    stops: [
      stop("epgd", 54.3776, 18.4662, "EPGD"),
      stop("hel", 54.6, 18.8),
      stop("leba", 54.74, 17.4),
    ],
  };

  it("a route trip is the leg to its start plus the route itself", () => {
    expect(routeTrip(route, null)).toBe(130);
    expect(routeTrip(route, kraków)).toBeGreaterThan(130 + 250);
  });

  it("filters the whole trip, not just the route length", () => {
    const f = { ...none, maxDistanceNm: 200 };
    expect(filterRoutes([route], f, null, 100, [])).toHaveLength(1);
    expect(filterRoutes([route], f, kraków, 100, [])).toHaveLength(0);
    expect(
      filterRoutes([route], { ...none, interests: ["history"] }, null, 100, []),
    ).toHaveLength(0);
  });

  it("becomes departure, waypoints and destination, airports keeping their ICAO code", () => {
    expect(routeToPlan(route.stops)).toEqual({
      departure: { ident: "EPGD", lat: 54.3776, lon: 18.4662 },
      waypoints: [{ ident: "HEL", lat: 54.6, lon: 18.8 }],
      destination: { ident: "LEBA", lat: 54.74, lon: 17.4 },
    });
    expect(routeToPlan(route.stops.slice(0, 1))).toMatchObject({
      destination: null,
      waypoints: [],
    });
    expect(inspirationPoint(stop("czeski-raj", 50.5, 15.2))).toMatchObject({
      ident: "CZESKI-RAJ",
    });
  });
});

it("estimates minutes straight-line at the cruise speed", () => {
  expect(flightMinutes(100, 100)).toBe(60);
  expect(flightMinutes(50, 120)).toBe(25);
});

describe("previews", () => {
  it("puts the spot inside the 2x2 tile block, away from its outer edge", () => {
    const { tiles, offsetPx, zoom } = tilePreview(kraków);
    expect(zoom).toBe(9);
    expect(tiles).toHaveLength(4);
    // Kraków is tile 568/344 at zoom 10 (OSM slippy map), so 284/172 at zoom 9.
    expect(tiles.map((t) => `${t.x}/${t.y}`)).toContain("284/172");
    for (const o of [offsetPx.x, offsetPx.y]) {
      expect(o).toBeGreaterThanOrEqual(128);
      expect(o).toBeLessThanOrEqual(384);
    }
  });

  it("scales a route outline into the box with north up", () => {
    const points = routeOutline([
      { lat: 54, lon: 18 },
      { lat: 50, lon: 18 },
    ]);
    expect(points[0]!.y).toBeLessThan(points[1]!.y);
    for (const p of points) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThanOrEqual(100);
    }
    expect(routeOutline([])).toEqual([]);
    expect(routeOutline([{ lat: 50, lon: 19 }])).toHaveLength(1);
  });
});
