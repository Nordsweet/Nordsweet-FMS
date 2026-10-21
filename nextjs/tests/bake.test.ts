import { expect, test } from "vitest";
import { bakeTile, type Canvas2D } from "~/features/map/deck/bake";
import { type Feature } from "~/features/map/deck/fjord";
import { type VectorStyle } from "~/features/map/deck/vector-styles";
import { indexRules } from "~/features/map/deck/fjord";
import { cssColor } from "~/features/map/deck/color";

const recorder = () => {
  const calls: string[] = [];
  const ctx = {
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 0,
    lineCap: "butt",
    lineJoin: "miter",
    beginPath: () => calls.push("begin"),
    moveTo: (x: number, y: number) => calls.push(`move ${x},${y}`),
    lineTo: (x: number, y: number) => calls.push(`line ${x},${y}`),
    closePath: () => calls.push("close"),
    fill: () => calls.push(`fill ${ctx.fillStyle}`),
    stroke: () => calls.push(`stroke ${ctx.strokeStyle} w${ctx.lineWidth}`),
    fillRect: () => calls.push(`background ${ctx.fillStyle}`),
    setLineDash: (d: number[]) => calls.push(`dash ${d.join(",")}`),
  } satisfies Canvas2D;
  return { ctx, calls };
};
const rules: VectorStyle["rules"] = [
  {
    layer: "water",
    kind: "fill",
    geometry: "Polygon",
    color: cssColor("rgb(10,20,30)"),
  },
  {
    layer: "transportation",
    kind: "line",
    geometry: "LineString",
    minzoom: 12,
    color: cssColor("rgb(200,100,0)"),
    width: 2,
    dash: [3, 1],
  },
];
const style: VectorStyle = {
  id: "bright",
  rules,
  index: indexRules(rules),
  background: "rgb(1,2,3)",
};
const feature = (
  layer: string,
  type: string,
  coordinates: unknown,
): Feature => ({
  geometry: { type, coordinates },
  properties: { layerName: layer },
});
const layers = new Map([
  [
    "water",
    [
      feature("water", "Polygon", [
        [
          [0.1, 0.1],
          [0.2, 0.1],
          [0.2, 0.2],
        ],
      ]),
    ],
  ],
  [
    "transportation",
    [
      feature("transportation", "LineString", [
        [0, 0.5],
        [1, 0.5],
      ]),
      // Far outside the painted quarter of the data tile.
      feature("transportation", "LineString", [
        [0.9, 0.9],
        [1, 0.95],
      ]),
    ],
  ],
]);

test("paints the background, then the rules in style order, scaled to the canvas", () => {
  const { ctx, calls } = recorder();
  bakeTile(
    ctx,
    100,
    1,
    style,
    layers,
    { z: 12, x: 5, y: 7 },
    { z: 12, x: 5, y: 7 },
  );
  expect(calls).toEqual([
    "background rgb(1,2,3)",
    "begin",
    "move 10,10",
    "line 20,10",
    "line 20,20",
    "close",
    "fill rgba(10,20,30,1)",
    "dash 6,2",
    "begin",
    "move 0,50",
    "line 100,50",
    "stroke rgba(200,100,0,1) w2",
    "begin",
    "move 90,90",
    "line 100,95",
    "stroke rgba(200,100,0,1) w2",
  ]);
});

test("a zoomed-in tile takes its quarter of the ancestor and skips what lies outside it", () => {
  const { ctx, calls } = recorder();
  // Top-left child of the data tile: it shows 0..0.5 of the data, magnified 2x.
  bakeTile(
    ctx,
    100,
    1,
    style,
    layers,
    { z: 13, x: 10, y: 14 },
    { z: 12, x: 5, y: 7 },
  );
  expect(calls).toContain("move 20,20");
  expect(calls).toContain("move 0,100");
  expect(calls).not.toContain("move 180,180");
});

test("rules outside their zoom range are not drawn", () => {
  const { ctx, calls } = recorder();
  bakeTile(
    ctx,
    100,
    1,
    style,
    layers,
    { z: 8, x: 0, y: 0 },
    { z: 8, x: 0, y: 0 },
  );
  expect(calls.some((c) => c.startsWith("stroke"))).toBe(false);
  expect(calls.some((c) => c.startsWith("fill"))).toBe(true);
});
