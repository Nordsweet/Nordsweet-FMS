import fs from "node:fs";

import { describe, expect, it } from "vitest";

import { datasetSchemas } from "~/data/schemas";

import {
  findAirport,
  searchAirports,
  searchKey,
  searchNavpoints,
} from "./search";

const load = (name: "airports" | "navpoints") =>
  JSON.parse(fs.readFileSync(`public/data/${name}.json`, "utf8")) as unknown;
const airports = datasetSchemas.airports.parse(load("airports"));
const navpoints = datasetSchemas.navpoints.parse(load("navpoints"));

describe("searchKey", () => {
  it("folds case and Polish diacritics", () => {
    expect(searchKey("Łódź Lublinek")).toBe("lodz lublinek");
  });
});

describe("airports", () => {
  it("finds by exact ICAO first", () => {
    expect(searchAirports(airports, "epnt")[0]?.name).toBe("Nowy Targ");
  });

  it("finds by name without diacritics", () => {
    expect(searchAirports(airports, "krakow").map((a) => a.ident)).toContain(
      "EPKK",
    );
  });

  it("resolves legacy truncated codes", () => {
    expect(findAirport(airports, "antono")?.ident).toBe("ANTONOWO");
  });

  it("drops the legacy test airport", () => {
    expect(findAirport(airports, "EPXX")).toBeUndefined();
  });
});

describe("navpoints", () => {
  it("finds IFR waypoints, VFR points and navaids", () => {
    expect(searchNavpoints(navpoints, "ABAKU")[0]?.kind).toBe("ifr-waypoint");
    expect(searchNavpoints(navpoints, "EPMLA")[0]?.kind).toBe(
      "vfr-reporting-point",
    );
    expect(searchNavpoints(navpoints, "BYZ")[0]?.navaid?.type).toBe("DVOR/DME");
  });
});
