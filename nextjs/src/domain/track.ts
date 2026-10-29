import { distanceNm } from "./geo";
import { escapeXml } from "./route-export";

export type TrackPoint = {
  lat: number;
  lon: number;
  altitudeFt: number | null;
  time: string;
};

export function summarizeTrack(track: TrackPoint[]) {
  let distance = 0;
  for (let i = 1; i < track.length; i++)
    distance += distanceNm(track[i - 1]!, track[i]!);
  const altitudes = track
    .map((p) => p.altitudeFt)
    .filter((a): a is number => a !== null);
  return {
    minutes:
      track.length > 1
        ? (Date.parse(track.at(-1)!.time) - Date.parse(track[0]!.time)) / 60000
        : 0,
    distanceNm: distance,
    maxAltitudeFt: altitudes.length ? Math.max(...altitudes) : null,
  };
}

/** GPX 1.1 track; elevation in metres as the format requires. */
export function toGpx(track: TrackPoint[], name: string) {
  const points = track
    .map(
      (p) =>
        `<trkpt lat="${p.lat.toFixed(6)}" lon="${p.lon.toFixed(6)}">` +
        (p.altitudeFt === null
          ? ""
          : `<ele>${(p.altitudeFt * 0.3048).toFixed(1)}</ele>`) +
        `<time>${p.time}</time></trkpt>`,
    )
    .join("\n      ");
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Nordsweet FMS" xmlns="http://www.topografix.com/GPX/1/1">
  <trk>
    <name>${escapeXml(name)}</name>
    <trkseg>
      ${points}
    </trkseg>
  </trk>
</gpx>
`;
}
