import { expect, test } from "vitest";
import { mapPreferencesSchema, migrateMap, readLegacyMap } from "./map";
import { flightSchema, newFlight } from "~/data/flight";
import {
  flightFromNordRoute,
  nordDocumentSchema,
  toNordFile,
} from "~/data/nord";

test("legacy Black basemap migrates, obsolete secret-bearing providers do not", () => {
  expect(readLegacyMap({ getItem: () => "black" })).toEqual({
    basemap: "dark",
  });
  expect(readLegacyMap({ getItem: () => "google" })).toEqual({});
  expect(mapPreferencesSchema.parse({}).labels).toBe(true);
});

test("the dark map is a stored basemap choice; unknown ones fall back to the default", () => {
  expect(mapPreferencesSchema.parse({ basemap: "night" }).basemap).toBe(
    "night",
  );
  expect(mapPreferencesSchema.parse({ basemap: "fjord" }).basemap).toBe(
    "fjord",
  );
  expect(mapPreferencesSchema.safeParse({ basemap: "satellite" }).success).toBe(
    false,
  );
  expect(mapPreferencesSchema.parse({ basemap: "dark-matter" }).basemap).toBe(
    "dark-matter",
  );
  expect(mapPreferencesSchema.parse({}).basemap).toBe("bright");
});

test("old flights gain defaults; map restrictions and anchors survive nord export/import", () => {
  const original = newFlight();
  original.departure = { ident: "EPKK", lat: 50, lon: 19 };
  original.destination = { ident: "EPWA", lat: 52, lon: 21 };
  const { pointRestrictions: _ignored, ...old } = original;
  expect(flightSchema.parse(old).pointRestrictions).toEqual({});
  original.pointRestrictions = {
    "WPT 1": { speedKt: 90, altitudeFt: 0, altitudeMode: "above" },
  };
  original.waypoints = [
    { ident: "WPT 1", lat: 51, lon: 20, anchor: { from: "EPKK", to: "EPWA" } },
  ];
  const decoded = flightFromNordRoute(
    nordDocumentSchema.parse(JSON.parse(toNordFile(original, null))).route,
    [],
  );
  expect(decoded.pointRestrictions).toEqual(original.pointRestrictions);
  expect(decoded.waypoints).toEqual(original.waypoints);
});

test("a stored OpenStreetMap or Fjord default moves to Bright; later choices are kept", () => {
  expect(migrateMap({ basemap: "osm", labels: false }, 1)).toEqual({
    basemap: "bright",
    labels: false,
  });
  expect(migrateMap({ basemap: "fjord" }, 2)).toEqual({ basemap: "bright" });
  expect(migrateMap({ basemap: "osm" }, 3)).toEqual({ basemap: "osm" });
  expect(migrateMap({ basemap: "night" }, 1)).toEqual({ basemap: "night" });
});
