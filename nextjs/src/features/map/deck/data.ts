import { type AirspaceFeature } from "~/api/aviation/schemas";
import { airspaceStyle } from "~/domain/airspace-style";
import { cssColor } from "./color";
import { lighten, palettes, type Theme } from "./theme";
import { type Path, type PointDatum, type ZoneDatum } from "./scene";

type Lonlat = { lat: number; lon: number };

export const zoneDatum = (zone: AirspaceFeature, theme: Theme): ZoneDatum => {
  const style = airspaceStyle(zone.properties);
  return {
    zone,
    fill: cssColor(style.fill, style.fillOpacity),
    stroke: lighten(cssColor(style.stroke), palettes[theme].lift),
    lineWidth: style.lineWidth,
  };
};

export const toPoints = (
  rows: (Lonlat & {
    ident: string;
    name: string;
    kind: string;
    symbol?: string;
    heading?: number;
  })[],
): PointDatum[] =>
  rows.map((r) => ({
    position: [r.lon, r.lat],
    ident: r.ident,
    name: r.name,
    kind: r.kind,
    symbol: r.symbol ?? "ifr",
    heading: r.heading ?? 0,
  }));

/** One path per list of points; lists with fewer than two points draw nothing. */
export const toPaths = (lines: Lonlat[][]): Path[] =>
  lines
    .filter((line) => line.length >= 2)
    .map((line) => ({ path: line.map((p) => [p.lon, p.lat]) }));

/** Already-projected coordinate pairs ([lon, lat]) as paths. */
export const coordinatePaths = (lines: number[][][]): Path[] =>
  lines.map((line) => ({ path: line.map((p) => [p[0]!, p[1]!]) }));
