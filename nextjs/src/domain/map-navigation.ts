import {
  type LatLon,
  destinationPoint,
  distanceNm,
  initialBearingDeg,
  trackOffset,
} from "./geo";
import { type NavPoint } from "./progress";

export function positionAgeAlpha(ageMs: number) {
  return ageMs <= 60000 ? 1 : Math.max(0, 1 - (ageMs - 60000) / 60000);
}

/** Legacy's two-minute projection/fade window; original observations remain distinct from estimates. */
export function projectedPosition(
  position: LatLon,
  time: string,
  speedKt: number | null,
  trackDeg: number | null,
  now: number,
) {
  const ageMs = Math.max(0, now - Date.parse(time));
  if (!Number.isFinite(ageMs) || positionAgeAlpha(ageMs) <= 0) return null;
  const point =
    speedKt !== null && speedKt > 0 && trackDeg !== null
      ? destinationPoint(
          position,
          trackDeg,
          (speedKt * Math.min(ageMs, 120000)) / 3600000,
        )
      : position;
  return { ...point, alpha: positionAgeAlpha(ageMs) };
}

/** Snap a route tap to its chosen great-circle leg, keeping the anchor even at route crossings. */
export function nearestRouteSegment(route: NavPoint[], point: LatLon) {
  let best: {
    index: number;
    fraction: number;
    point: LatLon;
    distanceNm: number;
  } | null = null;
  for (let index = 0; index < route.length - 1; index++) {
    const from = route[index]!,
      to = route[index + 1]!;
    const length = distanceNm(from, to);
    if (length < 0.00001) continue;
    const fraction = Math.max(
      0,
      Math.min(1, trackOffset(from, to, point).alongTrackNm / length),
    );
    const snapped = destinationPoint(
      from,
      initialBearingDeg(from, to),
      length * fraction,
    );
    const distance = distanceNm(snapped, point);
    if (!best || distance < best.distanceNm)
      best = { index, fraction, point: snapped, distanceNm: distance };
  }
  return best;
}

export function nextWaypointIdent(route: NavPoint[]) {
  return (
    "WPT " +
    (1 +
      route.reduce(
        (max, point) =>
          Math.max(max, Number(/^WPT\s*(\d+)$/i.exec(point.ident)?.[1] ?? 0)),
        0,
      ))
  );
}

export function routeSegmentMinutes(
  distance: number,
  cruiseSpeedKt: number,
  speedLimitKt: number | null,
) {
  const speed =
    speedLimitKt !== null && speedLimitKt > 0
      ? Math.min(cruiseSpeedKt, speedLimitKt)
      : cruiseSpeedKt;
  return Number.isFinite(speed) && speed > 0 && Number.isFinite(distance)
    ? Math.max(1, Math.round((distance / speed) * 60))
    : null;
}

/** Ray casting with hole exclusion; boundary points count as inside, as in the legacy inspector. */
export function polygonContainsPoint(rings: number[][][], point: LatLon) {
  const inside = (ring: number[][]) => {
    let hit = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const a = ring[i]!,
        b = ring[j]!;
      const cross =
        (point.lon - a[0]!) * (b[1]! - a[1]!) -
        (point.lat - a[1]!) * (b[0]! - a[0]!);
      if (
        Math.abs(cross) < 1e-10 &&
        point.lon >= Math.min(a[0]!, b[0]!) &&
        point.lon <= Math.max(a[0]!, b[0]!) &&
        point.lat >= Math.min(a[1]!, b[1]!) &&
        point.lat <= Math.max(a[1]!, b[1]!)
      )
        return true;
      if (
        a[1]! > point.lat !== b[1]! > point.lat &&
        point.lon <
          ((b[0]! - a[0]!) * (point.lat - a[1]!)) / (b[1]! - a[1]!) + a[0]!
      )
        hit = !hit;
    }
    return hit;
  };
  return !!rings[0] && inside(rings[0]) && !rings.slice(1).some(inside);
}

export function airspaceAltitudeFt(value: string) {
  const text = value.trim().toUpperCase();
  if (/\b(SFC|GND|GROUND|SURFACE)\b/.test(text)) return 0;
  if (/\b(UNL|UNLIMITED)\b/.test(text)) return Infinity;
  const fl = /\bFL\s*(\d+)/.exec(text);
  if (fl) return Number(fl[1]) * 100;
  const a = /^A(\d{3})$/.exec(text);
  if (a) return Number(a[1]) * 100;
  const number = /-?\d+(?:[.,]\d+)?/.exec(text);
  return number
    ? Number(number[0].replace(",", ".")) *
        (/\b(M|METRE|METRES|METER|METERS)\b/.test(text) && !/\bFT\b/.test(text)
          ? 3.28084
          : 1)
    : null;
}

export function plannedAltitudeForZone(
  points: (LatLon & { altitudeFt: number | null })[],
  rings: number[][][],
  fallbackFt: number,
) {
  const heights = points
    .filter(
      (p) =>
        p.altitudeFt !== null &&
        Number.isFinite(p.altitudeFt) &&
        polygonContainsPoint(rings, p),
    )
    .map((p) => p.altitudeFt!)
    .sort((a, b) => a - b);
  if (!heights.length) return fallbackFt;
  const middle = Math.floor(heights.length / 2);
  return heights.length % 2
    ? heights[middle]!
    : Math.round((heights[middle - 1]! + heights[middle]!) / 2);
}

export function airspaceKind(name: string, classType: string) {
  const text = (name + " " + classType).toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (text.startsWith("EPTR") || text.includes("TRA")) return "TRA";
  if (text.startsWith("EPTS") || text.includes("TSA")) return "TSA";
  if (text.startsWith("EPP")) return "P";
  if (text.startsWith("EPR")) return "R";
  return (
    [
      "MCTR",
      "MTMA",
      "MATZ",
      "ATZ",
      "CTR",
      "TMA",
      "ADIZ",
      "RMZ",
      "TMZ",
      "FIS",
    ].find((type) => text.includes(type)) ??
    (["P", "R", "D"].includes(classType) ? classType : "OTHER")
  );
}

export function routeCrossesPolygon(route: LatLon[], rings: number[][][]) {
  if (route.some((point) => polygonContainsPoint(rings, point))) return true;
  for (let i = 0; i < route.length - 1; i++) {
    const a = route[i]!,
      b = route[i + 1]!;
    for (const ring of rings)
      for (let j = 0; j < ring.length - 1; j++) {
        const c = ring[j]!,
          d = ring[j + 1]!;
        const den =
          (b.lon - a.lon) * (d[1]! - c[1]!) - (b.lat - a.lat) * (d[0]! - c[0]!);
        if (Math.abs(den) < 1e-12) continue;
        const t =
          ((c[0]! - a.lon) * (d[1]! - c[1]!) -
            (c[1]! - a.lat) * (d[0]! - c[0]!)) /
          den;
        const u =
          ((c[0]! - a.lon) * (b.lat - a.lat) -
            (c[1]! - a.lat) * (b.lon - a.lon)) /
          den;
        if (t >= 0 && t <= 1 && u >= 0 && u <= 1) return true;
      }
  }
  return false;
}

/** Preserve legacy CPA colouring, including its vertical thresholds and time windows. */
export function trafficAlertLevel(
  own: {
    lat: number;
    lon: number;
    altitudeFt: number | null;
    speedKt: number | null;
    trackDeg: number | null;
  } | null,
  target: {
    lat: number;
    lon: number;
    altitudeFt: number | null;
    speedKt: number | null;
    trackDeg: number | null;
  },
): "normal" | "red" | "amber" | "caution" {
  if (
    own?.altitudeFt == null ||
    target.altitudeFt === null ||
    target.speedKt === null ||
    target.trackDeg === null
  )
    return "normal";
  const velocity = (speed: number | null, track: number | null) => {
    if (speed === null || track === null || speed < 0)
      return { east: 0, north: 0 };
    const radians = (track * Math.PI) / 180;
    return {
      east: speed * Math.sin(radians),
      north: speed * Math.cos(radians),
    };
  };
  const a = velocity((own.speedKt ?? 0) >= 1 ? own.speedKt : 0, own.trackDeg),
    b = velocity(target.speedKt, target.trackDeg);
  const east =
      (target.lon - own.lon) *
      60 *
      Math.cos((((own.lat + target.lat) / 2) * Math.PI) / 180),
    north = (target.lat - own.lat) * 60;
  const ve = b.east - a.east,
    vn = b.north - a.north,
    speedSquared = ve * ve + vn * vn;
  if (speedSquared < 0.25) return "normal";
  const seconds = (-3600 * (east * ve + north * vn)) / speedSquared;
  if (!Number.isFinite(seconds) || seconds < 0 || seconds > 300)
    return "normal";
  const vertical = Math.abs(target.altitudeFt - own.altitudeFt);
  if (vertical <= 200 && seconds <= 35) return "red";
  if (vertical <= 500 && seconds >= 20 && seconds <= 48) return "amber";
  return vertical <= 1000 ? "caution" : "normal";
}
