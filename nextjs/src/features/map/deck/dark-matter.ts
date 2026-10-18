import { cssColor as c } from "./color";
import { indexRules, type Rule } from "./fjord";
/** OpenMapTiles Dark Matter d17442cb66bad8c82bda59d199d5dafeead410cf; BSD-3 / CC-BY 4.0. See /dark-matter-attribution.html. */
export const DARK_MATTER_BACKGROUND = "rgb(12,12,12)";
export const darkMatterRules: Rule[] = [
  // water
  {
    layer: "water",
    kind: "fill",
    geometry: "Polygon",
    where: (p) => p.brunnel !== "tunnel",
    color: c("rgb(27 ,27 ,29)"),
  },
  // landcover_ice_shelf
  {
    layer: "landcover",
    kind: "fill",
    geometry: "Polygon",
    maxzoom: 8,
    where: (p) => p.subclass === "ice_shelf",
    color: c("rgb(12,12,12)"),
    opacity: 0.7,
  },
  // landcover_glacier
  {
    layer: "landcover",
    kind: "fill",
    geometry: "Polygon",
    maxzoom: 8,
    where: (p) => p.subclass === "glacier",
    color: c("hsl(0, 1%, 2%)"),
    opacity: {
      base: 1,
      stops: [
        [0, 1],
        [8, 0.5],
      ],
    },
  },
  // landuse_residential
  {
    layer: "landuse",
    kind: "fill",
    geometry: "Polygon",
    maxzoom: 9,
    where: (p) => p.class === "residential",
    color: c("hsl(0, 2%, 5%)"),
    opacity: 0.4,
  },
  // landcover_wood
  {
    layer: "landcover",
    kind: "fill",
    geometry: "Polygon",
    minzoom: 10,
    where: (p) => p.class === "wood",
    color: c("rgb(32,32,32)"),
    opacity: {
      base: 0.3,
      stops: [
        [8, 0],
        [10, 0.8],
        [13, 0.4],
      ],
    },
  },
  // landuse_park
  {
    layer: "landuse",
    kind: "fill",
    geometry: "Polygon",
    where: (p) => p.class === "park",
    color: c("rgb(32,32,32)"),
  },
  // waterway
  {
    layer: "waterway",
    kind: "line",
    geometry: "LineString",
    color: c("rgb(27 ,27 ,29)"),
    width: 1,
  },
  // building
  {
    layer: "building",
    kind: "fill",
    geometry: "Polygon",
    minzoom: 12,
    color: c("rgb(10,10,10)"),
  },
  // aeroway-taxiway
  {
    layer: "aeroway",
    kind: "line",
    minzoom: 12,
    where: (p) => ["taxiway"].includes(String(p.class)),
    color: c("#181818"),
    opacity: 1,
    width: {
      base: 1.55,
      stops: [
        [13, 1.8],
        [20, 20],
      ],
    },
  },
  // aeroway-runway-casing
  {
    layer: "aeroway",
    kind: "line",
    minzoom: 11,
    where: (p) => ["runway"].includes(String(p.class)),
    color: c("rgba(60,60,60,0.8)"),
    opacity: 1,
    width: {
      base: 1.5,
      stops: [
        [11, 5],
        [17, 55],
      ],
    },
  },
  // aeroway-area
  {
    layer: "aeroway",
    kind: "fill",
    geometry: "Polygon",
    minzoom: 4,
    where: (p) => ["runway", "taxiway"].includes(String(p.class)),
    color: c("#000000"),
    opacity: 1,
  },
  // aeroway-runway
  {
    layer: "aeroway",
    kind: "line",
    geometry: "LineString",
    minzoom: 11,
    where: (p) => ["runway"].includes(String(p.class)),
    color: c("#000000"),
    opacity: 1,
    width: {
      base: 1.5,
      stops: [
        [11, 4],
        [17, 50],
      ],
    },
  },
  // road_area_pier
  {
    layer: "transportation",
    kind: "fill",
    geometry: "Polygon",
    where: (p) => p.class === "pier",
    color: c("rgb(12,12,12)"),
  },
  // road_pier
  {
    layer: "transportation",
    kind: "line",
    geometry: "LineString",
    where: (p) => ["pier"].includes(String(p.class)),
    color: c("rgb(12,12,12)"),
    width: {
      base: 1.2,
      stops: [
        [15, 1],
        [17, 4],
      ],
    },
  },
  // highway_path
  {
    layer: "transportation",
    kind: "line",
    geometry: "LineString",
    where: (p) => p.class === "path",
    color: c("rgb(27 ,27 ,29)"),
    opacity: 0.9,
    width: {
      base: 1.2,
      stops: [
        [13, 1],
        [20, 10],
      ],
    },
    dash: [1.5, 1.5],
  },
  // highway_minor
  {
    layer: "transportation",
    kind: "line",
    geometry: "LineString",
    minzoom: 8,
    where: (p) => ["minor", "service", "track"].includes(String(p.class)),
    color: c("#181818"),
    opacity: 0.9,
    width: {
      base: 1.55,
      stops: [
        [13, 1.8],
        [20, 20],
      ],
    },
  },
  // highway_major_casing
  {
    layer: "transportation",
    kind: "line",
    geometry: "LineString",
    minzoom: 11,
    where: (p) =>
      ["primary", "secondary", "tertiary", "trunk"].includes(String(p.class)),
    color: c("rgba(60,60,60,0.8)"),
    width: {
      base: 1.3,
      stops: [
        [10, 3],
        [20, 23],
      ],
    },
  },
  // highway_major_inner
  {
    layer: "transportation",
    kind: "line",
    geometry: "LineString",
    minzoom: 11,
    where: (p) =>
      ["primary", "secondary", "tertiary", "trunk"].includes(String(p.class)),
    color: c("hsl(0, 0%, 7%)"),
    width: {
      base: 1.3,
      stops: [
        [10, 2],
        [20, 20],
      ],
    },
  },
  // highway_major_subtle
  {
    layer: "transportation",
    kind: "line",
    geometry: "LineString",
    minzoom: 6,
    maxzoom: 11,
    where: (p) =>
      ["primary", "secondary", "tertiary", "trunk"].includes(String(p.class)),
    color: c("#2a2a2a"),
    width: {
      base: 1,
      stops: [
        [6, 0],
        [8, 2],
      ],
    },
  },
  // highway_motorway_casing
  {
    layer: "transportation",
    kind: "line",
    geometry: "LineString",
    minzoom: 6,
    where: (p) => p.class === "motorway",
    color: c("rgba(60,60,60,0.8)"),
    opacity: 1,
    width: {
      base: 1.4,
      stops: [
        [5.8, 0],
        [6, 3],
        [20, 40],
      ],
    },
  },
  // highway_motorway_inner
  {
    layer: "transportation",
    kind: "line",
    geometry: "LineString",
    minzoom: 6,
    where: (p) => p.class === "motorway",
    color: c("hsla(0, 0%, 85%, 0.53)"),
    colorStops: {
      base: 1,
      stops: [
        [5.8, c("hsla(0, 0%, 85%, 0.53)")],
        [6, c("#000000")],
      ],
    },
    width: {
      base: 1.4,
      stops: [
        [4, 2],
        [6, 1.3],
        [20, 30],
      ],
    },
  },
  // highway_motorway_subtle
  {
    layer: "transportation",
    kind: "line",
    geometry: "LineString",
    maxzoom: 6,
    where: (p) => p.class === "motorway",
    color: c("#181818"),
    width: {
      base: 1.4,
      stops: [
        [4, 2],
        [6, 1.3],
      ],
    },
  },
  // railway_transit
  {
    layer: "transportation",
    kind: "line",
    geometry: "LineString",
    minzoom: 16,
    where: (p) =>
      p.class === "transit" && !["tunnel"].includes(String(p.brunnel)),
    color: c("rgb(35,35,35)"),
    width: 3,
  },
  // railway_transit_dashline
  {
    layer: "transportation",
    kind: "line",
    geometry: "LineString",
    minzoom: 16,
    where: (p) =>
      p.class === "transit" && !["tunnel"].includes(String(p.brunnel)),
    color: c("rgb(12,12,12)"),
    width: 2,
    dash: [3, 3],
  },
  // railway_minor
  {
    layer: "transportation",
    kind: "line",
    geometry: "LineString",
    minzoom: 16,
    where: (p) => p.class === "rail" && Object.hasOwn(p, "service"),
    color: c("rgb(35,35,35)"),
    width: 3,
  },
  // railway_minor_dashline
  {
    layer: "transportation",
    kind: "line",
    geometry: "LineString",
    minzoom: 16,
    where: (p) => p.class === "rail" && Object.hasOwn(p, "service"),
    color: c("rgb(12,12,12)"),
    width: 2,
    dash: [3, 3],
  },
  // railway
  {
    layer: "transportation",
    kind: "line",
    geometry: "LineString",
    minzoom: 13,
    where: (p) => p.class === "rail" && !Object.hasOwn(p, "service"),
    color: c("rgb(35,35,35)"),
    width: {
      base: 1.3,
      stops: [
        [16, 3],
        [20, 7],
      ],
    },
  },
  // railway_dashline
  {
    layer: "transportation",
    kind: "line",
    geometry: "LineString",
    minzoom: 13,
    where: (p) => p.class === "rail" && !Object.hasOwn(p, "service"),
    color: c("rgb(12,12,12)"),
    width: {
      base: 1.3,
      stops: [
        [16, 2],
        [20, 6],
      ],
    },
    dash: [3, 3],
  },
  // boundary_state
  {
    layer: "boundary",
    kind: "line",
    where: (p) => p.admin_level === 4,
    color: c("hsl(0, 0%, 21%)"),
    opacity: 1,
    width: {
      base: 1.3,
      stops: [
        [3, 1],
        [22, 15],
      ],
    },
    dash: [2, 2],
  },
  // boundary_country_z0-4
  {
    layer: "boundary",
    kind: "line",
    maxzoom: 5,
    where: (p) => p.admin_level === 2 && !Object.hasOwn(p, "claimed_by"),
    color: c("hsl(0, 0%, 23%)"),
    opacity: 1,
    width: {
      base: 1.1,
      stops: [
        [3, 1],
        [22, 20],
      ],
    },
  },
  // boundary_country_z5-
  {
    layer: "boundary",
    kind: "line",
    minzoom: 5,
    where: (p) => p.admin_level === 2,
    color: c("hsl(0, 0%, 23%)"),
    opacity: 1,
    width: {
      base: 1.1,
      stops: [
        [3, 1],
        [22, 20],
      ],
    },
  },
  // place_other
  {
    layer: "place",
    kind: "text",
    geometry: "Point",
    maxzoom: 14,
    where: (p) =>
      ["hamlet", "isolated_dwelling", "neighbourhood"].includes(
        String(p.class),
      ),
    color: c("rgb(101,101,101)"),
    size: 10,
    priority: 37,
    halo: c("rgba(0,0,0,0.7)"),
  },
  // place_suburb
  {
    layer: "place",
    kind: "text",
    geometry: "Point",
    maxzoom: 15,
    where: (p) => p.class === "suburb",
    color: c("rgb(101,101,101)"),
    size: 10,
    priority: 38,
    halo: c("rgba(0,0,0,0.7)"),
  },
  // place_village
  {
    layer: "place",
    kind: "text",
    geometry: "Point",
    maxzoom: 14,
    where: (p) => p.class === "village",
    color: c("rgb(101,101,101)"),
    size: 10,
    priority: 39,
    halo: c("rgba(0,0,0,0.7)"),
  },
  // place_town
  {
    layer: "place",
    kind: "text",
    geometry: "Point",
    maxzoom: 15,
    where: (p) => p.class === "town",
    color: c("rgb(101,101,101)"),
    size: 10,
    priority: 40,
    halo: c("rgba(0,0,0,0.7)"),
  },
  // place_city
  {
    layer: "place",
    kind: "text",
    geometry: "Point",
    maxzoom: 14,
    where: (p) => p.class === "city" && Number(p.rank) > 3,
    color: c("rgb(101,101,101)"),
    size: 10,
    priority: 41,
    halo: c("rgba(0,0,0,0.7)"),
  },
  // place_city_large
  {
    layer: "place",
    kind: "text",
    geometry: "Point",
    maxzoom: 12,
    where: (p) => Number(p.rank) <= 3 && p.class === "city",
    color: c("rgb(101,101,101)"),
    size: 14,
    priority: 42,
    halo: c("rgba(0,0,0,0.7)"),
  },
  // place_state
  {
    layer: "place",
    kind: "text",
    geometry: "Point",
    maxzoom: 12,
    where: (p) => p.class === "state",
    color: c("rgb(101,101,101)"),
    size: 10,
    priority: 43,
    halo: c("rgba(0,0,0,0.7)"),
  },
  // place_country_other
  {
    layer: "place",
    kind: "text",
    geometry: "Point",
    maxzoom: 8,
    where: (p) => p.class === "country" && !Object.hasOwn(p, "iso_a2"),
    color: c("rgb(101,101,101)"),
    size: {
      base: 1,
      stops: [
        [0, 9],
        [1, 11],
      ],
    },
    priority: 44,
    halo: c("rgba(0,0,0,0.7)"),
  },
  // place_country_minor
  {
    layer: "place",
    kind: "text",
    geometry: "Point",
    maxzoom: 8,
    where: (p) =>
      p.class === "country" &&
      Number(p.rank) >= 2 &&
      Object.hasOwn(p, "iso_a2"),
    color: c("rgb(101,101,101)"),
    size: {
      base: 1,
      stops: [
        [0, 10],
        [6, 12],
      ],
    },
    priority: 45,
    halo: c("rgba(0,0,0,0.7)"),
  },
  // place_country_major
  {
    layer: "place",
    kind: "text",
    geometry: "Point",
    maxzoom: 6,
    where: (p) =>
      Number(p.rank) <= 1 &&
      p.class === "country" &&
      Object.hasOwn(p, "iso_a2"),
    color: c("rgb(101,101,101)"),
    size: {
      base: 1.4,
      stops: [
        [0, 10],
        [3, 12],
        [4, 14],
      ],
    },
    priority: 46,
    halo: c("rgba(0,0,0,0.7)"),
  },
];
export const darkMatterRulesByLayer = indexRules(darkMatterRules);
