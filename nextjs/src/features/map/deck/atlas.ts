import { airspacePalette } from "~/domain/airspace-style";
import { palettes, type Theme } from "./theme";
import {
  aircraftSymbol,
  PARACHUTE_PATH,
  pointSymbol,
  pointSymbols,
} from "../symbols";

export type IconName =
  | `point-${(typeof pointSymbols)[number]}`
  | "aircraft"
  | "aircraft-red"
  | "aircraft-amber"
  | "aircraft-caution"
  | "ownship"
  | "parachute";
type Frame = { x: number; y: number; width: number; height: number };

const ATLAS_WIDTH = 384;

/** The parachute that marks a zone with a PJE activation, drawn like the old canvas label did. */
function parachute() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 48;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(2, 2);
  const path = new Path2D(PARACHUTE_PATH);
  ctx.lineJoin = ctx.lineCap = "round";
  ctx.fillStyle = "rgba(255,255,255,.9)";
  ctx.fill(path);
  ctx.strokeStyle = "rgba(255,255,255,.95)";
  ctx.lineWidth = 4;
  ctx.stroke(path);
  ctx.strokeStyle = airspacePalette.ATZ!.stroke;
  ctx.lineWidth = 1.7;
  ctx.stroke(path);
  return ctx.getImageData(0, 0, 48, 48);
}

function build(theme: Theme) {
  const sprites: [IconName, ImageData][] = [
    ...pointSymbols.map((symbol): [IconName, ImageData] => [
      `point-${symbol}`,
      pointSymbol(symbol, 0, palettes[theme].ink),
    ]),
    ["aircraft", aircraftSymbol([17, 17, 17])],
    ["aircraft-red", aircraftSymbol([220, 38, 38])],
    ["aircraft-amber", aircraftSymbol([245, 158, 11])],
    ["aircraft-caution", aircraftSymbol([255, 255, 255])],
    ["ownship", aircraftSymbol([36, 79, 134], true)],
    ["parachute", parachute()],
  ];
  const mapping = {} as Record<IconName, Frame>;
  let x = 0,
    y = 0,
    row = 0;
  for (const [name, image] of sprites) {
    if (x + image.width > ATLAS_WIDTH) {
      x = 0;
      y += row;
      row = 0;
    }
    mapping[name] = { x, y, width: image.width, height: image.height };
    x += image.width;
    row = Math.max(row, image.height);
  }
  const canvas = document.createElement("canvas");
  canvas.width = ATLAS_WIDTH;
  canvas.height = y + row;
  const ctx = canvas.getContext("2d")!;
  for (const [name, image] of sprites)
    ctx.putImageData(image, mapping[name].x, mapping[name].y);
  return { url: canvas.toDataURL(), mapping };
}

const atlases: Partial<Record<Theme, ReturnType<typeof build>>> = {};
/** All map symbols in one texture per theme; built on first use because it needs a canvas. */
export const iconAtlas = (theme: Theme) => (atlases[theme] ??= build(theme));
