import { angleDiffDeg, normalizeDeg, toDeg, toRad } from "./angles";

export type LatLon = { lat: number; lon: number };

/** Mean Earth radius in nautical miles (6371.0088 km). */
export const EARTH_RADIUS_NM = 6371008.8 / 1852;

function angularDistance(a: LatLon, b: LatLon) {
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Great-circle distance. */
export function distanceNm(a: LatLon, b: LatLon) {
  return angularDistance(a, b) * EARTH_RADIUS_NM;
}

/** Initial true bearing from `a` to `b`, degrees [0, 360). */
export function initialBearingDeg(a: LatLon, b: LatLon) {
  const φ1 = toRad(a.lat);
  const φ2 = toRad(b.lat);
  const Δλ = toRad(b.lon - a.lon);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x =
    Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return normalizeDeg(toDeg(Math.atan2(y, x)));
}

/** Point reached from `start` after `distance` NM on initial true bearing `bearingDeg`. */
export function destinationPoint(
  start: LatLon,
  bearingDeg: number,
  distance: number,
): LatLon {
  const δ = distance / EARTH_RADIUS_NM;
  const θ = toRad(bearingDeg);
  const φ1 = toRad(start.lat);
  const λ1 = toRad(start.lon);
  const φ2 = Math.asin(
    Math.sin(φ1) * Math.cos(δ) + Math.cos(φ1) * Math.sin(δ) * Math.cos(θ),
  );
  const λ2 =
    λ1 +
    Math.atan2(
      Math.sin(θ) * Math.sin(δ) * Math.cos(φ1),
      Math.cos(δ) - Math.sin(φ1) * Math.sin(φ2),
    );
  return { lat: toDeg(φ2), lon: ((toDeg(λ2) + 540) % 360) - 180 };
}

/**
 * Position of `point` relative to the great circle `from` → `to`.
 * crossTrackNm is positive right of track; alongTrackNm is measured from `from`.
 */
export function trackOffset(from: LatLon, to: LatLon, point: LatLon) {
  const δ13 = angularDistance(from, point);
  const θ13 = toRad(initialBearingDeg(from, point));
  const θ12 = toRad(initialBearingDeg(from, to));
  const δxt = Math.asin(Math.sin(δ13) * Math.sin(θ13 - θ12));
  const δat = Math.acos(
    Math.min(1, Math.max(-1, Math.cos(δ13) / Math.cos(δxt))),
  );
  const behind = Math.abs(angleDiffDeg(toDeg(θ12), toDeg(θ13))) > 90;
  return {
    crossTrackNm: δxt * EARTH_RADIUS_NM,
    alongTrackNm: (behind ? -δat : δat) * EARTH_RADIUS_NM,
  };
}

/** Great-circle midpoint of a leg. */
export function midpoint(a: LatLon, b: LatLon) {
  return destinationPoint(a, initialBearingDeg(a, b), distanceNm(a, b) / 2);
}
