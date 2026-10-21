import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  activationsResponseSchema,
  airportResponseSchema,
  airspaceResponseSchema,
  atisResponseSchema,
  fuelResponseSchema,
  inspirationResponseSchema,
  placesResponseSchema,
  trafficResponseSchema,
  weatherResponseSchema,
} from "./schemas";

// Responses recorded from https://aviation.lab.vibecde.com on 2026-10-11.
const fixture = (name: string): unknown =>
  JSON.parse(
    fs.readFileSync(
      path.join(import.meta.dirname, "fixtures", `${name}.json`),
      "utf8",
    ),
  );

describe("aviation API schemas accept recorded responses", () => {
  it.each([
    ["airport", airportResponseSchema],
    ["weather", weatherResponseSchema],
    ["weather-missing", weatherResponseSchema],
    ["atis", atisResponseSchema],
    ["fuel", fuelResponseSchema],
    ["traffic", trafficResponseSchema],
    ["airspace", airspaceResponseSchema],
    ["activations", activationsResponseSchema],
    ["places", placesResponseSchema],
    ["inspiration", inspirationResponseSchema],
  ] as const)("%s", (name, schema) => {
    expect(() => schema.parse(fixture(name))).not.toThrow();
  });

  it("keeps a missing METAR as null", () => {
    expect(
      weatherResponseSchema.parse(fixture("weather-missing")).metar,
    ).toBeNull();
  });
});
