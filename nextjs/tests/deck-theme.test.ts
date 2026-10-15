import { describe, expect, it } from "vitest";

import { lighten, palettes, themeOf } from "~/features/map/deck/theme";

describe("map theme", () => {
  it("only the plain OpenStreetMap basemap is light", () => {
    expect(themeOf("osm")).toBe("light");
    expect(themeOf("dark")).toBe("dark");
    expect(themeOf("night")).toBe("dark");
  });

  it("lightens towards white and keeps the alpha", () => {
    expect(lighten([0, 100, 200, 128], 0)).toEqual([0, 100, 200, 128]);
    expect(lighten([0, 100, 200, 128], 0.5)).toEqual([128, 178, 228, 128]);
    expect(lighten([10, 20, 30, 255], 1)).toEqual([255, 255, 255, 255]);
  });

  it("dark labels are lighter than the light ones", () => {
    const luma = ([r, g, b]: number[]) =>
      0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
    for (const key of [
      "airportTitle",
      "ifrName",
      "vfrName",
      "callsign",
      "flightData",
      "ownship",
    ] as const)
      expect(luma(palettes.dark[key])).toBeGreaterThan(
        luma(palettes.light[key]),
      );
  });
});
