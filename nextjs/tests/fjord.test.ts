import { describe, expect, it } from "vitest";

import { cssColor } from "~/features/map/deck/color";
import {
  fjordRules,
  fjordRulesByLayer,
  interpolate,
  ruleColor,
  declutter,
  placeLabels,
  ruleMatches,
  stopsAt,
  type Feature,
} from "~/features/map/deck/fjord";

const feature = (type: string, properties: Feature["properties"]): Feature => ({
  geometry: { type, coordinates: [] },
  properties,
});
const matching = (layer: string, f: Feature, zoom: number) =>
  (fjordRulesByLayer.get(layer) ?? []).filter((i) =>
    ruleMatches(fjordRules[i]!, f, zoom),
  );

describe("fjord style", () => {
  it("reads hsl like the style's own colours", () => {
    expect(cssColor("hsl(232, 33%, 34%)")).toEqual([58, 66, 115, 255]);
    expect(cssColor("hsla(228, 60%, 21%, 0.7)")).toEqual([21, 34, 86, 179]);
    expect(cssColor("hsl(0, 0%, 100%)")).toEqual([255, 255, 255, 255]);
  });

  it("interpolates exponentially between stops and stays flat outside them", () => {
    const width = {
      base: 1.55,
      stops: [
        [13, 1.8],
        [20, 20],
      ] as [number, number][],
    };
    expect(interpolate(width, 5)).toBe(1.8);
    expect(interpolate(width, 25)).toBe(20);
    const mid = interpolate(width, 16);
    expect(mid).toBeGreaterThan(1.8);
    // an exponent above 1 stays under the straight line between the stops
    expect(mid).toBeLessThan(1.8 + (20 - 1.8) * (3 / 7));
    expect(
      interpolate(
        {
          base: 1,
          stops: [
            [0, 0],
            [10, 1],
          ],
        },
        5,
      ),
    ).toBe(0.5);
  });

  it("draws a motorway as casing plus inner line from zoom 6, not a tunnelled one", () => {
    const road = feature("LineString", { class: "motorway" });
    expect(matching("transportation", road, 5.9)).toHaveLength(0);
    expect(matching("transportation", road, 6)).toHaveLength(2);
    const tunnel = feature("LineString", {
      class: "motorway",
      brunnel: "tunnel",
    });
    expect(matching("transportation", tunnel, 8)).toHaveLength(0);
  });

  it("filters by geometry, class and zoom range", () => {
    expect(matching("water", feature("MultiPolygon", {}), 3)).toHaveLength(1);
    expect(matching("water", feature("LineString", {}), 3)).toHaveLength(0);
    const wood = feature("Polygon", { class: "wood" });
    expect(matching("landcover", wood, 9.9)).toHaveLength(0);
    expect(matching("landcover", wood, 10)).toHaveLength(1);
    const town = feature("Point", { class: "town", name: "X" });
    expect(matching("place", town, 14.9)).toHaveLength(1);
    expect(matching("place", town, 15)).toHaveLength(0);
  });

  it("separates large cities from small ones by rank, and claimed borders by zoom", () => {
    const big = feature("Point", { class: "city", rank: 2 });
    const small = feature("Point", { class: "city", rank: 5 });
    expect(matching("place", big, 8)).toHaveLength(1);
    expect(matching("place", small, 8)).toHaveLength(1);
    expect(matching("place", big, 12)).toHaveLength(0); // large cities stop at 12
    const claimed = feature("LineString", { admin_level: 2, claimed_by: "XX" });
    expect(matching("boundary", claimed, 4)).toHaveLength(0);
    expect(matching("boundary", claimed, 5)).toHaveLength(1);
  });

  it("folds the zoom-dependent opacity into the alpha", () => {
    const wood = fjordRules.find(
      (r) => r.layer === "landcover" && r.minzoom === 10,
    )!;
    expect(ruleColor(wood, 9)[3]).toBe(0);
    expect(ruleColor(wood, 12)[3]).toBe(wood.color[3]);
    expect(stopsAt(3, 7)).toBe(3);
  });

  it("keeps the more important of two overlapping place names, whatever the order", () => {
    const place = (
      name: string,
      cls: string,
      lon: number,
      lat: number,
      rank?: number,
    ) => ({
      geometry: { type: "Point", coordinates: [lon, lat] },
      properties: { layerName: "place", class: cls, name, rank },
    });
    const features = [
      place("Village", "village", 19.0, 50.0),
      place("City", "city", 19.0, 50.0001, 4),
      place("Far town", "town", 21.0, 50.0),
    ];
    for (const list of [features, [...features].reverse()]) {
      const kept = declutter(placeLabels(list, 9), 9).map((l) => l.text);
      expect(kept).toEqual(["CITY", "FAR TOWN"]);
    }
  });

  it("shows no label without a name, and none outside the rule's zoom range", () => {
    const point = (properties: Feature["properties"]): Feature => ({
      geometry: { type: "Point", coordinates: [19, 50] },
      properties: { layerName: "place", ...properties },
    });
    expect(placeLabels([point({ class: "town" })], 9)).toHaveLength(0);
    expect(placeLabels([point({ class: "town", name: "X" })], 9)).toHaveLength(
      1,
    );
    expect(placeLabels([point({ class: "town", name: "X" })], 15)).toHaveLength(
      0,
    );
    expect(
      placeLabels(
        [point({ class: "town", "name:latin": "Y", name: "Ы" })],
        9,
      )[0]!.text,
    ).toBe("Y");
  });
});
