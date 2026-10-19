import { type Basemap } from "~/stores/map";
import { lightInk, type PointInk } from "../symbols";
import { cssColor, type Rgba } from "./color";

/** `light` is the printed-chart look; `dark` (night map, black background) lightens everything drawn on top. */
export type Theme = "light" | "dark";
export const themeOf = (basemap: Basemap): Theme =>
  basemap === "osm" || basemap === "bright" ? "light" : "dark";

type Palette = {
  ink: PointInk;
  /** The outline that keeps text readable over the map (and the trails over the tiles). */
  halo: Rgba;
  airportTitle: Rgba;
  airportDetails: Rgba;
  ifrName: Rgba;
  vfrName: Rgba;
  navaidName: Rgba;
  callsign: Rgba;
  flightData: Rgba;
  /** Own-ship vector, ticks, accuracy circle and minute numbers. */
  ownship: Rgba;
  /** Casing under a selected aircraft's trail. */
  trailHalo: Rgba;
  /** Share of white mixed into airspace outlines and captions. */
  lift: number;
  /** Background behind the tiles while they load, and with no tiles at all. */
  background: string;
};

const c = (css: string) => cssColor(css);

export const palettes: Record<Theme, Palette> = {
  light: {
    ink: lightInk,
    halo: [255, 255, 255, 235],
    airportTitle: c("#126cac"),
    airportDetails: c("#2479ae"),
    ifrName: c("#1f5794"),
    vfrName: c("#111827"),
    navaidName: c("#6923a5"),
    callsign: c("#064f67"),
    flightData: c("#17633f"),
    ownship: c("#244f86"),
    trailHalo: [255, 255, 255, 209],
    lift: 0,
    background: "#faf9f4",
  },
  dark: {
    ink: {
      airport: "#62b8f2",
      ink: "#e6edf5",
      navaid: "#c293f5",
      vfr: "#52d48c",
      ifr: "#74aef2",
    },
    halo: [8, 12, 18, 235],
    airportTitle: c("#7cc4f5"),
    airportDetails: c("#9bd0f2"),
    ifrName: c("#86b6f0"),
    vfrName: c("#e6edf5"),
    navaidName: c("#d0a8f7"),
    callsign: c("#62d6ee"),
    flightData: c("#74e6a6"),
    ownship: c("#6eaef7"),
    trailHalo: [8, 12, 18, 200],
    lift: 0.45,
    background: "#080c12",
  },
};

/** Mix `amount` of white into a colour, keeping its alpha. */
export const lighten = (color: Rgba, amount: number): Rgba => [
  Math.round(color[0] + (255 - color[0]) * amount),
  Math.round(color[1] + (255 - color[1]) * amount),
  Math.round(color[2] + (255 - color[2]) * amount),
  color[3],
];
