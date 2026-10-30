import { describe, expect, it } from "vitest";
import { warsawRadarSector } from "./warsaw-radar";

const current = Date.parse("2026-10-30T12:00:00Z");
describe("published Warsaw ACC sectors", () => {
  it.each([
    [49.4628, 20.0507, "J", "127.660"],
    [50.11, 22.02, "R", "130.875"],
    [52.16, 20.97, "E", "127.450"],
    [52.42, 16.83, "D", "134.225"],
    [51.1, 16.88, "T", "128.325"],
    [54.37, 18.47, "F", "129.075"],
  ])("selects the AIP sector at %s, %s", (lat, lon, sector, frequency) => {
    expect(warsawRadarSector({ lat, lon }, current)).toMatchObject({
      sector: `EPWW ${sector} LOW`,
      frequencyMhz: frequency,
    });
  });
  it("does not select a channel outside its AIRAC or on a sector boundary", () => {
    const krakow = { lat: 49.4628, lon: 20.0507 };
    expect(
      warsawRadarSector(krakow, Date.parse("2026-11-26T00:00:00Z")),
    ).toBeNull();
    expect(
      warsawRadarSector({ lat: 51.7175, lon: 17.23806 }, current),
    ).toBeNull();
    expect(warsawRadarSector({ lat: 48, lon: 20 }, current)).toBeNull();
  });
});
