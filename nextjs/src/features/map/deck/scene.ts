import {
  PathStyleExtension,
  type PathStyleExtensionProps,
} from "@deck.gl/extensions";
import { TileLayer } from "@deck.gl/geo-layers";
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
import { type Rgba } from "./color";
import { palettes, type Theme } from "./theme";
import { type DeckMap } from "./deck-map";

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
  visible: Record<LayerId, boolean>;
  zones: ZoneDatum[];
  airports: PointDatum[];
  vfr: PointDatum[];
  ifr: PointDatum[];
  navaids: PointDatum[];
  route: Path[];
  plannedRoute: Path[];
  patternPreview: Path[];
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

/** One flat stack, bottom to top, in the order the chart has always been drawn. */
export function buildLayers(s: Scene): Layer[] {
  const { airspace, airports, vfr, ifr, navaids, route, traffic } = s.visible;
  const atlas = iconAtlas(s.theme),
    { halo, ownship, trailHalo } = palettes[s.theme];
  return [
    ...(s.basemap === "dark" ? [] : [basemap(s.basemap === "night")]),
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
      size: 10,
      weight: 700,
      offset: [10, -2],
    }),
    text("airport-details", s.airportDetails, halo, {
      size: 8,
      weight: 600,
      offset: [10, 0],
      baseline: "top",
    }),
    text("point-names", s.pointNames, halo, {
      size: 9,
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
      if (!this.destroyed) this.map.setLayers(buildLayers(this.state));
    });
  }

  destroy() {
    this.destroyed = true;
  }
}
