import { distanceNm, initialBearingDeg } from "./geo";
import { readGpx } from "./gpx";

/** A track point as read from the GPX file. */
export type RawTrackPoint = {
  lat: number;
  lon: number;
  elevationM: number | null;
  time: number | null;
};
export type ReplayPoint = {
  lat: number;
  lon: number;
  altitudeFt: number;
  /** Source time since the previous point (1 s when the file has no times). */
  elapsedMs: number;
  speedKt: number;
  headingDeg: number | null;
};

/**
 * Legacy parseFlightDebugGpx: speed and track from consecutive points, the departure elevation
 * where a point has no elevation.
 */
export function replayPoints(
  raw: RawTrackPoint[],
  fallbackAltitudeFt: number,
): ReplayPoint[] {
  if (raw.length < 2) throw new Error("gpx-too-short");
  return raw.map((point, i) => {
    const previous = raw[Math.max(0, i - 1)]!;
    const distance = i ? distanceNm(previous, point) : 0;
    const seconds =
      i && point.time !== null && previous.time !== null
        ? Math.max(1, (point.time - previous.time) / 1000)
        : 1;
    return {
      lat: point.lat,
      lon: point.lon,
      altitudeFt:
        point.elevationM === null
          ? fallbackAltitudeFt
          : point.elevationM / 0.3048,
      elapsedMs: i ? Math.round(seconds * 1000) : 0,
      speedKt: i ? Math.max(0, Math.min(300, distance / (seconds / 3600))) : 0,
      headingDeg:
        i && distance >= 0.003 ? initialBearingDeg(previous, point) : null,
    };
  });
}

/** Track points (else route points) of a GPX document; waypoints are not part of a flown track. */
export function readGpxTrack(text: string): RawTrackPoint[] {
  const points = readGpx(text);
  const track = points.some((p) => p.kind === "trkpt")
    ? points.filter((p) => p.kind === "trkpt")
    : points.filter((p) => p.kind === "rtept");
  return track
    .map((p) => {
      const time = Date.parse(p.time);
      return {
        lat: p.lat,
        lon: p.lon,
        elevationM:
          p.ele && Number.isFinite(Number(p.ele)) ? Number(p.ele) : null,
        time: Number.isFinite(time) ? time : null,
      };
    })
    .filter(
      (p) =>
        Number.isFinite(p.lat) &&
        Number.isFinite(p.lon) &&
        Math.abs(p.lat) <= 90 &&
        Math.abs(p.lon) <= 180,
    );
}
