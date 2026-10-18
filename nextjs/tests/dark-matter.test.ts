import { expect, test } from "vitest";
import {
  darkMatterRules as rules,
  darkMatterRulesByLayer as index,
  DARK_MATTER_BACKGROUND,
} from "~/features/map/deck/dark-matter";
import {
  ruleMatches,
  ruleColor,
  placeLabels,
  declutter,
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
test("official Dark Matter water is distinct from background and excludes underground water", () => {
  expect(DARK_MATTER_BACKGROUND).toBe("rgb(12,12,12)");
  const water = matching(feature("MultiPolygon", "water"), 8);
  expect(water).toHaveLength(1);
  expect(ruleColor(water[0]!, 8)).toEqual([27, 27, 29, 255]);
  expect(
    matching(feature("Polygon", "water", { brunnel: "tunnel" }), 8),
  ).toHaveLength(0);
  expect(matching(feature("LineString", "water"), 8)).toHaveLength(0);
});
test("source forest opacity and zoom bounds are preserved", () => {
  const wood = feature("Polygon", "landcover", { class: "wood" });
  expect(matching(wood, 9)).toHaveLength(0);
  expect(ruleColor(matching(wood, 10)[0]!, 10)).toEqual([32, 32, 32, 204]);
  expect(ruleColor(matching(wood, 13)[0]!, 13)).toEqual([32, 32, 32, 102]);
  expect(
    matching(feature("Polygon", "landcover", { subclass: "glacier" }), 8),
  ).toHaveLength(0);
});
test("motorway paint stops are interpolated without applying the old night raster filter", () => {
  const inner = rules.find((r) => r.colorStops)!;
  expect(ruleColor(inner, 6)).toEqual([0, 0, 0, 255]);
  const mid = ruleColor(inner, 5.9);
  expect(mid[0]).toBeGreaterThan(0);
  expect(mid[0]).toBeLessThan(217);
  expect(
    matching(
      feature("LineString", "transportation", { class: "motorway" }),
      6,
    ).some((r) => r === inner),
  ).toBe(true);
});
test("Dark Matter place rules use their own priorities and stop at source max zoom", () => {
  const city = feature("Point", "place", {
    name: "Kraków",
    class: "city",
    rank: 1,
  });
  const labels = placeLabels([city], 9, rules, index);
  expect(labels).toHaveLength(1);
  expect(labels[0]!.text).toBe("KRAKÓW");
  expect(declutter(labels, 9, rules)).toHaveLength(1);
  expect(ruleColor(rules[labels[0]!.rule]!, 9)).toEqual([101, 101, 101, 255]);
  expect(placeLabels([city], 14, rules, index)).toHaveLength(0);
});
