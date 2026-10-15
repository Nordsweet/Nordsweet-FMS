export type Rgba = [number, number, number, number];

/** hsl(h, s%, l%) to 0-255 channels (CSS Color 3). */
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
  };
  return [f(0), f(8), f(4)];
}

/** deck.gl wants 0-255 channels; the palette is written as CSS (`#rrggbb`, `rgba(...)`, `hsl(...)`). */
export function cssColor(css: string, opacity = 1): Rgba {
  const hex = /^#([0-9a-f]{6})$/i.exec(css.trim());
  if (hex) {
    const n = parseInt(hex[1]!, 16);
    return [n >> 16, (n >> 8) & 255, n & 255, Math.round(255 * opacity)];
  }
  const hsl =
    /^hsla?\(\s*([\d.]+)\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%\s*(?:,\s*([\d.]+)\s*)?\)$/i.exec(
      css.trim(),
    );
  if (hsl)
    return [
      ...hslToRgb(Number(hsl[1]), Number(hsl[2]) / 100, Number(hsl[3]) / 100),
      Math.round(255 * (hsl[4] === undefined ? 1 : Number(hsl[4])) * opacity),
    ];
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
