import {
  PathStyleExtension,
  _TerrainExtension as TerrainExtension,
  type PathStyleExtensionProps,
} from "@deck.gl/extensions";
import { TileLayer, TerrainLayer } from "@deck.gl/geo-layers";
import { TERRAIN_URL, TERRARIUM_DECODER } from "~/data/terrain";
import { loadTerrainTile } from "~/api/terrain";
import { TerrainLoader } from "@loaders.gl/terrain";
import { ImageLoader } from "@loaders.gl/images";
import {
  BitmapLayer,
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
import { cssColor, type Rgba } from "./color";
import { palettes, type Theme } from "./theme";
import { type DeckMap } from "./deck-map";
import {
  FJORD_MAX_TILE_ZOOM,
  FJORD_TILES,
  declutter,
  type Label,
  placeLabels,
  ruleColor,
  stopsAt,
  type Feature,
} from "./fjord";
import type { BakeRequest, BakeResponse, WorkerMessage } from "./tile-worker";
import { reuseLayers } from "./reuse-layers";
import { vectorStyles, type VectorStyle } from "./vector-styles";

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
  advisory?: "ta" | "close";
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
  terrain3d: boolean;
  emergencyBoundary: Path[];
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
  routeHistory: Path[];
  patternPreview: Path[];
  holding: Path[];
  holdingPreview: Path[];
  directTo: Path[];
  gpsTrail: Path[];
  gpsVector: Path[];
  gpsTicks: Path[];
  gpsAccuracy: { polygon: Pos[] }[];
  emergencyRoute: Path[];
  emergencyPreview: Path[];
  emergencyRange: { polygon: Pos[] }[];
  emergencyAirports: Pos[];
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
  terrain3d: false,
  emergencyBoundary: [],
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
  routeHistory: [],
  patternPreview: [],
  holding: [],
  holdingPreview: [],
  directTo: [],
  gpsTrail: [],
  gpsVector: [],
  gpsTicks: [],
  gpsAccuracy: [],
  emergencyRoute: [],
  emergencyPreview: [],
  emergencyRange: [],
  emergencyAirports: [],
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

/** Our own caching proxy in front of tile.openstreetmap.org (deploy/nginx.conf, rewrite in next.config.js for dev). */
const OSM_TILES = "/tiles/{z}/{x}/{y}.png";
const FONT = "system-ui, sans-serif";
/** Edges soften over about a screen pixel: the default is fine at 2x, but jagged on 1x (Windows) displays. */
const sdfSettings = () => ({
  sdf: true,
  smoothing: window.devicePixelRatio >= 2 ? 0.1 : 0.25,
});
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
const terrainExtension = new TerrainExtension();
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
    fontSettings: sdfSettings(),
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

/** Place features of the tiles on screen; labels are chosen across all of them, not per tile. */
const places = {
  features: [] as Feature[],
  version: 0,
  cached: "",
  layers: [] as Layer[],
};
function vectorLabels(zoom: number, style: VectorStyle) {
  const key = `${style.id}|${places.version}|${zoom}`;
  if (places.cached === key) return places.layers;
  const byRule = new Map<number, Label[]>();
  for (const label of declutter(
    placeLabels(places.features, zoom, style.rules, style.index),
    zoom,
    style.rules,
  ))
    (
      byRule.get(label.rule) ?? byRule.set(label.rule, []).get(label.rule)!
    ).push(label);
  places.cached = key;
  places.layers = [...byRule].map(([i, labels]) => {
    const rule = style.rules[i]!;
    if (rule.kind !== "text") throw new Error("not a label rule");
    return new TextLayer<Label>({
      id: `${style.id}-places-${i}`,
      data: labels,
      getPosition: (l) => l.position,
      getText: (l) => l.text,
      getColor: ruleColor(rule, zoom),
      getSize: stopsAt(rule.size, zoom),
      sizeUnits: "pixels",
      fontFamily: FONT,
      characterSet: "auto",
      fontSettings: sdfSettings(),
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
function vectorTemplate(refresh: () => void) {
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

type Baked = Extract<BakeResponse, { image: ImageBitmap }>;
/** The tile-painting worker and the requests waiting on it. */
const worker = {
  instance: null as Worker | null,
  next: 0,
  pending: new Map<
    number,
    { resolve: (baked: Baked) => void; reject: (error: Error) => void }
  >(),
};
function tileWorker() {
  if (!worker.instance) {
    worker.instance = new Worker(new URL("./tile-worker.ts", import.meta.url));
    worker.instance.onmessage = ({ data }: MessageEvent<BakeResponse>) => {
      const job = worker.pending.get(data.id);
      worker.pending.delete(data.id);
      if ("error" in data) job?.reject(new Error(data.error));
      else job?.resolve(data);
    };
  }
  return worker.instance;
}
function bake(request: Omit<BakeRequest, "id">, signal: AbortSignal) {
  const id = worker.next++;
  return new Promise<Baked>((resolve, reject) => {
    worker.pending.set(id, { resolve, reject });
    const instance = tileWorker();
    instance.postMessage({ ...request, id } satisfies BakeRequest);
    signal.addEventListener("abort", () => {
      if (worker.pending.delete(id)) {
        instance.postMessage({ cancel: id } satisfies WorkerMessage);
        reject(new Error("cancelled"));
      }
    });
  });
}

/**
 * The OpenMapTiles vector tiles, painted into one bitmap per map tile by a web worker (bake.ts) and
 * drawn like the OSM raster tiles: a few dozen textures that zooming only scales, instead of
 * thousands of vector layers deck.gl would have to draw and re-tessellate. Past the server's
 * zoom 14 each tile is painted from its zoom-14 ancestor, so lines stay sharp.
 */
function vectorBasemap(
  template: string,
  refresh: () => void,
  style: VectorStyle,
) {
  const scale = Math.min(2, window.devicePixelRatio || 1);
  return new TileLayer<Baked>({
    id: style.id,
    maxRequests: 6,
    tileSize: 512,
    minZoom: 0,
    maxZoom: 18,
    // The map keeps the last ~60 tiles (about 4 MB each at 2x), so panning back and zooming out
    // again costs no painting.
    maxCacheSize: 60,
    data: template,
    getTileData: ({ index, signal }) => {
      const dz = Math.min(index.z, FJORD_MAX_TILE_ZOOM),
        up = index.z - dz,
        data = { z: dz, x: index.x >> up, y: index.y >> up };
      return bake(
        {
          style: style.id,
          url: template
            .replace("{z}", String(data.z))
            .replace("{x}", String(data.x))
            .replace("{y}", String(data.y)),
          tile: index,
          data,
          scale,
        },
        signal!,
      );
    },
    onTileError: () => {
      // Offline or blocked tiles simply stay blank.
    },
    onTileUnload: (tile) => tile.content?.image.close(),
    onViewportLoad: (tiles) => {
      // The newest zoom only: older levels stay on screen while their replacements load.
      const z = Math.max(...tiles.map((tile) => tile.index.z));
      const byTile = new Map<string, Feature[]>();
      for (const tile of tiles)
        if (tile.index.z === z && tile.content)
          byTile.set(tile.content.dataKey, tile.content.places);
      places.features = [...byTile.values()].flat();
      places.version++;
      refresh();
    },
    renderSubLayers: ({ id, data, tile, extensions, parameters }) => {
      const { west, south, east, north } = tile.bbox as {
        west: number;
        south: number;
        east: number;
        north: number;
      };
      return new BitmapLayer({
        id,
        image: data.image,
        bounds: [west, south, east, north],
        extensions,
        parameters,
      });
    },
  });
}

/** One flat stack, bottom to top, in the order the chart has always been drawn. */
export function buildLayers(
  s: Scene,
  refresh: () => void,
  onTerrainError: () => void,
): Layer[] {
  const { airspace, airports, vfr, ifr, navaids, route, traffic } = s.visible;
  const vector =
    s.basemap === "bright" ||
    s.basemap === "fjord" ||
    s.basemap === "dark-matter"
      ? vectorStyles[s.basemap]
      : null;
  const template = vector ? vectorTemplate(refresh) : null;
  const vectorLayers =
    vector && template
      ? [
          vectorBasemap(template, refresh, vector),
          ...vectorLabels(s.zoom, vector),
        ]
      : [];
  const atlas = iconAtlas(s.theme),
    { halo, ownship, trailHalo } = palettes[s.theme];
  const layers: Layer[] = [
    ...(s.terrain3d
      ? [
          new TerrainLayer({
            id: "terrain",
            loaders: [TerrainLoader, ImageLoader],
            elevationData: TERRAIN_URL,
            elevationDecoder: TERRARIUM_DECODER,
            texture: vector ? undefined : OSM_TILES,
            minZoom: 0,
            maxZoom: 13,
            tileSize: 256,
            meshMaxError: 4,
            operation: "terrain+draw",
            pickable: true,
            color: vector ? cssColor(vector.background) : [160, 177, 142],
            loadOptions: {
              worker: false,
              imagebitmap: { colorSpaceConversion: "none" },
            },
            onTileError: () => {
              onTerrainError();
            },
            onTileLoad: (tile) => {
              void loadTerrainTile(tile.index)
                .then(() => refresh())
                .catch(() => undefined);
            },
            parameters: { depthCompare: "less-equal", depthWriteEnabled: true },
          }),
          ...vectorLayers,
        ]
      : s.basemap === "dark"
        ? []
        : vector
          ? vectorLayers
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
    paths("route-history-halo", s.routeHistory, [255, 0, 255, 92], 4, route, {
      round: true,
    }),
    paths("route-history", s.routeHistory, MAGENTA, 1.6, route),
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
    paths("emergency-route", s.emergencyRoute, [255, 80, 60, 255], 3, true, {
      round: true,
    }),
    paths(
      "emergency-preview",
      s.emergencyPreview,
      [255, 160, 40, 255],
      3,
      true,
      { dash: true },
    ),
    new PolygonLayer<{ polygon: Pos[] }>({
      id: "emergency-range",
      data: s.emergencyRange,
      getPolygon: (d) => d.polygon,
      getFillColor: [40, 220, 100, 20],
      getLineColor: [40, 220, 100, 210],
      getLineWidth: 2,
      lineWidthUnits: "pixels",
      stroked: false,
      filled: true,
    }),
    paths(
      "emergency-boundary",
      s.emergencyBoundary,
      [40, 220, 100, 255],
      2,
      true,
    ),
    new ScatterplotLayer<Pos>({
      id: "emergency-airports",
      data: s.emergencyAirports,
      getPosition: (d) => d,
      getRadius: 16,
      radiusUnits: "pixels",
      getLineColor: [40, 240, 100, 255],
      getLineWidth: 3,
      lineWidthUnits: "pixels",
      stroked: true,
      filled: false,
    }),
    paths("pattern-preview", s.patternPreview, MAGENTA, 2.5, true, {
      dash: true,
    }),
    paths("holding", s.holding, MAGENTA, 2, route, { round: true }),
    paths("holding-preview", s.holdingPreview, MAGENTA, 2.5, true, {
      dash: true,
    }),
    new ScatterplotLayer<TrafficDatum>({
      id: "traffic-advisory-outlines",
      data: s.traffic.filter((d) => d.advisory),
      visible: traffic,
      getPosition: (d) => d.position,
      getRadius: 18,
      radiusUnits: "pixels",
      filled: false,
      stroked: true,
      lineWidthUnits: "pixels",
      getLineWidth: 2.5,
      getLineColor: (d) =>
        d.advisory === "close"
          ? [239, 68, 68, Math.round(d.alpha * 255)]
          : [250, 204, 21, Math.round(d.alpha * 255)],
      pickable: false,
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
  return s.terrain3d
    ? layers.map((layer) =>
        layer.id === "terrain"
          ? layer
          : (layer.clone({
              // Different ids rebuild GPU models when changing the shader extensions.
              id: `${layer.id}-terrain`,
              extensions: [...(layer.props.extensions ?? []), terrainExtension],
              parameters: {
                ...layer.props.parameters,
                depthCompare: "always",
                depthWriteEnabled: false,
              },
            }) as Layer),
      )
    : layers;
}

/**
 * The map's content. Callers patch the parts that changed; the layer stack is rebuilt once per
 * tick (deck.gl diffs it, and only layers whose `data` changed re-upload to the GPU).
 */
export class DeckScene {
  readonly state = emptyScene();
  private queued = false;
  private destroyed = false;

  constructor(
    private readonly map: DeckMap,
    private readonly onTerrainError: () => void,
  ) {}

  /** What each part of the scene last held, as JSON: unchanged data must not rebuild the map. */
  private readonly sent = new Map<string, string>();
  private readonly shown = new Map<string, Layer>();

  /**
   * Patch the scene. Parts whose content is the same as before are dropped (callers re-send equal
   * arrays all the time), and a patch that changes nothing does not touch deck.gl; `set({})` still
   * forces a rebuild, for tiles that finished loading.
   */
  set(patch: Partial<Scene>) {
    const keys = Object.keys(patch) as (keyof Scene)[];
    for (const key of keys) {
      const value = patch[key];
      const json = JSON.stringify(value);
      if (this.sent.get(key) === json) delete patch[key];
      else this.sent.set(key, json);
    }
    if (keys.length && !Object.keys(patch).length) return;
    Object.assign(this.state, patch);
    if (this.queued) return;
    this.queued = true;
    queueMicrotask(() => {
      this.queued = false;
      if (!this.destroyed)
        this.map.setLayers(
          reuseLayers(
            this.shown,
            buildLayers(
              this.state,
              () => {
                this.map.terrainChanged();
                this.set({});
              },
              this.onTerrainError,
            ),
          ),
        );
    });
  }

  destroy() {
    this.destroyed = true;
  }
}
