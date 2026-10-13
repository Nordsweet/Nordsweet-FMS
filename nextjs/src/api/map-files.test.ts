import { expect, test } from "vitest";
import { parseMapAirspace } from "./map-files";
test("legacy items JSON imports circles and string frequencies through the boundary", () => {
  const [zone] = parseMapAirspace(
    JSON.stringify({
      items: [
        {
          name: "TEST ATZ",
          lower: "GND",
          upper: "2000FT",
          circle: { center: { lat: 50, lon: 19 }, radiusNm: 3 },
          frequencies: ["123.450"],
        },
      ],
    }),
  );
  expect(zone?.geometry.coordinates[0]).toHaveLength(73);
  expect(zone?.properties.frequencies[0]?.frequencyMhz).toBe("123.450");
  expect(() =>
    parseMapAirspace(
      JSON.stringify({
        items: [{ name: "BAD", points: [{ lat: 95, lon: 19 }] }],
      }),
    ),
  ).toThrow();
});
