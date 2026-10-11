import { magvar } from "magvar";

import { normalizeDeg } from "./angles";
import { type LatLon } from "./geo";

/** Magnetic variation (WMM2025), degrees east positive. */
export function magneticVariationDeg(
  position: LatLon,
  when: Date = new Date(),
) {
  return magvar(position.lat, position.lon, 0, when);
}

export function trueToMagneticDeg(trueDeg: number, variationDeg: number) {
  return normalizeDeg(trueDeg - variationDeg);
}

export function magneticToTrueDeg(magneticDeg: number, variationDeg: number) {
  return normalizeDeg(magneticDeg + variationDeg);
}
