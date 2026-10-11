export const toRad = (deg: number) => (deg * Math.PI) / 180;
export const toDeg = (rad: number) => (rad * 180) / Math.PI;

/** Normalizes to [0, 360). */
export function normalizeDeg(deg: number) {
  return ((deg % 360) + 360) % 360;
}

/** Signed difference `to - from` in (-180, 180]. */
export function angleDiffDeg(from: number, to: number) {
  const diff = normalizeDeg(to - from);
  return diff > 180 ? diff - 360 : diff;
}
