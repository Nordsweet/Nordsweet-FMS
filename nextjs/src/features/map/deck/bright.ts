import { cssColor as c } from "./color";
import { indexRules, type Rule } from "./fjord";
/**
 * The official "OSM OpenMapTiles" style (the style.json of each layer folder in openmaptiles/openmaptiles at
 * 6c11838d38030148832c039c2ea367274db86a87;
 * BSD-3 code, CC-BY 4.0 design), ported to deck.gl rules. See /bright-attribution.html.
 * Left out: POIs, house numbers, mountain peaks, tunnels, roads under construction, paths and
 * pedestrian ways, patterns and hatching sprites, and all text that follows a line. Bridges are
 * drawn as ordinary roads.
 */
export const BRIGHT_BACKGROUND = "hsl(40, 26%, 93%)";
export const brightRules: Rule[] = [
  // Residential
  {
    layer: "landuse",
    kind: "fill",
    geometry: "Polygon",
    minzoom: 6,
    where: (p) =>
      ["residential", "suburbs", "neighbourhood"].includes(String(p.class)),
    color: c("hsl(0, 0%, 82%)"),
    colorStops: {
      base: 1,
      stops: [
        [7, c("hsl(0, 0%, 82%)")],
        [11, c("hsl(0, 0%, 87%)")],
        [12, c("hsl(0, 2%, 88%)")],
      ],
    },
  },
  // Cemetery
  {
    layer: "landuse",
    kind: "fill",
    geometry: "Polygon",
    minzoom: 7,
    where: (p) => p.class === "cemetery",
    color: c("hsl(129, 24%, 73%)"),
  },
  // Military
  {
    layer: "landuse",
    kind: "fill",
    geometry: "Polygon",
    minzoom: 7,
    where: (p) => p.class === "military",
    color: c("hsl(0, 75%, 95%)"),
  },
  // Railway
  {
    layer: "landuse",
    kind: "fill",
    geometry: "Polygon",
    minzoom: 7,
    where: (p) => p.class === "railway",
    color: c("hsl(311, 29%, 89%)"),
  },
  // Industrial
  {
    layer: "landuse",
    kind: "fill",
    geometry: "Polygon",
    minzoom: 7,
    where: (p) => p.class === "industrial",
    color: c("hsl(311, 29%, 89%)"),
  },
  // Retail
  {
    layer: "landuse",
    kind: "fill",
    geometry: "Polygon",
    minzoom: 7,
    where: (p) => p.class === "retail",
    color: c("hsl(7, 100%, 91%)"),
  },
  // Commercial
  {
    layer: "landuse",
    kind: "fill",
    geometry: "Polygon",
    minzoom: 7,
    where: (p) => p.class === "commercial",
    color: c("hsl(2, 49%, 90%)"),
  },
  // Education and Health
  {
    layer: "landuse",
    kind: "fill",
    geometry: "Polygon",
    minzoom: 7,
    where: (p) =>
      ["school", "university", "kindergarten", "college", "hospital"].includes(
        String(p.class),
      ),
    color: c("hsl(60, 100%, 95%)"),
  },
  // Aeroway
  {
    layer: "aeroway",
    kind: "fill",
    geometry: "Polygon",
    minzoom: 11,
    color: c("hsl(240, 8%, 88%)"),
    colorStops: {
      base: 1,
      stops: [
        [6, c("hsl(240, 8%, 88%)")],
        [12, c("hsl(53, 16%, 89%)")],
      ],
    },
  },
  // Wetland (medium scale)
  {
    layer: "landcover",
    kind: "fill",
    geometry: "Polygon",
    maxzoom: 13,
    where: (p) => p.class === "wetland",
    color: c("hsl(102, 36%, 72%)"),
    opacity: {
      base: 1,
      stops: [
        [7, 0.5],
        [10, 1],
      ],
    },
  },
  // Sand (medium scale)
  {
    layer: "landcover",
    kind: "fill",
    geometry: "Polygon",
    maxzoom: 13,
    where: (p) => p.class === "sand",
    color: c("hsl(45, 70%, 87%)"),
    opacity: {
      base: 1,
      stops: [
        [7, 0.5],
        [10, 1],
      ],
    },
  },
  // Grass (medium scale)
  {
    layer: "landcover",
    kind: "fill",
    geometry: "Polygon",
    maxzoom: 13,
    where: (p) => p.class === "grass",
    color: c("hsl(91, 60%, 81%)"),
    opacity: {
      base: 1,
      stops: [
        [7, 0.5],
        [10, 1],
      ],
    },
  },
  // Rock (medium scale)
  {
    layer: "landcover",
    kind: "fill",
    geometry: "Polygon",
    maxzoom: 13,
    where: (p) => p.class === "rock",
    color: c("hsl(30, 35%, 90%)"),
    opacity: {
      base: 1,
      stops: [
        [7, 0.5],
        [10, 1],
      ],
    },
  },
  // Wood (medium scale)
  {
    layer: "landcover",
    kind: "fill",
    geometry: "Polygon",
    maxzoom: 13,
    where: (p) => p.class === "wood",
    color: c("hsl(102, 36%, 72%)"),
    opacity: {
      base: 1,
      stops: [
        [7, 0.5],
        [10, 1],
      ],
    },
  },
  // Farmland (medium scale)
  {
    layer: "landcover",
    kind: "fill",
    geometry: "Polygon",
    maxzoom: 13,
    where: (p) => p.class === "farmland",
    color: c("hsl(64, 47%, 89%)"),
    opacity: {
      base: 1,
      stops: [
        [7, 0.5],
        [10, 1],
      ],
    },
  },
  // Marsh
  {
    layer: "landcover",
    kind: "fill",
    geometry: "Polygon",
    minzoom: 9,
    where: (p) => ["marsh"].includes(String(p.subclass)),
    color: c("hsl(60, 100%, 50%)"),
  },
  // Park
  {
    layer: "landcover",
    kind: "fill",
    geometry: "Polygon",
    minzoom: 13,
    where: (p) => p.subclass === "park",
    color: c("hsl(125, 83%, 88%)"),
  },
  // Garden
  {
    layer: "landcover",
    kind: "fill",
    geometry: "Polygon",
    minzoom: 9,
    where: (p) => p.subclass === "garden",
    color: c("hsl(91, 60%, 81%)"),
  },
  // Wood
  {
    layer: "landcover",
    kind: "fill",
    geometry: "Polygon",
    minzoom: 9,
    where: (p) => p.subclass === "wood",
    color: c("hsl(102, 36%, 72%)"),
  },
  // Tidalflat
  {
    layer: "landcover",
    kind: "fill",
    geometry: "Polygon",
    minzoom: 9,
    where: (p) => p.subclass === "tidalflat",
    color: c("hsl(28, 19%, 84%)"),
  },
  // Wetland and swamp
  {
    layer: "landcover",
    kind: "fill",
    geometry: "Polygon",
    minzoom: 9,
    where: (p) => ["swamp", "wetland"].includes(String(p.subclass)),
    color: c("hsl(102, 36%, 72%)"),
  },
  // Scree
  {
    layer: "landcover",
    kind: "fill",
    geometry: "Polygon",
    minzoom: 9,
    where: (p) => p.subclass === "scree",
    color: c("hsl(30, 35%, 90%)"),
  },
  // Sand
  {
    layer: "landcover",
    kind: "fill",
    geometry: "Polygon",
    minzoom: 9,
    where: (p) => p.subclass === "sand",
    color: c("hsl(45, 70%, 87%)"),
  },
  // Recreation ground
  {
    layer: "landcover",
    kind: "fill",
    geometry: "Polygon",
    minzoom: 9,
    where: (p) => p.subclass === "recreation_ground",
    color: c("hsl(126, 100%, 92%)"),
  },
  // Orchard and vineyard
  {
    layer: "landcover",
    kind: "fill",
    geometry: "Polygon",
    minzoom: 9,
    where: (p) =>
      ["orchard", "plant_nursery", "vineyard"].includes(String(p.subclass)),
    color: c("hsl(109, 48%, 76%)"),
  },
  // Meadow
  {
    layer: "landcover",
    kind: "fill",
    geometry: "Polygon",
    minzoom: 9,
    where: (p) =>
      ["meadow", "reedbed", "saltmarsh", "village_green"].includes(
        String(p.subclass),
      ),
    color: c("hsl(91, 60%, 81%)"),
  },
  // Mangrove
  {
    layer: "landcover",
    kind: "fill",
    geometry: "Polygon",
    minzoom: 9,
    where: (p) => p.subclass === "mangrove",
    color: c("hsl(80, 35%, 76%)"),
  },
  // Heath
  {
    layer: "landcover",
    kind: "fill",
    geometry: "Polygon",
    minzoom: 9,
    where: (p) => ["heath"].includes(String(p.subclass)),
    color: c("hsl(63, 43%, 74%)"),
  },
  // Forest
  {
    layer: "landcover",
    kind: "fill",
    geometry: "Polygon",
    minzoom: 9,
    where: (p) => p.subclass === "forest",
    color: c("hsl(102, 36%, 72%)"),
  },
  // Farmland
  {
    layer: "landcover",
    kind: "fill",
    geometry: "Polygon",
    minzoom: 9,
    where: (p) => p.subclass === "farmland",
    color: c("hsl(64, 47%, 89%)"),
  },
  // Farm
  {
    layer: "landcover",
    kind: "fill",
    geometry: "Polygon",
    minzoom: 9,
    where: (p) => p.subclass === "farm",
    color: c("hsl(35, 75%, 85%)"),
  },
  // Scrub
  {
    layer: "landcover",
    kind: "fill",
    geometry: "Polygon",
    minzoom: 9,
    where: (p) => p.subclass === "scrub",
    color: c("hsl(80, 35%, 76%)"),
  },
  // Dune
  {
    layer: "landcover",
    kind: "fill",
    geometry: "Polygon",
    minzoom: 9,
    where: (p) => p.subclass === "dune",
    color: c("hsl(45, 70%, 87%)"),
  },
  // Beach
  {
    layer: "landcover",
    kind: "fill",
    geometry: "Polygon",
    minzoom: 9,
    where: (p) => p.subclass === "beach",
    color: c("hsl(48, 100%, 86%)"),
  },
  // Bare rock
  {
    layer: "landcover",
    kind: "fill",
    geometry: "Polygon",
    minzoom: 9,
    where: (p) => p.subclass === "bare_rock",
    color: c("hsl(30, 35%, 90%)"),
  },
  // Allotments
  {
    layer: "landcover",
    kind: "fill",
    geometry: "Polygon",
    minzoom: 9,
    where: (p) => p.subclass === "allotments",
    color: c("hsl(102, 36%, 82%)"),
  },
  // Grass
  {
    layer: "landcover",
    kind: "fill",
    geometry: "Polygon",
    minzoom: 9,
    where: (p) =>
      ["grass", "grassland", "golf_course"].includes(String(p.subclass)),
    color: c("hsl(91, 60%, 81%)"),
  },
  // Glacier
  {
    layer: "landcover",
    kind: "fill",
    geometry: "Polygon",
    minzoom: 5,
    where: (p) => ["ice"].includes(String(p.class)),
    color: c("hsl(180, 28%, 90%)"),
  },
  // River
  {
    layer: "waterway",
    kind: "line",
    geometry: "LineString",
    where: (p) =>
      p.class === "river" && p.brunnel !== "tunnel" && p.intermittent !== 1,
    color: c("hsl(210, 73%, 78%)"),
    width: {
      base: 1.2,
      stops: [
        [11, 0.5],
        [20, 20],
      ],
    },
  },
  // River intermittent
  {
    layer: "waterway",
    kind: "line",
    geometry: "LineString",
    where: (p) =>
      p.class === "river" && p.brunnel !== "tunnel" && p.intermittent === 1,
    color: c("hsl(210, 73%, 78%)"),
    width: {
      base: 1.2,
      stops: [
        [11, 0.5],
        [20, 20],
      ],
    },
    dash: [3, 2],
  },
  // Other waterway
  {
    layer: "waterway",
    kind: "line",
    geometry: "LineString",
    where: (p) =>
      p.class !== "river" && p.brunnel !== "tunnel" && p.intermittent !== 1,
    color: c("hsl(210, 73%, 78%)"),
    width: {
      base: 1.3,
      stops: [
        [13, 0.5],
        [20, 6],
      ],
    },
  },
  // Other waterway intermittent
  {
    layer: "waterway",
    kind: "line",
    geometry: "LineString",
    where: (p) =>
      p.class !== "river" && p.brunnel !== "tunnel" && p.intermittent === 1,
    color: c("hsl(210, 73%, 78%)"),
    width: {
      base: 1.3,
      stops: [
        [13, 0.5],
        [20, 6],
      ],
    },
    dash: [4, 3],
  },
  // Water intermittent
  {
    layer: "water",
    kind: "fill",
    geometry: "Polygon",
    where: (p) => p.intermittent === 1,
    color: c("hsl(205, 91%, 83%)"),
    opacity: 0.85,
  },
  // Water
  {
    layer: "water",
    kind: "fill",
    geometry: "Polygon",
    where: (p) => p.intermittent !== 1 && p.brunnel !== "tunnel",
    color: c("hsl(194, 45%, 77%)"),
  },
  // Runway
  {
    layer: "aeroway",
    kind: "line",
    geometry: "LineString",
    minzoom: 11,
    where: (p) => p.class === "runway",
    color: c("hsl(234, 25%, 76%)"),
    width: {
      base: 1.2,
      stops: [
        [11, 3],
        [20, 48],
      ],
    },
  },
  // Taxiway
  {
    layer: "aeroway",
    kind: "line",
    geometry: "LineString",
    minzoom: 11,
    where: (p) => p.class === "taxiway",
    color: c("hsl(234, 25%, 76%)"),
    width: {
      base: 1.2,
      stops: [
        [11, 1],
        [20, 24],
      ],
    },
  },
  // Building
  {
    layer: "building",
    kind: "fill",
    geometry: "Polygon",
    minzoom: 13,
    color: c("hsl(24, 19%, 84%)"),
    colorStops: {
      base: 1,
      stops: [
        [13, c("hsl(24, 19%, 84%)")],
        [16, c("hsl(26, 17%, 82%)")],
      ],
    },
  },
  // Pier
  {
    layer: "transportation",
    kind: "fill",
    geometry: "Polygon",
    where: (p) => p.class === "pier",
    color: c("hsl(42, 49%, 93%)"),
  },
  // Pier road
  {
    layer: "transportation",
    kind: "line",
    geometry: "LineString",
    where: (p) => p.class === "pier",
    color: c("hsl(42, 49%, 93%)"),
    width: {
      base: 1.2,
      stops: [
        [15, 1],
        [17, 4],
      ],
    },
  },
  // Service road outline
  {
    layer: "transportation",
    kind: "line",
    geometry: "LineString",
    minzoom: 13,
    where: (p) =>
      p.brunnel !== "tunnel" && ["service"].includes(String(p.class)),
    color: c("hsl(0, 0%, 73%)"),
    width: {
      base: 1.2,
      stops: [
        [13, 2],
        [15, 3.5],
        [16, 7],
        [17, 8.5],
        [18, 11],
        [19, 12],
      ],
    },
  },
  // Track road outline
  {
    layer: "transportation",
    kind: "line",
    geometry: "LineString",
    minzoom: 13,
    where: (p) => p.brunnel !== "tunnel" && ["track"].includes(String(p.class)),
    color: c("hsla(0, 0%, 100%, 0.5)"),
    colorStops: {
      base: 1,
      stops: [
        [11, c("hsla(0, 0%, 100%, 0.5)")],
        [22, c("hsla(0, 0%, 100%, 0.7)")],
      ],
    },
    width: {
      base: 1.2,
      stops: [
        [13, 2],
        [17, 3.5],
        [19, 4.5],
      ],
    },
  },
  // Tertiary road link outline
  {
    layer: "transportation",
    kind: "line",
    geometry: "LineString",
    minzoom: 11,
    where: (p) =>
      p.brunnel !== "tunnel" &&
      ["tertiary"].includes(String(p.class)) &&
      p.ramp === 1,
    color: c("hsl(0, 0%, 56%)"),
    width: {
      base: 1.2,
      stops: [
        [11, 1.6],
        [12, 3],
        [13, 4],
        [14, 6.2],
        [15, 8.2],
        [16, 12.6],
        [17, 15.6],
        [18, 17.6],
      ],
    },
  },
  // Secondary road link outline
  {
    layer: "transportation",
    kind: "line",
    geometry: "LineString",
    minzoom: 11,
    where: (p) =>
      p.brunnel !== "tunnel" &&
      ["secondary"].includes(String(p.class)) &&
      p.ramp === 1,
    color: c("hsl(67, 67%, 41%)"),
    colorStops: {
      base: 1,
      stops: [
        [11, c("hsl(67, 67%, 41%)")],
        [12, c("hsl(67, 92%, 25%)")],
      ],
    },
    width: {
      base: 1.2,
      stops: [
        [11, 2.6],
        [12, 3.7],
        [13, 4.2],
        [14, 6.4],
        [15, 8.4],
        [16, 12],
        [17, 14],
        [18, 16.5],
      ],
    },
  },
  // Primary road link outline
  {
    layer: "transportation",
    kind: "line",
    geometry: "LineString",
    minzoom: 11,
    where: (p) =>
      p.brunnel !== "tunnel" &&
      p.ramp === 1 &&
      ["primary"].includes(String(p.class)),
    color: c("hsl(38, 67%, 46%)"),
    colorStops: {
      base: 1,
      stops: [
        [11, c("hsl(38, 67%, 46%)")],
        [12, c("hsl(40, 100%, 31%)")],
      ],
    },
    width: {
      base: 1.2,
      stops: [
        [11, 1.5],
        [12, 4],
        [13, 4],
        [14, 7.8],
        [16, 12],
        [17, 13],
        [18, 16],
      ],
    },
  },
  // Trunk road link outline
  {
    layer: "transportation",
    kind: "line",
    geometry: "LineString",
    minzoom: 11,
    where: (p) =>
      p.brunnel !== "tunnel" &&
      p.ramp === 1 &&
      ["trunk"].includes(String(p.class)),
    color: c("hsl(13, 58%, 55%)"),
    colorStops: {
      base: 1,
      stops: [
        [11, c("hsl(13, 58%, 55%)")],
        [12, c("hsl(12, 62%, 48%)")],
      ],
    },
    width: {
      base: 1.2,
      stops: [
        [11, 1.5],
        [12, 4],
        [14, 7.8],
        [16, 12],
        [17, 13],
        [18, 16],
      ],
    },
  },
  // Highway link outline
  {
    layer: "transportation",
    kind: "line",
    geometry: "LineString",
    minzoom: 11,
    where: (p) =>
      p.brunnel !== "tunnel" && p.class === "motorway" && p.ramp === 1,
    color: c("hsl(345, 49%, 53%)"),
    colorStops: {
      base: 1,
      stops: [
        [11, c("hsl(345, 49%, 53%)")],
        [12, c("hsl(339, 72%, 51%)")],
      ],
    },
    width: {
      base: 1.2,
      stops: [
        [11, 1.5],
        [12, 4],
        [14, 7.8],
        [16, 12],
        [17, 13],
        [18, 16],
        [19, 17],
      ],
    },
  },
  // Minor road outline
  {
    layer: "transportation",
    kind: "line",
    geometry: "LineString",
    minzoom: 13,
    where: (p) =>
      p.brunnel !== "tunnel" &&
      ["minor"].includes(String(p.class)) &&
      p.ramp !== "1",
    color: c("hsl(0, 0%, 73%)"),
    opacity: {
      base: 1,
      stops: [
        [10, 0],
        [12.5, 1],
      ],
    },
    width: {
      base: 1.2,
      stops: [
        [13, 3],
        [14, 5],
        [15, 6],
        [16, 12],
        [17, 13],
        [18, 17],
      ],
    },
  },
  // Tertiary road outline
  {
    layer: "transportation",
    kind: "line",
    geometry: "LineString",
    minzoom: 11,
    where: (p) =>
      p.brunnel !== "tunnel" &&
      ["tertiary"].includes(String(p.class)) &&
      p.ramp !== 1,
    color: c("hsl(0, 0%, 56%)"),
    width: {
      base: 1.2,
      stops: [
        [11, 2.5],
        [12, 4],
        [13, 5],
        [14, 9],
        [15, 10],
        [16, 18],
        [17, 21],
        [18, 27],
      ],
    },
  },
  // Secondary road outline
  {
    layer: "transportation",
    kind: "line",
    geometry: "LineString",
    minzoom: 11,
    where: (p) =>
      p.brunnel !== "tunnel" &&
      ["secondary"].includes(String(p.class)) &&
      p.ramp !== 1,
    color: c("hsl(67, 67%, 41%)"),
    colorStops: {
      base: 1,
      stops: [
        [11, c("hsl(67, 67%, 41%)")],
        [12, c("hsl(67, 92%, 25%)")],
      ],
    },
    width: {
      base: 1.2,
      stops: [
        [11, 3.5],
        [12, 5],
        [13, 5],
        [14, 9],
        [15, 10],
        [16, 18],
        [17, 21],
        [18, 27],
      ],
    },
  },
  // Trunk road outline
  {
    layer: "transportation",
    kind: "line",
    geometry: "LineString",
    minzoom: 11,
    where: (p) =>
      p.brunnel !== "tunnel" &&
      p.ramp !== 1 &&
      ["trunk"].includes(String(p.class)) &&
      p.ramp !== 1,
    color: c("hsl(44, 100%, 31%)"),
    colorStops: {
      base: 1,
      stops: [
        [11, c("hsl(44, 100%, 31%)")],
        [12, c("hsl(12, 62%, 48%)")],
      ],
    },
    width: {
      base: 1.2,
      stops: [
        [9, 6],
        [11, 3.5],
        [12, 5],
        [13, 5],
        [15, 10],
        [16, 18],
        [17, 21],
        [18, 27],
      ],
    },
  },
  // Primary road outline
  {
    layer: "transportation",
    kind: "line",
    geometry: "LineString",
    minzoom: 9,
    where: (p) =>
      p.brunnel !== "tunnel" &&
      p.ramp !== 1 &&
      ["primary"].includes(String(p.class)) &&
      p.ramp !== 1,
    color: c("hsla(46, 100%, 96%, 0.47)"),
    colorStops: {
      base: 1,
      stops: [
        [10.9, c("hsla(46, 100%, 96%, 0.47)")],
        [11, c("hsl(44, 100%, 31%)")],
      ],
    },
    width: {
      base: 1.2,
      stops: [
        [9, 6],
        [11, 3.5],
        [12, 5],
        [13, 5],
        [15, 10],
        [16, 18],
        [17, 21],
        [18, 27],
      ],
    },
  },
  // Highway road outline
  {
    layer: "transportation",
    kind: "line",
    geometry: "LineString",
    minzoom: 5,
    where: (p) =>
      p.brunnel !== "tunnel" && p.class === "motorway" && p.ramp !== 1,
    color: c("hsl(345, 49%, 53%)"),
    colorStops: {
      base: 1,
      stops: [
        [11, c("hsl(345, 49%, 53%)")],
        [12, c("hsl(339, 72%, 51%)")],
      ],
    },
    width: {
      base: 1.2,
      stops: [
        [5, 0],
        [7, 1.75],
        [18, 27],
      ],
    },
  },
  // Tertiary road link
  {
    layer: "transportation",
    kind: "line",
    geometry: "LineString",
    minzoom: 11,
    where: (p) =>
      p.brunnel !== "tunnel" &&
      ["tertiary"].includes(String(p.class)) &&
      p.ramp === 1,
    color: c("hsl(0, 0%, 73%)"),
    colorStops: {
      base: 1,
      stops: [
        [10.5, c("hsl(0, 0%, 73%)")],
        [10.6, c("hsl(0, 0%, 100%)")],
      ],
    },
    width: {
      base: 1.2,
      stops: [
        [11, 1],
        [12, 2],
        [13, 3],
        [14, 5],
        [15, 7],
        [16, 11],
        [17, 14],
        [18, 16],
      ],
    },
  },
  // Secondary road link
  {
    layer: "transportation",
    kind: "line",
    geometry: "LineString",
    minzoom: 11,
    where: (p) =>
      p.brunnel !== "tunnel" &&
      ["secondary"].includes(String(p.class)) &&
      p.ramp === 1,
    color: c("hsl(0, 0%, 73%)"),
    colorStops: {
      base: 1,
      stops: [
        [10.5, c("hsl(0, 0%, 73%)")],
        [10.6, c("hsl(63, 86%, 86%)")],
      ],
    },
    width: {
      base: 1.2,
      stops: [
        [11, 2],
        [12, 3],
        [13, 3.5],
        [14, 5],
        [15, 7],
        [16, 10],
        [17, 12],
        [18, 14.5],
      ],
    },
  },
  // Primary road link
  {
    layer: "transportation",
    kind: "line",
    geometry: "LineString",
    minzoom: 11,
    where: (p) =>
      p.brunnel !== "tunnel" &&
      p.ramp === 1 &&
      ["primary"].includes(String(p.class)),
    color: c("hsl(34, 94%, 82%)"),
    width: {
      base: 1.2,
      stops: [
        [11, 1.5],
        [12, 3],
        [13, 3],
        [14, 6.6],
        [16, 10.4],
        [17, 11.4],
        [18, 14.4],
      ],
    },
  },
  // Trunk road link
  {
    layer: "transportation",
    kind: "line",
    geometry: "LineString",
    minzoom: 11,
    where: (p) =>
      p.brunnel !== "tunnel" &&
      p.ramp === 1 &&
      ["trunk"].includes(String(p.class)),
    color: c("hsl(15, 96%, 81%)"),
    colorStops: {
      base: 1,
      stops: [
        [6, c("hsl(15, 96%, 81%)")],
        [11, c("hsl(14, 89%, 79%)")],
      ],
    },
    width: {
      base: 1.2,
      stops: [
        [11, 0.9],
        [12, 3],
        [14, 6.6],
        [16, 10.4],
        [17, 11.4],
        [18, 14.4],
      ],
    },
  },
  // Highway road link
  {
    layer: "transportation",
    kind: "line",
    geometry: "LineString",
    minzoom: 8,
    where: (p) =>
      p.brunnel !== "tunnel" && p.class === "motorway" && p.ramp === 1,
    color: c("hsl(347, 71%, 67%)"),
    colorStops: {
      base: 1,
      stops: [
        [6, c("hsl(347, 71%, 67%)")],
        [10, c("hsl(349, 65%, 74%)")],
      ],
    },
    width: {
      base: 1.2,
      stops: [
        [8, 0.7],
        [11, 0.9],
        [12, 3],
        [14, 6.6],
        [16, 10.4],
        [17, 11.4],
        [18, 14.4],
        [19, 15.4],
      ],
    },
  },
  // Service road
  {
    layer: "transportation",
    kind: "line",
    geometry: "LineString",
    minzoom: 12,
    where: (p) =>
      p.brunnel !== "tunnel" && ["service"].includes(String(p.class)),
    color: c("hsl(0, 0%, 100%)"),
    width: {
      base: 1.2,
      stops: [
        [13, 0.9],
        [15, 2.3],
        [16, 5.4],
        [17, 6.9],
        [18, 9.4],
        [19, 10.4],
      ],
    },
  },
  // Track road
  {
    layer: "transportation",
    kind: "line",
    geometry: "LineString",
    minzoom: 12,
    where: (p) => p.brunnel !== "tunnel" && ["track"].includes(String(p.class)),
    color: c("hsla(42, 61%, 41%, 0.5)"),
    colorStops: {
      base: 1,
      stops: [
        [12, c("hsla(42, 61%, 41%, 0.5)")],
        [16, c("hsl(42, 61%, 41%)")],
      ],
    },
    width: {
      base: 1.2,
      stops: [
        [13, 1.5],
        [17, 2],
        [19, 2.5],
      ],
    },
    dash: [3, 2.5],
  },
  // Minor road
  {
    layer: "transportation",
    kind: "line",
    geometry: "LineString",
    minzoom: 12,
    where: (p) => p.brunnel !== "tunnel" && p.class === "minor",
    color: c("hsl(0, 0%, 83%)"),
    colorStops: {
      base: 1,
      stops: [
        [12, c("hsl(0, 0%, 83%)")],
        [13, c("hsl(0, 0%, 100%)")],
      ],
    },
    width: {
      base: 1.2,
      stops: [
        [12, 1],
        [13, 1.9],
        [14, 3.8],
        [15, 4.8],
        [16, 10.4],
        [17, 11.4],
        [18, 15.4],
      ],
    },
  },
  // Tertiary road
  {
    layer: "transportation",
    kind: "line",
    geometry: "LineString",
    minzoom: 9,
    where: (p) =>
      p.brunnel !== "tunnel" &&
      ["tertiary"].includes(String(p.class)) &&
      p.ramp !== 1,
    color: c("hsl(0, 0%, 73%)"),
    colorStops: {
      base: 1,
      stops: [
        [10.5, c("hsl(0, 0%, 73%)")],
        [10.6, c("hsl(0, 0%, 100%)")],
      ],
    },
    width: {
      base: 1.2,
      stops: [
        [9, 0.7],
        [10, 0.7],
        [11, 1.9],
        [12, 3],
        [13, 3.9],
        [14, 7.8],
        [15, 8.8],
        [16, 16.4],
        [17, 19.4],
        [18, 25.4],
      ],
    },
  },
  // Secondary road
  {
    layer: "transportation",
    kind: "line",
    geometry: "LineString",
    minzoom: 8,
    where: (p) =>
      p.brunnel !== "tunnel" &&
      ["secondary"].includes(String(p.class)) &&
      p.ramp !== 1,
    color: c("hsl(0, 0%, 73%)"),
    colorStops: {
      base: 1,
      stops: [
        [10.5, c("hsl(0, 0%, 73%)")],
        [10.6, c("hsl(63, 86%, 86%)")],
      ],
    },
    width: {
      base: 1.2,
      stops: [
        [8, 1],
        [9, 1.1],
        [10, 1.1],
        [11, 2.9],
        [12, 4.3],
        [13, 4.3],
        [14, 7.6],
        [15, 8.6],
        [16, 16],
        [17, 19],
        [18, 25],
      ],
    },
  },
  // Primary road
  {
    layer: "transportation",
    kind: "line",
    geometry: "LineString",
    minzoom: 7,
    where: (p) =>
      p.brunnel !== "tunnel" &&
      p.ramp !== 1 &&
      ["primary"].includes(String(p.class)),
    color: c("hsl(35, 83%, 73%)"),
    colorStops: {
      base: 1,
      stops: [
        [7, c("hsl(35, 83%, 73%)")],
        [11, c("hsl(34, 94%, 82%)")],
      ],
    },
    width: {
      base: 1.2,
      stops: [
        [7, 1],
        [8, 1.4],
        [9, 1.8],
        [10, 1.8],
        [11, 2.5],
        [12, 4],
        [13, 4],
        [15, 8.6],
        [16, 16],
        [17, 19],
        [18, 25],
      ],
    },
  },
  // Trunk road
  {
    layer: "transportation",
    kind: "line",
    geometry: "LineString",
    minzoom: 5,
    where: (p) =>
      p.brunnel !== "tunnel" &&
      p.ramp !== 1 &&
      ["trunk"].includes(String(p.class)),
    color: c("hsl(347, 71%, 67%)"),
    colorStops: {
      base: 1,
      stops: [
        [6, c("hsl(347, 71%, 67%)")],
        [11, c("hsl(14, 89%, 79%)")],
      ],
    },
    width: {
      base: 1.2,
      stops: [
        [5, 0.3],
        [6, 0.5],
        [7, 1],
        [8, 1.4],
        [9, 1.8],
        [10, 1.8],
        [11, 2.5],
        [12, 4],
        [13, 4],
        [15, 8.6],
        [16, 16],
        [17, 19],
        [18, 25],
      ],
    },
  },
  // Highway road
  {
    layer: "transportation",
    kind: "line",
    geometry: "LineString",
    minzoom: 5,
    where: (p) =>
      p.brunnel !== "tunnel" && p.class === "motorway" && p.ramp !== 1,
    color: c("hsl(347, 71%, 67%)"),
    colorStops: {
      base: 1,
      stops: [
        [6, c("hsl(347, 71%, 67%)")],
        [10, c("hsl(349, 65%, 74%)")],
      ],
    },
    width: {
      base: 1.2,
      stops: [
        [4.9, 0],
        [7, 1],
        [18, 25],
      ],
    },
  },
  // Major rail service
  {
    layer: "transportation",
    kind: "line",
    geometry: "LineString",
    where: (p) =>
      p.brunnel !== "tunnel" &&
      ["rail"].includes(String(p.class)) &&
      ["siding", "spur", "yard"].includes(String(p.service)),
    color: c("hsl(0, 0%, 47%)"),
    colorStops: {
      base: 1,
      stops: [
        [8, c("hsl(0, 0%, 47%)")],
        [14, c("hsl(0, 0%, 51%)")],
      ],
    },
    opacity: 0.4,
    width: {
      base: 1.4,
      stops: [
        [8, 0.8],
        [11, 1.5],
        [15, 3],
        [20, 5.4],
      ],
    },
  },
  // Major rail
  {
    layer: "transportation",
    kind: "line",
    geometry: "LineString",
    where: (p) =>
      p.brunnel !== "tunnel" &&
      ["rail"].includes(String(p.class)) &&
      !["siding", "spur", "yard"].includes(String(p.service)),
    color: c("hsl(0, 0%, 47%)"),
    colorStops: {
      base: 1,
      stops: [
        [8, c("hsl(0, 0%, 47%)")],
        [14, c("hsl(0, 0%, 51%)")],
      ],
    },
    width: {
      base: 1.4,
      stops: [
        [8, 0.8],
        [11, 1.5],
        [15, 3],
        [20, 5.4],
      ],
    },
  },
  // Minor rail
  {
    layer: "transportation",
    kind: "line",
    geometry: "LineString",
    where: (p) =>
      p.brunnel !== "tunnel" &&
      ["tram", "light_rail"].includes(String(p.subclass)),
    color: c("hsl(0, 0%, 51%)"),
    width: {
      base: 1.4,
      stops: [
        [12, 0.8],
        [15, 1.2],
        [20, 4],
      ],
    },
  },
  // Major rail hatching
  {
    layer: "transportation",
    kind: "line",
    geometry: "LineString",
    minzoom: 8,
    where: (p) => p.brunnel !== "tunnel" && p.class === "rail",
    color: c("hsl(0, 0%, 100%)"),
    width: {
      base: 1.4,
      stops: [
        [9, 0],
        [14, 1.5],
        [20, 3],
      ],
    },
    dash: [2.5, 2.5],
  },
  // Minor rail hatching
  {
    layer: "transportation",
    kind: "line",
    geometry: "LineString",
    where: (p) =>
      p.brunnel !== "tunnel" &&
      ["tram", "light_rail"].includes(String(p.subclass)),
    color: c("hsl(0, 0%, 73%)"),
    width: {
      base: 1.4,
      stops: [
        [14.5, 0],
        [15, 2],
        [20, 6],
      ],
    },
    dash: [0.2, 4],
  },
  // Other border
  {
    layer: "boundary",
    kind: "line",
    geometry: "LineString",
    minzoom: 3,
    where: (p) => [3, 4].includes(Number(p.admin_level)) && p.maritime === 0,
    color: c("hsl(301, 23%, 42%)"),
    opacity: {
      base: 1,
      stops: [
        [3, 0.5],
        [10, 1],
      ],
    },
    width: {
      base: 1,
      stops: [
        [4, 0.4],
        [5, 0.7],
        [12, 1.6],
      ],
    },
    dash: [5, 3],
  },
  // Country border
  {
    layer: "boundary",
    kind: "line",
    geometry: "LineString",
    minzoom: 0,
    where: (p) => p.admin_level === 2 && p.disputed === 0,
    color: c("hsl(303, 17%, 56%)"),
    width: {
      base: 1,
      stops: [
        [3, 0.5],
        [5, 1.2],
        [12, 3],
      ],
    },
  },
  // Disputed border
  {
    layer: "boundary",
    kind: "line",
    geometry: "LineString",
    minzoom: 0,
    where: (p) => p.admin_level === 2 && p.disputed === 1,
    color: c("hsl(246, 17%, 56%)"),
    width: {
      base: 1,
      stops: [
        [3, 0.5],
        [5, 1.2],
        [12, 3],
      ],
    },
    dash: [4, 3],
  },
  // Other labels
  {
    layer: "place",
    kind: "text",
    geometry: "Point",
    minzoom: 8,
    where: (p) =>
      ["hamlet", "island", "islet", "neighbourhood", "suburb"].includes(
        String(p.class),
      ),
    color: c("hsl(0, 0%, 13%)"),
    colorStops: {
      base: 1,
      stops: [
        [12.5, c("hsl(0, 0%, 13%)")],
        [12.6, c("hsl(0, 0%, 47%)")],
      ],
    },
    size: {
      base: 1.2,
      stops: [
        [11, 10],
        [14, 14],
        [18, 16],
      ],
    },
    halo: c("hsl(0, 0%, 100%)"),
    priority: 1,
    mixedCase: true,
  },
  // Village labels
  {
    layer: "place",
    kind: "text",
    geometry: "Point",
    minzoom: 8,
    where: (p) => p.class === "village",
    color: c("hsl(0, 0%, 20%)"),
    size: {
      base: 1.2,
      stops: [
        [10, 10],
        [15, 16],
      ],
    },
    halo: c("hsla(0, 0%, 100%, 0.8)"),
    priority: 2,
    mixedCase: true,
  },
  // Town labels
  {
    layer: "place",
    kind: "text",
    geometry: "Point",
    minzoom: 6,
    where: (p) => p.class === "town",
    color: c("hsl(0, 0%, 20%)"),
    size: {
      base: 1.2,
      stops: [
        [7, 10],
        [11, 13],
      ],
    },
    halo: c("hsla(0, 0%, 100%, 0.8)"),
    priority: 3,
    mixedCase: true,
  },
  // State labels
  {
    layer: "place",
    kind: "text",
    geometry: "Point",
    minzoom: 4,
    maxzoom: 12,
    where: (p) => p.class === "state" && Number(p.rank) < 3,
    color: c("hsl(302, 18%, 42%)"),
    size: {
      base: 1,
      stops: [
        [3, 10],
        [6, 14],
      ],
    },
    halo: c("hsla(0, 0%, 100%, 0.7)"),
    priority: 4,
    mixedCase: true,
  },
  // City labels
  {
    layer: "place",
    kind: "text",
    geometry: "Point",
    minzoom: 4,
    maxzoom: 14,
    where: (p) => p.class === "city" && ![1, 2].includes(Number(p.capital)),
    color: c("hsl(0, 0%, 35%)"),
    colorStops: {
      base: 1,
      stops: [
        [6, c("hsl(0, 0%, 35%)")],
        [14, c("hsl(0, 0%, 13%)")],
      ],
    },
    size: {
      base: 1.2,
      stops: [
        [4, 11],
        [15, 16],
      ],
    },
    halo: c("hsla(0, 0%, 100%, 0.8)"),
    priority: 5,
    mixedCase: true,
  },
  // Capital city labels
  {
    layer: "place",
    kind: "text",
    geometry: "Point",
    minzoom: 3,
    maxzoom: 15,
    where: (p) => p.class === "city" && [1, 2].includes(Number(p.capital)),
    color: c("hsl(0, 0%, 29%)"),
    colorStops: {
      base: 1,
      stops: [
        [6, c("hsl(0, 0%, 29%)")],
        [14, c("hsla(0, 0%, 13%, 1)")],
      ],
    },
    size: {
      base: 1.2,
      stops: [
        [4, 12],
        [12, 18],
      ],
    },
    halo: c("hsla(0, 0%, 100%, 0.8)"),
    priority: 6,
    mixedCase: true,
  },
  // Country labels
  {
    layer: "place",
    kind: "text",
    geometry: "Point",
    minzoom: 2,
    maxzoom: 12,
    where: (p) => p.class === "country" && p.iso_a2 !== "VA",
    color: c("hsl(302, 16%, 36%)"),
    colorStops: {
      base: 1,
      stops: [
        [2, c("hsl(302, 16%, 36%)")],
        [10, c("hsl(273, 33%, 22%)")],
      ],
    },
    size: {
      base: 1,
      stops: [
        [5, 13.5],
        [7, 18],
      ],
    },
    halo: c("hsla(0, 0%, 100%, 0.8)"),
    priority: 7,
    mixedCase: true,
  },
];
export const brightRulesByLayer = indexRules(brightRules);
