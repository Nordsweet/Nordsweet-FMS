import { ruleColor, ruleMatches, stopsAt, type Feature } from "./fjord";
import { type VectorStyle } from "./vector-styles";

/** A tile of the web map: `z/x/y`. */
export type TileIndex = { z: number; x: number; y: number };

/** The slice of the 2D canvas API the baker uses, so tests can record the calls. */
export type Canvas2D = Pick<
  CanvasRenderingContext2D,
  | "beginPath"
  | "moveTo"
  | "lineTo"
  | "closePath"
  | "fill"
  | "stroke"
  | "fillRect"
  | "setLineDash"
> & {
  fillStyle: string | CanvasGradient | CanvasPattern;
  strokeStyle: string | CanvasGradient | CanvasPattern;
  lineWidth: number;
  lineCap: CanvasLineCap;
  lineJoin: CanvasLineJoin;
};

type Ring = [number, number][];
/** Rings of the feature in tile coordinates (0..1 across the tile, y down), whatever its geometry. */
const rings = (feature: Feature): Ring[] => {
  const c = feature.geometry.coordinates as never;
  switch (feature.geometry.type) {
    case "Polygon":
      return c;
    case "MultiPolygon":
      return (c as Ring[][]).flat();
    case "LineString":
      return [c];
    case "MultiLineString":
      return c;
    default:
      return [];
  }
};

/** Bounds of a feature (tile coordinates), found once: a 64-way overzoom tests every feature 64 times. */
const bounds = new WeakMap<Feature, [number, number, number, number]>();
function boundsOf(feature: Feature) {
  let b = bounds.get(feature);
  if (!b) {
    b = [Infinity, Infinity, -Infinity, -Infinity];
    for (const ring of rings(feature))
      for (const [x, y] of ring) {
        if (x < b[0]) b[0] = x;
        if (y < b[1]) b[1] = y;
        if (x > b[2]) b[2] = x;
        if (y > b[3]) b[3] = y;
      }
    bounds.set(feature, b);
  }
  return b;
}

/**
 * Paint one map tile with a style: the background, then every fill and line rule in the style's own
 * order (labels are drawn by deck.gl, not here). `data` is the vector tile (or its ancestor, when the
 * map is zoomed in past the tiles the server has); `tile` is the part of the map to paint, `size`
 * the canvas edge in pixels and `scale` its pixel ratio (1 CSS px of line = `scale` canvas px).
 */
export function bakeTile(
  ctx: Canvas2D,
  size: number,
  scale: number,
  style: VectorStyle,
  layers: ReadonlyMap<string, Feature[]>,
  tile: TileIndex,
  data: TileIndex,
) {
  ctx.fillStyle = style.background;
  ctx.fillRect(0, 0, size, size);
  // Where the painted tile sits inside the data tile, in the data tile's own 0..1 units.
  const span = 2 ** (tile.z - data.z),
    left = tile.x / span - data.x,
    top = tile.y / span - data.y,
    unit = size * span;

  // The style is read at the tile's zoom, like a raster tile; its 512 px tile is `size / scale` CSS px.
  const zoom = tile.z;
  for (const rule of style.rules) {
    if (rule.kind === "text") continue;
    if (rule.minzoom !== undefined && zoom < rule.minzoom) continue;
    if (rule.maxzoom !== undefined && zoom >= rule.maxzoom) continue;
    const features = layers.get(rule.layer);
    if (!features) continue;
    const [r, g, b, a] = ruleColor(rule, zoom);
    const color = `rgba(${r},${g},${b},${a / 255})`;
    const width =
      rule.kind === "line" ? stopsAt(rule.width ?? 1, zoom) * scale : 0;
    // A feature this far outside the tile cannot touch it: its stroke is at most `reach` wide.
    const reach = width / unit;
    ctx.lineJoin = "round";
    ctx.lineCap = rule.kind === "line" && rule.dash ? "butt" : "round";
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    if (rule.kind === "line")
      ctx.setLineDash(rule.dash ? rule.dash.map((d) => d * width) : []);
    for (const feature of features) {
      if (!ruleMatches(rule, feature, zoom)) continue;
      const [x0, y0, x1, y1] = boundsOf(feature);
      if (
        x1 < left - reach ||
        x0 > left + 1 / span + reach ||
        y1 < top - reach ||
        y0 > top + 1 / span + reach
      )
        continue;
      ctx.beginPath();
      for (const ring of rings(feature)) {
        ring.forEach(([x, y], i) => {
          if (i) ctx.lineTo((x - left) * unit, (y - top) * unit);
          else ctx.moveTo((x - left) * unit, (y - top) * unit);
        });
        if (rule.kind === "fill") ctx.closePath();
      }
      if (rule.kind === "fill") ctx.fill("evenodd");
      else ctx.stroke();
    }
  }
}
