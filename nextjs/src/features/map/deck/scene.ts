import {
  PathStyleExtension,
  type PathStyleExtensionProps,
} from "@deck.gl/extensions";
import { TileLayer } from "@deck.gl/geo-layers";
import { MVTLoader } from "@loaders.gl/mvt";
import {
  BitmapLayer,
  GeoJsonLayer,
  IconLayer,
  PathLayer,
  PolygonLayer,
  ScatterplotLayer,
  TextLayer,
} from "@deck.gl/layers";
import { LayerExtension, type Layer } from "@deck.gl/core";

import { type AirspaceFeature } from "~/api/aviation/schemas";
import { type Basemap, type LayerId } from "~/stores/map";
import { iconAtlas, type IconName } from "./atlas";
import { type Rgba } from "./color";
import { palettes, type Theme } from "./theme";
import { type DeckMap } from "./deck-map";
import {
  FJORD_MAX_TILE_ZOOM,
  FJORD_TILES,
  fjordRules,
  declutter,
  fjordRulesByLayer,
  type Label,
  placeLabels,
  ruleColor,
  ruleMatches,
  stopsAt,
  type Feature,
} from "./fjord";

type Pos = [number, number];
export type Path = { path: Pos[] };
export type PointDatum = {
  position: Pos;
  ident: string;
  name: string;
  kind: string;
  symbol: string;
  heading: number;
};
export type ZoneDatum = {
  zone: AirspaceFeature;
  fill: Rgba;
  stroke: Rgba;
  lineWidth: number;
};
export type TrafficDatum = {
  position: Pos;
  hex: string;
  icon: IconName;
  track: number;
  alpha: number;
};
export type OwnshipDatum = { position: Pos; track: number; alpha: number };
export type TextDatum = {
  position: Pos;
  text: string;
  color: Rgba;
  /** Screen-space offset in px (x right, y down), added to the style's own offset. */
  offset?: Pos;
};
export type ParachuteDatum = { position: Pos; offset: Pos };

export type Scene = {
  basemap: Basemap;
  theme: Theme;
  /** The view zoom in quarter steps: what the vector basemap's widths and zoom ranges follow. */
  zoom: number;
  visible: Record<LayerId, boolean>;
  zones: ZoneDatum[];
  airports: PointDatum[];
  vfr: PointDatum[];
  ifr: PointDatum[];
  navaids: PointDatum[];
  route: Path[];
  plannedRoute: Path[];
  patternPreview: Path[];
  holding: Path[];
  holdingPreview: Path[];
  directTo: Path[];
  gpsTrail: Path[];
  gpsVector: Path[];
  gpsTicks: Path[];
  gpsAccuracy: { polygon: Pos[] }[];
  trafficTrail: Path[];
  trafficGap: Path[];
  trafficVector: Path[];
  trafficEstimate: Path[];
  traffic: TrafficDatum[];
  ownship: OwnshipDatum[];
  selectedZones: ZoneDatum[];
  selectedPoints: Pos[];
  airportTitles: TextDatum[];
  airportDetails: TextDatum[];
  pointNames: TextDatum[];
  trafficCallsigns: TextDatum[];
  trafficDetails: TextDatum[];
  minutes: TextDatum[];
  captionTitles: TextDatum[];
  captionActiveTitles: TextDatum[];
  captionNames: TextDatum[];
  parachutes: ParachuteDatum[];
};

export const emptyScene = (): Scene => ({
  basemap: "osm",
  theme: "light",
  zoom: 0,
  visible: {
    airspace: true,
    airports: true,
    vfr: true,
    ifr: true,
    navaids: true,
    route: true,
    traffic: true,
  },
  zones: [],
  airports: [],
  vfr: [],
  ifr: [],
  navaids: [],
  route: [],
  plannedRoute: [],
  patternPreview: [],
  holding: [],
  holdingPreview: [],
  directTo: [],
  gpsTrail: [],
  gpsVector: [],
  gpsTicks: [],
  gpsAccuracy: [],
  trafficTrail: [],
  trafficGap: [],
  trafficVector: [],
  trafficEstimate: [],
  traffic: [],
  ownship: [],
  selectedZones: [],
  selectedPoints: [],
  airportTitles: [],
  airportDetails: [],
  pointNames: [],
  trafficCallsigns: [],
  trafficDetails: [],
  minutes: [],
  captionTitles: [],
  captionActiveTitles: [],
  captionNames: [],
  parachutes: [],
});

/** The layers that answer clicks, most useful first (aircraft, then airports...). */
export const PICK_LAYERS = ["traffic", "airports", "vfr", "ifr", "navaids"];

const OSM_TILES = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const FONT = "system-ui, sans-serif";
const MAGENTA: Rgba = [255, 0, 255, 255];
const AMBER: Rgba = [245, 158, 11, 255];
const SELECTION: Rgba = [255, 176, 0, 255];
const dashed = [new PathStyleExtension({ dash: true })];
const withAlpha = (color: Rgba, alpha: number): Rgba => [
  color[0],
  color[1],
  color[2],
  alpha,
];

/**
 * The night map: the plain OSM tiles with their lightness flipped (invert, then turn the hues back
 * 180°), so the land goes dark, the water stays blue and no second tile source is needed.
 */
class NightTiles extends LayerExtension {
  static extensionName = "NightTiles";
  getShaders() {
    return {
      inject: {
        "fs:DECKGL_FILTER_COLOR": `
          vec3 flipped = mat3(
            -0.574, 0.426, 0.426,
            1.430, 0.430, 1.430,
            0.144, 0.144, -0.856
          ) * (vec3(1.0) - color.rgb);
          color.rgb = clamp(flipped, 0.0, 1.0);
        `,
      },
    };
  }
}
const night = [new NightTiles()];
const DASH: Pos = [4, 3];

function paths(
  id: string,
  data: Path[],
  color: Rgba,
  width: number,
  visible: boolean,
  options: { dash?: boolean; round?: boolean; pickable?: boolean } = {},
) {
  return new PathLayer<Path, PathStyleExtensionProps<Path>>({
    id,
    data,
    visible,
    getPath: (d) => d.path,
    getColor: color,
    getWidth: width,
    widthUnits: "pixels",
    capRounded: options.round ?? false,
    jointRounded: options.round ?? false,
    pickable: options.pickable ?? false,
    ...(options.dash
      ? { extensions: dashed, getDashArray: DASH, dashJustified: false }
      : {}),
  });
}

function points(
  id: string,
  data: PointDatum[],
  visible: boolean,
  atlas: ReturnType<typeof iconAtlas>,
) {
  return new IconLayer<PointDatum>({
    id,
    data,
    visible,
    pickable: true,
    iconAtlas: atlas.url,
    iconMapping: atlas.mapping,
    getIcon: (d) => `point-${d.symbol}`,
    getPosition: (d) => d.position,
    // deck.gl angles run counter-clockwise; headings run clockwise.
    getAngle: (d) => -d.heading,
    getSize: 24,
    sizeUnits: "pixels",
    billboard: false,
  });
}

function text(
  id: string,
  data: TextDatum[],
  halo: Rgba,
  style: {
    size: number;
    weight: number;
    offset: Pos;
    halo?: boolean;
    anchor?: "start" | "middle";
    baseline?: "top" | "center" | "bottom";
  },
) {
  return new TextLayer<TextDatum>({
    id,
    data,
    getPosition: (d) => d.position,
    getText: (d) => d.text,
    getColor: (d) => d.color,
    getPixelOffset: (d) => [
      style.offset[0] + (d.offset?.[0] ?? 0),
      style.offset[1] + (d.offset?.[1] ?? 0),
    ],
    getSize: style.size,
    sizeUnits: "pixels",
    fontFamily: FONT,
    fontWeight: style.weight,
    // Glyphs are cut from the system font on a canvas: no glyph server, so it works offline.
    characterSet: "auto",
    fontSettings: { sdf: true },
    outlineWidth: style.halo ? 3 : 0,
    outlineColor: halo,
    getTextAnchor: style.anchor ?? "start",
    getAlignmentBaseline: style.baseline ?? "bottom",
  });
}

/** The OpenStreetMap raster tiles; the service worker keeps visited ones for offline use. */
function basemap(dark: boolean) {
  return new TileLayer<ImageBitmap>({
    id: dark ? "osm-night" : "osm",
    data: OSM_TILES,
    tileSize: 256,
    minZoom: 0,
    maxZoom: 18,
    onTileError: () => {
      // Offline or blocked tiles simply stay blank.
    },
    renderSubLayers: ({ id, data, tile }) => {
      const { west, south, east, north } = tile.bbox as {
        west: number;
        south: number;
        east: number;
        north: number;
      };
      return new BitmapLayer({
        id,
        image: data,
        bounds: [west, south, east, north],
        extensions: dark ? night : [],
      });
    },
  });
}

/** One Fjord fill or line rule's share of a tile, as a deck layer. */
function fjordLayer(id: string, i: number, features: Feature[], zoom: number) {
  const rule = fjordRules[i]!;
  const color = ruleColor(rule, zoom);
  if (rule.kind === "text")
    throw new Error("place labels are drawn by fjordLabels");
  const shared = {
    id,
    data: features as never,
    pickable: false,
    lineWidthUnits: "pixels",
  } as const;
  if (rule.kind === "fill")
    return new GeoJsonLayer({
      ...shared,
      filled: true,
      stroked: false,
      getFillColor: color,
    });
  return new GeoJsonLayer<Feature, PathStyleExtensionProps<Feature>>({
    ...shared,
    filled: false,
    stroked: true,
    getLineColor: color,
    getLineWidth: stopsAt(rule.width ?? 1, zoom),
    ...(rule.dash
      ? { extensions: dashed, getDashArray: rule.dash, dashJustified: false }
      : {}),
  });
}

/**
 * The Fjord map: OpenMapTiles vector tiles drawn with the Fjord style's rules. Each tile's features
 * are sorted into the style's layers (bottom to top), re-sorted when the zoom moves a quarter step.
 */
/** Place features of the tiles on screen; labels are chosen across all of them, not per tile. */
const places = {
  features: [] as Feature[],
  version: 0,
  cached: "",
  layers: [] as Layer[],
};
function fjordLabels(zoom: number) {
  const key = `${places.version}|${zoom}`;
  if (places.cached === key) return places.layers;
  const byRule = new Map<number, Label[]>();
  for (const label of declutter(placeLabels(places.features, zoom), zoom))
    (
      byRule.get(label.rule) ?? byRule.set(label.rule, []).get(label.rule)!
    ).push(label);
  places.cached = key;
  places.layers = [...byRule].map(([i, labels]) => {
    const rule = fjordRules[i]!;
    if (rule.kind !== "text") throw new Error("not a label rule");
    return new TextLayer<Label>({
      id: `fjord-places-${i}`,
      data: labels,
      getPosition: (l) => l.position,
      getText: (l) => l.text,
      getColor: ruleColor(rule, zoom),
      getSize: stopsAt(rule.size, zoom),
      sizeUnits: "pixels",
      fontFamily: FONT,
      characterSet: "auto",
      fontSettings: { sdf: true },
      outlineWidth: 2,
      outlineColor: rule.halo,
      getTextAnchor: "middle",
      getAlignmentBaseline: "center",
    });
  });
  return places.layers;
}

/** The current `{z}/{x}/{y}` tile URL, from the TileJSON (it names the planet build, which changes weekly). */
const tilejson = {
  template: null as string | null,
  loading: false,
  retryAt: 0,
};
function fjordTemplate(refresh: () => void) {
  if (
    !tilejson.template &&
    !tilejson.loading &&
    Date.now() >= tilejson.retryAt
  ) {
    tilejson.loading = true;
    void fetch(FJORD_TILES)
      .then((response) => response.json() as Promise<{ tiles: string[] }>)
      .then((json) => {
        tilejson.template = json.tiles[0] ?? null;
        refresh();
      })
      // Offline with nothing cached: look again in a while, not on every redraw.
      .catch(() => (tilejson.retryAt = Date.now() + 10_000))
      .finally(() => (tilejson.loading = false));
  }
  return tilejson.template;
}

function fjordBasemap(zoom: number, template: string, refresh: () => void) {
  // `null` while a tile is still loading.
  return new TileLayer<Feature[] | null>({
    id: "fjord",
    data: template,
    maxZoom: FJORD_MAX_TILE_ZOOM,
    // Parsed here, on the main thread: the stock MVT layer fetches a worker script from a CDN.
    getTileData: async ({ url, index, signal }) => {
      if (!url) return [];
      const response = await fetch(url, { signal });
      if (!response.ok) throw new Error(`Tile ${response.status}`);
      return (await MVTLoader.parse(await response.arrayBuffer(), {
        mvt: {
          coordinates: "wgs84",
          tileIndex: index,
          shape: "geojson",
          layerProperty: "layerName",
        },
      })) as unknown as Feature[];
    },
    onTileError: () => {
      // Offline or blocked tiles simply stay blank.
    },
    onViewportLoad: (tiles) => {
      // The newest zoom only: older levels stay on screen while their replacements load.
      const z = Math.max(...tiles.map((tile) => tile.index.z));
      places.features = tiles
        .filter((tile) => tile.index.z === z)
        .flatMap((tile) => tile.content ?? []);
      places.version++;
      refresh();
    },
    updateTriggers: { renderSubLayers: [zoom] },
    renderSubLayers: ({ id, data }) => {
      const byRule = new Map<number, Feature[]>();
      for (const feature of data ?? [])
        for (const i of fjordRulesByLayer.get(
          String(feature.properties.layerName),
        ) ?? [])
          if (
            fjordRules[i]!.kind !== "text" &&
            ruleMatches(fjordRules[i]!, feature, zoom)
          )
            (byRule.get(i) ?? byRule.set(i, []).get(i)!).push(feature);
      return [...byRule]
        .sort(([a], [b]) => a - b)
        .map(([i, features]) => fjordLayer(`${id}-${i}`, i, features, zoom));
    },
  });
}

/** One flat stack, bottom to top, in the order the chart has always been drawn. */
export function buildLayers(s: Scene, refresh: () => void): Layer[] {
  const { airspace, airports, vfr, ifr, navaids, route, traffic } = s.visible;
  const fjord = s.basemap === "fjord" ? fjordTemplate(refresh) : null;
  const atlas = iconAtlas(s.theme),
    { halo, ownship, trailHalo } = palettes[s.theme];
  return [
    ...(s.basemap === "dark"
      ? []
      : s.basemap === "fjord"
        ? fjord
          ? [fjordBasemap(s.zoom, fjord, refresh), ...fjordLabels(s.zoom)]
          : []
        : [basemap(s.basemap === "night")]),
    new PolygonLayer<ZoneDatum>({
      id: "airspace",
      data: s.zones,
      visible: airspace,
      getPolygon: (d) => d.zone.geometry.coordinates,
      getFillColor: (d) => d.fill,
      getLineColor: (d) => d.stroke,
      getLineWidth: (d) => d.lineWidth,
      lineWidthUnits: "pixels",
      stroked: true,
      filled: true,
    }),
    points("ifr", s.ifr, ifr, atlas),
    points("vfr", s.vfr, vfr, atlas),
    points("airports", s.airports, airports, atlas),
    points("navaids", s.navaids, navaids, atlas),
    paths("route-halo", s.route, [255, 0, 255, 92], 4, route, { round: true }),
    paths("route", s.route, MAGENTA, 1.6, route, { pickable: true }),
    new PathLayer<Path, PathStyleExtensionProps<Path>>({
      id: "planned-route",
      data: s.plannedRoute,
      visible: route,
      getPath: (d) => d.path,
      getColor: [255, 0, 255, 102],
      getWidth: 2,
      widthUnits: "pixels",
      extensions: dashed,
      getDashArray: DASH,
    }),
    paths("pattern-preview", s.patternPreview, MAGENTA, 2.5, true, {
      dash: true,
    }),
    paths("holding", s.holding, MAGENTA, 2, route, { round: true }),
    paths("holding-preview", s.holdingPreview, MAGENTA, 2.5, true, {
      dash: true,
    }),
    new IconLayer<TrafficDatum>({
      id: "traffic",
      data: s.traffic,
      visible: traffic,
      pickable: true,
      iconAtlas: atlas.url,
      iconMapping: atlas.mapping,
      getIcon: (d) => d.icon,
      getPosition: (d) => d.position,
      getAngle: (d) => -d.track,
      getColor: (d) => [255, 255, 255, Math.round(d.alpha * 255)],
      getSize: 24,
      sizeUnits: "pixels",
      billboard: false,
    }),
    paths("gps-trail-halo", s.gpsTrail, [118, 242, 164, 71], 7, true, {
      round: true,
    }),
    paths("traffic-trail-halo", s.trafficTrail, trailHalo, 5.2, traffic),
    paths("gps-trail", s.gpsTrail, [118, 242, 164, 240], 2.8, true),
    paths("gps-vector", s.gpsVector, withAlpha(ownship, 230), 2, true),
    paths("traffic-trail", s.trafficTrail, AMBER, 2.6, traffic),
    paths("traffic-gap", s.trafficGap, AMBER, 2, traffic, { dash: true }),
    paths("traffic-vector", s.trafficVector, AMBER, 2, traffic, { dash: true }),
    paths(
      "traffic-estimate",
      s.trafficEstimate,
      [0, 166, 199, 255],
      2,
      traffic,
      {
        dash: true,
      },
    ),
    paths("direct-to", s.directTo, MAGENTA, 2, route),
    new PolygonLayer<{ polygon: Pos[] }>({
      id: "gps-accuracy",
      data: s.gpsAccuracy,
      getPolygon: (d) => d.polygon,
      getFillColor: withAlpha(ownship, 26),
      getLineColor: withAlpha(ownship, 89),
      getLineWidth: 1.2,
      lineWidthUnits: "pixels",
      stroked: true,
      filled: true,
    }),
    paths("gps-ticks", s.gpsTicks, withAlpha(ownship, 230), 2, true),
    new IconLayer<OwnshipDatum>({
      id: "ownship",
      data: s.ownship,
      iconAtlas: atlas.url,
      iconMapping: atlas.mapping,
      getIcon: () => "ownship",
      getPosition: (d) => d.position,
      getAngle: (d) => -d.track,
      getColor: (d) => [255, 255, 255, Math.round(d.alpha * 255)],
      getSize: 48,
      sizeUnits: "pixels",
      billboard: false,
    }),
    new PolygonLayer<ZoneDatum>({
      id: "selected-zones",
      data: s.selectedZones,
      getPolygon: (d) => d.zone.geometry.coordinates,
      getFillColor: [255, 176, 0, 51],
      getLineColor: SELECTION,
      getLineWidth: 3,
      lineWidthUnits: "pixels",
      stroked: true,
      filled: true,
    }),
    new ScatterplotLayer<Pos>({
      id: "selected-points",
      data: s.selectedPoints,
      getPosition: (d) => d,
      getRadius: 17,
      radiusUnits: "pixels",
      getFillColor: [255, 176, 0, 51],
      getLineColor: SELECTION,
      getLineWidth: 3,
      lineWidthUnits: "pixels",
      stroked: true,
      filled: true,
    }),
    // Labels last, so they stay readable over every symbol.
    text("caption-titles", s.captionTitles, halo, {
      size: 10,
      weight: 600,
      offset: [0, 0],
      anchor: "middle",
      baseline: "center",
    }),
    text("caption-active-titles", s.captionActiveTitles, halo, {
      size: 11,
      weight: 700,
      offset: [0, 0],
      anchor: "middle",
      baseline: "center",
    }),
    text("caption-names", s.captionNames, halo, {
      size: 10,
      weight: 600,
      offset: [0, 0],
      anchor: "middle",
      baseline: "center",
    }),
    new IconLayer<ParachuteDatum>({
      id: "parachutes",
      data: s.parachutes,
      iconAtlas: atlas.url,
      iconMapping: atlas.mapping,
      getIcon: () => "parachute",
      getPosition: (d) => d.position,
      getPixelOffset: (d) => d.offset,
      getSize: 24,
      sizeUnits: "pixels",
    }),
    text("airport-titles", s.airportTitles, halo, {
      size: 13,
      weight: 700,
      offset: [10, -2],
    }),
    text("airport-details", s.airportDetails, halo, {
      size: 11,
      weight: 600,
      offset: [10, 0],
      baseline: "top",
    }),
    text("point-names", s.pointNames, halo, {
      size: 11,
      weight: 600,
      offset: [6, -4],
    }),
    text("traffic-callsigns", s.trafficCallsigns, halo, {
      size: 10,
      weight: 700,
      offset: [8, -5],
      halo: true,
    }),
    text("traffic-details", s.trafficDetails, halo, {
      size: 9,
      weight: 700,
      offset: [8, 0],
      halo: true,
      baseline: "top",
    }),
    text("minutes", s.minutes, halo, {
      size: 10,
      weight: 700,
      offset: [0, 0],
      halo: true,
      anchor: "middle",
      baseline: "center",
    }),
  ];
}

/**
 * The map's content. Callers patch the parts that changed; the layer stack is rebuilt once per
 * tick (deck.gl diffs it, and only layers whose `data` changed re-upload to the GPU).
 */
export class DeckScene {
  readonly state = emptyScene();
  private queued = false;
  private destroyed = false;

  constructor(private readonly map: DeckMap) {}

  set(patch: Partial<Scene>) {
    Object.assign(this.state, patch);
    if (this.queued) return;
    this.queued = true;
    queueMicrotask(() => {
      this.queued = false;
      if (!this.destroyed)
        this.map.setLayers(buildLayers(this.state, () => this.set({})));
    });
  }

  destroy() {
    this.destroyed = true;
  }
}
