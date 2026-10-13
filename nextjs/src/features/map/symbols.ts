/** MapLibre image data keeps aircraft symbols local and available offline. */
export function aircraftSymbol(color: readonly [number, number, number]) {
  const size = 24,
    data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const wing = Math.abs(x - 12),
        upper = y >= 2 && y <= 21 && wing <= (y - 2) * 0.42;
      const notch = y > 17 && wing < (y - 17) * 0.7;
      if (upper && !notch) {
        const i = (y * size + x) * 4;
        data[i] = color[0];
        data[i + 1] = color[1];
        data[i + 2] = color[2];
        data[i + 3] = 255;
      }
    }
  return { width: size, height: size, data };
}
