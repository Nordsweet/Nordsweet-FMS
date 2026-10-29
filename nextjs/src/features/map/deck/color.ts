import { parseToRgba } from "color2k";

export type Rgba = [number, number, number, number];

/** deck.gl wants 0-255 channels; the palette is written as CSS (`#rrggbb`, `rgba(...)`, `hsl(...)`). */
export function cssColor(css: string, opacity = 1): Rgba {
  const [r, g, b, alpha] = parseToRgba(css);
  return [r, g, b, Math.round(255 * alpha * opacity)];
}
