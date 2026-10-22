import { expect, test } from "vitest";
import { openFlightMapsCycle, openFlightMapsTiles } from "./openflightmaps";

test.each([
  ["2026-10-01T00:00:00Z", "2610"],
  ["2026-10-28T23:59:59Z", "2610"],
  ["2026-10-29T00:00:00Z", "2611"],
  ["2026-01-01T00:00:00Z", "2513"],
  ["2026-01-22T00:00:00Z", "2601"],
  ["2020-12-31T00:00:00Z", "2014"],
])("OFM AIRAC boundary %s uses %s", (date, cycle) => {
  expect(openFlightMapsCycle(new Date(date))).toBe(cycle);
});

test("OFM overlay requests the aviation tiles rather than the opaque base", () => {
  expect(openFlightMapsTiles("2610")).toBe(
    "https://nwy-tiles-api.prod.newaydata.com/tiles/{z}/{x}/{y}.png?path=2610/aero/latest",
  );
});
