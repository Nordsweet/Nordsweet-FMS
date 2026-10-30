import data from "~/data/warsaw-radar-sectors.json";
import { polygonContainsPoint } from "./map-navigation";
import type { LatLon } from "./geo";

// Published elementary LOW sectors, not a live sector configuration. Boundaries
// on the FIR use simplified OpenStreetMap land borders and Lotnik's maritime arc.
// Do not silently use an expired AIRAC or decide near an approximate boundary.
const VALID_FROM = Date.parse("2026-10-29T00:00:00Z");
const VALID_UNTIL = Date.parse("2026-11-26T00:00:00Z");
const BOUNDARY_MARGIN_NM = 0.5;
const sectors = data.map((sector) => {
  const coordinates = sector.coordinates as [number, number][];
  const lons = coordinates.map((p) => p[0]);
  const lats = coordinates.map((p) => p[1]);
  return {
    ...sector,
    coordinates,
    bbox: [
      Math.min(...lons),
      Math.min(...lats),
      Math.max(...lons),
      Math.max(...lats),
    ],
  };
});

/** Published primary frequency only when the current AIRAC and sector are unambiguous. */
export function warsawRadarSector(point: LatLon, now = Date.now()) {
  if (now < VALID_FROM || now >= VALID_UNTIL) return null;
  const candidates = sectors.filter((sector) => {
    const [w, s, e, n] = sector.bbox;
    return (
      point.lon >= w! &&
      point.lon <= e! &&
      point.lat >= s! &&
      point.lat <= n! &&
      polygonContainsPoint([sector.coordinates], point)
    );
  });
  if (candidates.length !== 1) return null;
  const sector = candidates[0]!;
  const scale = Math.cos((point.lat * Math.PI) / 180);
  const ring = sector.coordinates;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i]!,
      b = ring[(i + 1) % ring.length]!;
    const ax = (a[0] - point.lon) * scale * 60,
      ay = (a[1] - point.lat) * 60;
    const dx = (b[0] - a[0]) * scale * 60,
      dy = (b[1] - a[1]) * 60;
    const length = dx * dx + dy * dy;
    const t = length
      ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / length))
      : 0;
    if (Math.hypot(ax + t * dx, ay + t * dy) <= BOUNDARY_MARGIN_NM) return null;
  }
  return {
    frequencyMhz: sector.frequencyMhz,
    callsign: "Warszawa Radar",
    sector: `EPWW ${sector.id} LOW`,
    serviceId: "acc",
  };
}
