export type Rgba = [number, number, number, number];

/** deck.gl wants 0-255 channels; the palette is written as CSS (`#rrggbb` or `rgba(r,g,b,a)`). */
export function cssColor(css: string, opacity = 1): Rgba {
  const hex = /^#([0-9a-f]{6})$/i.exec(css.trim());
  if (hex) {
    const n = parseInt(hex[1]!, 16);
    return [n >> 16, (n >> 8) & 255, n & 255, Math.round(255 * opacity)];
  }
  const rgba =
    /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)$/i.exec(
      css.trim(),
    );
  if (!rgba) throw new Error(`Unsupported colour: ${css}`);
  const alpha = rgba[4] === undefined ? 1 : Number(rgba[4]);
  return [
    Number(rgba[1]),
    Number(rgba[2]),
    Number(rgba[3]),
    Math.round(255 * alpha * opacity),
  ];
}
