import { describe, expect, it } from "vitest";
import {
  aipCatalogSchema,
  chartLibrarySchema,
  type ChartOverlay,
} from "~/data/charts";
import { airportSchema, type Procedure } from "~/data/schemas";
import { browserCharts, chartAirports, chartTaxiPaths } from "./chart-browser";

const airport = airportSchema.parse({
  ident: "EPNT",
  aliases: [],
  isIcao: true,
  name: "Curated Nowy Targ",
  country: "PL",
  type: "aerodrome",
  lat: 49,
  lon: 20,
  elevationFt: 2060,
  runways: [],
  weatherStation: null,
  contact: null,
  links: [],
  remarks: null,
  source: "editor",
});
const catalog = aipCatalogSchema.parse({
  packages: [],
  airports: [
    {
      icao: "EPNT",
      name: "Upstream name",
      lat: 50,
      lon: 21,
      volume: "VFR",
      source_url: "https://docs.pansa.pl/",
    },
    {
      icao: "EPXX",
      name: "New MIL",
      lat: 52,
      lon: 20,
      volume: "MIL",
      source_url: "https://docs.pansa.pl/",
    },
  ],
  charts: [
    {
      id: "a".repeat(64),
      airport: "EPNT",
      title: "AERODROME CHART",
      category: "aerodrome",
      volume: "VFR",
      source_url: "https://docs.pansa.pl/a.pdf",
      sha256: "b".repeat(64),
      bytes: 500,
      effective_from: "2026-10-01",
      effective_until: "2026-10-29",
    },
  ],
});
const library = chartLibrarySchema.parse({
  revision: 2,
  ground: {
    EPNT: {
      chartOverlay: {
        chart: {
          src: "./charts/Poland/EPNT/National%20AIP/AD4.pdf",
          title: "Our calibrated sheet",
        },
        intersections: [],
        taxiwayPaths: {},
      },
    },
  },
  charts: [{ path: "Poland/EPNT/National AIP/AD4.pdf", revision: 3 }],
  revisions: { "Poland/EPNT/National AIP/AD4.pdf": 3 },
});
const procedure = (id: string, designator: string): Procedure => ({
  id,
  designator,
  airport: "EPNT",
  type: "SID",
  runways: ["12"],
  source: "reference",
  legs: [
    {
      ident: "FIX",
      lat: 49,
      lon: 20,
      altitude: null,
      speedKt: null,
      trackMagDeg: 120,
      distanceNm: 2,
    },
  ],
});

describe("chart browser catalog", () => {
  it("adds published airports without replacing curated runway/position data", () => {
    const airports = chartAirports([airport], catalog);
    expect(airports.find((a) => a.ident === "EPNT")).toEqual(airport);
    expect(airports.find((a) => a.ident === "EPXX")).toMatchObject({
      name: "New MIL",
      type: "military",
      lat: 52,
      lon: 20,
    });
  });
  it("keeps official and editor charts separate and combines Nord procedures on the same runway", () => {
    const result = browserCharts(
      catalog,
      library,
      [
        {
          airport: "EPNT",
          title: "duplicate",
          src: "/charts/Poland/EPNT/National%20AIP/AD4.pdf",
        },
      ],
      [procedure("one", "FIRST1A"), procedure("two", "SECOND1A")],
    );
    expect(result).toHaveLength(3);
    expect(result.find((c) => c.source === "aip")).toMatchObject({
      effectiveUntil: "2026-10-29",
      category: "aerodrome",
      pdf: { kind: "aip" },
    });
    expect(result.find((c) => c.source === "library")).toMatchObject({
      pdf: { kind: "library", revision: 3 },
      overlay: { chart: { title: "Our calibrated sheet" } },
    });
    expect(result.find((c) => c.source === "nord")?.procedureIds).toEqual([
      "one",
      "two",
    ]);
    expect(result.find((c) => c.source === "aip")?.overlay).toBeUndefined();
  });
  it("rejects malformed and traversing library paths without breaking other sources", () => {
    const invalid = structuredClone(library);
    invalid.ground.EPNT!.chartOverlay!.chart!.src = "%oops";
    expect(
      browserCharts(catalog, invalid, [], []).filter((c) => c.overlay),
    ).toHaveLength(0);
    invalid.ground.EPNT!.chartOverlay!.chart!.src =
      "./charts/%2e%2e/private.pdf";
    expect(
      browserCharts(catalog, invalid, [], []).filter((c) => c.overlay),
    ).toHaveLength(0);
  });
});

it("orients calibrated taxiway paths towards the previous point and breaks missing geometry", () => {
  const overlay: ChartOverlay = {
    intersections: [
      { id: "stand", members: ["STAND"], x: 100, y: 100 },
      { id: "runway", members: ["RW12"], x: 500, y: 500 },
    ],
    taxiwayPaths: {
      A: [
        { x: 300, y: 300 },
        { x: 200, y: 200 },
      ],
    },
  };
  expect(chartTaxiPaths(overlay, ["STAND", "A", "RW12"])).toEqual([
    [
      { id: "stand", members: ["STAND"], x: 100, y: 100 },
      { x: 200, y: 200 },
      { x: 300, y: 300 },
      { id: "runway", members: ["RW12"], x: 500, y: 500 },
    ],
  ]);
  expect(chartTaxiPaths(overlay, ["STAND", "MISSING", "RW12"])).toEqual([]);
});
