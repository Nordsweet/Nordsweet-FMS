/** DEM heights and aircraft altitude must share the mean-sea-level datum. */
export function terrainClearancePixels(
  heightsM: Float32Array,
  altitudeFt: number,
) {
  const pixels = new Uint8ClampedArray(heightsM.length * 4);
  if (!Number.isFinite(altitudeFt)) return pixels;
  for (let i = 0; i < heightsM.length; i++) {
    const height = heightsM[i]!;
    if (!Number.isFinite(height)) continue;
    // Millifoot rounding removes Float32 DEM noise at the exact colour boundaries.
    const clearanceFt =
      Math.round((altitudeFt - Math.max(0, height) / 0.3048) * 1000) / 1000;
    if (clearanceFt > 1000) continue;
    pixels[i * 4] = 255;
    pixels[i * 4 + 1] = clearanceFt <= 100 ? 0 : 220;
    pixels[i * 4 + 3] = 150;
  }
  return pixels;
}
