import { expect, test } from "vitest";
import {
  brightRules as rules,
  brightRulesByLayer as index,
  BRIGHT_BACKGROUND,
} from "~/features/map/deck/bright";
import {
  ruleMatches,
  ruleColor,
  placeLabels,
  type Feature,
} from "~/features/map/deck/fjord";
const feature = (
  type: string,
  layer: string,
  properties: Record<string, unknown> = {},
): Feature => ({
  geometry: { type, coordinates: [19, 50] },
  properties: { layerName: layer, ...properties },
});
const matching = (f: Feature, z: number) =>
  (index.get(String(f.properties.layerName)) ?? [])
    .map((i) => rules[i]!)
    .filter((r) => ruleMatches(r, f, z));

test("the OSM OpenMapTiles background and water are kept; tunnels are not drawn", () => {
  expect(BRIGHT_BACKGROUND).toBe("hsl(40, 26%, 93%)");
  expect(
    matching(feature("Polygon", "water"), 8).map((r) => ruleColor(r, 8)),
  ).toHaveLength(1);
  expect(
    matching(feature("Polygon", "water", { brunnel: "tunnel" }), 8),
  ).toHaveLength(0);
  const tunnel = feature("LineString", "transportation", {
    class: "primary",
    brunnel: "tunnel",
  });
  expect(matching(tunnel, 12)).toHaveLength(0);
});

test("a bridge is drawn like its road: casing and fill", () => {
  const road = (brunnel?: string) =>
    feature("LineString", "transportation", { class: "primary", brunnel });
  expect(matching(road("bridge"), 12)).toHaveLength(
    matching(road(), 12).length,
  );
  expect(matching(road(), 12).length).toBeGreaterThanOrEqual(2);
});

test("runways and taxiways keep their zoom floor", () => {
  const runway = feature("LineString", "aeroway", { class: "runway" });
  expect(matching(runway, 10)).toHaveLength(0);
  expect(matching(runway, 12)).toHaveLength(1);
});

test("place names keep their case and follow the style's zoom bounds", () => {
  const kraków = feature("Point", "place", {
    name: "Kraków",
    class: "city",
    rank: 3,
  });
  expect(placeLabels([kraków], 8, rules, index).map((l) => l.text)).toEqual([
    "Kraków",
  ]);
  expect(placeLabels([kraków], 15, rules, index)).toHaveLength(0);
});
