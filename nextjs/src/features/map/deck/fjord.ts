import { cssColor, type Rgba } from "./color";

/**
 * The "Fjord" map: openmaptiles/fiord-color-gl-style (BSD-3 / CC-BY 4.0) ported to deck.gl rules.
 * Colours, widths, zoom ranges and filters are copied from its style.json; layers that need text along
 * a line (road names and refs, water names) or a sprite are left out.
 * Tiles are OpenMapTiles-schema vector tiles (OpenFreeMap: no key, unlike the style's MapTiler source).
 */
export const FJORD_BACKGROUND = "#45516E";
export const FJORD_TILES = "https://tiles.openfreemap.org/planet";
export const FJORD_MAX_TILE_ZOOM = 14;

type Props = Record<string, unknown>;
export type Feature = {
  geometry: { type: string; coordinates: unknown };
  properties: Props;
};
/** [zoom, value] stops with the exponent of Mapbox's `{base, stops}` interpolation. */
export type Stops = { base: number; stops: [number, number][] };

/** Mapbox `interpolate(["exponential", base])` between stops; flat outside them. */
export function interpolate({ base, stops }: Stops, zoom: number) {
  const first = stops[0]!,
    last = stops.at(-1)!;
  if (zoom <= first[0]) return first[1];
  if (zoom >= last[0]) return last[1];
  const i = stops.findIndex(([z]) => z > zoom);
  const [z0, v0] = stops[i - 1]!,
    [z1, v1] = stops[i]!;
  const t =
    base === 1
      ? (zoom - z0) / (z1 - z0)
      : (base ** (zoom - z0) - 1) / (base ** (z1 - z0) - 1);
  return v0 + t * (v1 - v0);
}

export type Rule = {
  layer: string;
  geometry?: "Polygon" | "LineString" | "Point";
  minzoom?: number;
  maxzoom?: number;
  where?: (p: Props, zoom: number) => boolean;
  color: Rgba;
  colorStops?: { base: number; stops: [number, Rgba][] };
  opacity?: number | Stops;
} & (
  | { kind: "fill" }
  | { kind: "line"; width?: number | Stops; dash?: [number, number] }
  | {
      kind: "text";
      size: number | Stops;
      /** Higher wins when labels collide. */
      priority: number;
      halo: Rgba;
    }
);

const c = (css: string) => cssColor(css);
const inClass =
  (...names: string[]) =>
  (p: Props) =>
    names.includes(p.class as string);
const levelIs = (n: number) => (p: Props) => p.admin_level === n;
const roads = ["primary", "secondary", "tertiary", "trunk"];
const motorway = (p: Props) =>
  p.class === "motorway" && p.brunnel !== "bridge" && p.brunnel !== "tunnel";
const rail = (p: Props) => p.class === "rail" && p.service === undefined;
const HALO = c("hsla(228, 60%, 21%, 0.7)");
const place = (
  maxzoom: number,
  where: (p: Props) => boolean,
  color: string,
  size: number | Stops,
  priority: number,
  opacity?: number,
): Rule => ({
  layer: "place",
  kind: "text",
  geometry: "Point",
  maxzoom,
  where,
  color: c(color),
  size,
  priority,
  halo: HALO,
  opacity,
});
const country = (
  maxzoom: number,
  where: (p: Props) => boolean,
  size: Stops,
  priority: number,
): Rule =>
  place(
    maxzoom,
    (p) => p.class === "country" && where(p),
    "rgb(157,169,177)",
    size,
    priority,
  );

/** Bottom to top, as in the style (fills, then lines, then labels). */
export const fjordRules: Rule[] = [
  { layer: "water", kind: "fill", geometry: "Polygon", color: c("#38435C") },
  {
    layer: "landcover",
    kind: "fill",
    geometry: "Polygon",
    maxzoom: 8,
    where: (p) => p.subclass === "ice_shelf",
    color: c("hsl(232, 33%, 34%)"),
    opacity: 0.4,
  },
  {
    layer: "landcover",
    kind: "fill",
    geometry: "Polygon",
    minzoom: 10,
    where: (p) => p.class === "wood",
    color: c("hsla(232, 18%, 30%, 0.57)"),
    opacity: {
      base: 1,
      stops: [
        [9, 0],
        [12, 1],
      ],
    },
  },
  {
    layer: "park",
    kind: "fill",
    geometry: "Polygon",
    color: c("hsl(204, 17%, 35%)"),
    opacity: 0.3,
  },
  {
    layer: "building",
    kind: "fill",
    geometry: "Polygon",
    minzoom: 12,
    color: c("hsla(232, 47%, 18%, 0.65)"),
    opacity: 0.25,
  },
  {
    layer: "aeroway",
    kind: "fill",
    geometry: "Polygon",
    minzoom: 4,
    where: inClass("runway", "taxiway"),
    color: c("hsl(224, 20%, 29%)"),
  },
  {
    layer: "park",
    kind: "line",
    geometry: "Polygon",
    color: c("hsl(205, 49%, 31%)"),
    dash: [2, 2],
  },
  {
    layer: "waterway",
    kind: "line",
    geometry: "LineString",
    color: c("hsl(232, 23%, 28%)"),
    opacity: 0.6,
  },
  {
    layer: "aeroway",
    kind: "line",
    geometry: "LineString",
    minzoom: 12,
    where: inClass("taxiway"),
    color: c("hsl(224, 22%, 45%)"),
    width: {
      base: 1.55,
      stops: [
        [13, 1.8],
        [20, 20],
      ],
    },
  },
  {
    layer: "aeroway",
    kind: "line",
    geometry: "LineString",
    minzoom: 11,
    where: inClass("runway"),
    color: c("hsl(224, 22%, 45%)"),
    width: {
      base: 1.5,
      stops: [
        [11, 6],
        [17, 55],
      ],
    },
  },
  {
    layer: "aeroway",
    kind: "line",
    geometry: "LineString",
    minzoom: 11,
    where: inClass("runway"),
    color: c("hsl(224, 20%, 29%)"),
    width: {
      base: 1.5,
      stops: [
        [11, 4],
        [17, 50],
      ],
    },
  },
  {
    layer: "transportation",
    kind: "line",
    geometry: "LineString",
    where: inClass("path"),
    color: c("hsl(211, 29%, 38%)"),
    dash: [2, 2],
    width: {
      base: 1.2,
      stops: [
        [12, 0.5],
        [20, 4],
      ],
    },
  },
  {
    layer: "transportation",
    kind: "line",
    geometry: "LineString",
    minzoom: 8,
    where: inClass("minor", "service", "track"),
    color: c("hsl(224, 22%, 45%)"),
    opacity: 0.9,
    width: {
      base: 1.55,
      stops: [
        [13, 1.8],
        [20, 20],
      ],
    },
  },
  {
    layer: "transportation",
    kind: "line",
    geometry: "LineString",
    minzoom: 11,
    where: inClass(...roads),
    color: c("hsl(224, 22%, 45%)"),
    width: {
      base: 1.3,
      stops: [
        [10, 3],
        [20, 23],
      ],
    },
  },
  {
    layer: "transportation",
    kind: "line",
    geometry: "LineString",
    minzoom: 11,
    where: inClass(...roads),
    color: c("#3C4357"),
    width: {
      base: 1.3,
      stops: [
        [10, 2],
        [20, 20],
      ],
    },
  },
  {
    layer: "transportation",
    kind: "line",
    geometry: "LineString",
    minzoom: 6,
    where: motorway,
    color: c("hsl(224, 22%, 45%)"),
    width: {
      base: 1.4,
      stops: [
        [5.8, 0],
        [6, 3],
        [20, 40],
      ],
    },
  },
  {
    layer: "transportation",
    kind: "line",
    geometry: "LineString",
    minzoom: 6,
    where: motorway,
    color: c("hsl(224, 20%, 29%)"),
    width: {
      base: 1.4,
      stops: [
        [4, 2],
        [6, 1.3],
        [20, 30],
      ],
    },
  },
  {
    layer: "transportation",
    kind: "line",
    geometry: "LineString",
    minzoom: 13,
    where: rail,
    color: c("hsl(200, 10%, 18%)"),
    width: {
      base: 1.3,
      stops: [
        [16, 3],
        [20, 7],
      ],
    },
  },
  {
    layer: "transportation",
    kind: "line",
    geometry: "LineString",
    minzoom: 13,
    where: rail,
    color: c("hsl(224, 20%, 41%)"),
    dash: [3, 3],
    width: {
      base: 1.3,
      stops: [
        [16, 1.5],
        [20, 6],
      ],
    },
  },
  {
    layer: "boundary",
    kind: "line",
    geometry: "LineString",
    where: levelIs(4),
    color: c("hsla(195, 47%, 62%, 0.26)"),
    dash: [2, 2],
    width: {
      base: 1.3,
      stops: [
        [3, 1],
        [22, 15],
      ],
    },
  },
  {
    layer: "boundary",
    kind: "line",
    geometry: "LineString",
    // Below zoom 5 the style hides disputed (claimed) borders.
    where: (p, zoom) =>
      p.admin_level === 2 && (zoom >= 5 || p.claimed_by === undefined),
    color: c("hsl(214, 63%, 76%)"),
    opacity: 0.56,
    width: {
      base: 1.1,
      stops: [
        [3, 1],
        [22, 20],
      ],
    },
  },
  place(
    14,
    inClass("hamlet", "neighbourhood", "isolated_dwelling"),
    "hsl(195, 37%, 73%)",
    10,
    1,
    0.6,
  ),
  place(15, inClass("suburb"), "hsl(195, 41%, 49%)", 10, 2),
  place(14, inClass("village"), "hsl(195, 41%, 49%)", 10, 3),
  place(15, inClass("town"), "hsl(195, 25%, 76%)", 10, 4),
  place(
    14,
    (p) => p.class === "city" && Number(p.rank) > 3,
    "hsl(195, 25%, 76%)",
    10,
    5,
  ),
  place(
    12,
    (p) => p.class === "city" && Number(p.rank) <= 3,
    "hsl(195, 25%, 76%)",
    14,
    6,
  ),
  place(12, inClass("state"), "rgb(113, 129, 144)", 10, 7),
  country(
    8,
    (p) => p.iso_a2 === undefined,
    {
      base: 1,
      stops: [
        [0, 9],
        [6, 11],
      ],
    },
    8,
  ),
  country(
    8,
    (p) => Number(p.rank) >= 2 && p.iso_a2 !== undefined,
    {
      base: 1,
      stops: [
        [0, 10],
        [6, 12],
      ],
    },
    9,
  ),
  country(
    6,
    (p) => Number(p.rank) <= 1 && p.iso_a2 !== undefined,
    {
      base: 1.4,
      stops: [
        [0, 10],
        [3, 12],
        [4, 14],
      ],
    },
    10,
  ),
];

/** Does this feature get drawn by the rule at this zoom? */
export function ruleMatches(rule: Rule, feature: Feature, zoom: number) {
  if (rule.minzoom !== undefined && zoom < rule.minzoom) return false;
  if (rule.maxzoom !== undefined && zoom >= rule.maxzoom) return false;
  const type = feature.geometry.type.replace("Multi", "");
  if (rule.geometry && type !== rule.geometry) return false;
  return rule.where?.(feature.properties, zoom) ?? true;
}

/** The rule's colour with its zoom-dependent opacity folded into the alpha. */
export function ruleColor(rule: Rule, zoom: number): Rgba {
  const opacity =
    rule.opacity === undefined
      ? 1
      : typeof rule.opacity === "number"
        ? rule.opacity
        : interpolate(rule.opacity, zoom);
  const color = rule.colorStops
    ? ([0, 1, 2, 3].map((channel) =>
        Math.round(
          interpolate(
            {
              base: rule.colorStops!.base,
              stops: rule.colorStops!.stops.map(
                ([z, c]) => [z, c[channel]!] as [number, number],
              ),
            },
            zoom,
          ),
        ),
      ) as Rgba)
    : rule.color;
  return [color[0], color[1], color[2], Math.round(color[3] * opacity)];
}

export const stopsAt = (value: number | Stops, zoom: number) =>
  typeof value === "number" ? value : interpolate(value, zoom);

/** Rules indexed by tile layer, so a tile's features are tested only against their own rules. */
export function indexRules(rules: readonly Rule[]) {
  const index = new Map<string, number[]>();
  rules.forEach((rule, i) => {
    const list = index.get(rule.layer) ?? [];
    list.push(i);
    index.set(rule.layer, list);
  });
  return index;
}
export const fjordRulesByLayer = indexRules(fjordRules);

export type Label = {
  rule: number;
  position: [number, number];
  text: string;
  /** Higher wins when labels overlap; ties go to the lower `rank` (a bigger city). */
  priority: number;
  rank: number;
};

/** The place labels the style shows for these features at this zoom. */
export function placeLabels(
  features: Feature[],
  zoom: number,
  rules: readonly Rule[] = fjordRules,
  index = fjordRulesByLayer,
): Label[] {
  const labels: Label[] = [];
  for (const feature of features) {
    if (feature.properties.layerName !== "place") continue;
    const name = feature.properties["name:latin"] ?? feature.properties.name;
    const text = typeof name === "string" ? name.toUpperCase() : "";
    if (!text) continue;
    for (const i of index.get("place") ?? []) {
      const rule = rules[i]!;
      if (rule.kind === "text" && ruleMatches(rule, feature, zoom))
        labels.push({
          rule: i,
          position: feature.geometry.coordinates as [number, number],
          text,
          priority: rule.priority,
          rank: Number(feature.properties.rank ?? 99),
        });
    }
  }
  return labels;
}

/** Web Mercator pixels of a 512 px-per-tile world at `zoom`. */
const toPixels = (zoom: number, [lon, lat]: [number, number]) => {
  const world = 512 * 2 ** zoom;
  const sin = Math.sin((lat * Math.PI) / 180);
  return [
    ((lon + 180) / 360) * world,
    (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * world,
  ] as const;
};
/** Average width of an upper-case sans-serif glyph, in ems. */
const GLYPH_EM = 0.68;
const PAD_PX = 3;
const CELL_PX = 128;

/**
 * Keep the most important labels and drop any whose box overlaps one already kept (labels are
 * centred on their point). Boxes are measured in world pixels, so panning never changes the result.
 */
export function declutter(
  labels: Label[],
  zoom: number,
  rules: readonly Rule[] = fjordRules,
): Label[] {
  const grid = new Map<string, [number, number, number, number][]>();
  const kept: Label[] = [];
  const sorted = [...labels].sort(
    (a, b) =>
      b.priority - a.priority || a.rank - b.rank || (a.text < b.text ? -1 : 1),
  );
  for (const label of sorted) {
    const rule = rules[label.rule]!;
    if (rule.kind !== "text") continue;
    const size = stopsAt(rule.size, zoom);
    const [x, y] = toPixels(zoom, label.position);
    const w = label.text.length * size * GLYPH_EM + 2 * PAD_PX,
      h = size * 1.2 + 2 * PAD_PX;
    const box: [number, number, number, number] = [
      x - w / 2,
      y - h / 2,
      x + w / 2,
      y + h / 2,
    ];
    const cells: string[] = [];
    for (
      let cx = Math.floor(box[0] / CELL_PX);
      cx <= Math.floor(box[2] / CELL_PX);
      cx++
    )
      for (
        let cy = Math.floor(box[1] / CELL_PX);
        cy <= Math.floor(box[3] / CELL_PX);
        cy++
      )
        cells.push(`${cx},${cy}`);
    const clash = cells.some((cell) =>
      grid
        .get(cell)
        ?.some(
          (b) =>
            b[0] < box[2] && b[2] > box[0] && b[1] < box[3] && b[3] > box[1],
        ),
    );
    if (clash) continue;
    for (const cell of cells)
      (grid.get(cell) ?? grid.set(cell, []).get(cell)!).push(box);
    kept.push(label);
  }
  return kept;
}
