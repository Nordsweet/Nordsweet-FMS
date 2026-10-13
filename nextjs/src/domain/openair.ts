import { destinationPoint, type LatLon } from "./geo";

export type ImportedZone = {
  name: string;
  class: string;
  lower: string;
  upper: string;
  ring: [number, number][];
};
function coordinate(text: string): LatLon | null {
  const dms =
    /(\d{1,2})[: ](\d{1,2})[: ]([\d.]+)\s*([NS])\s+(\d{1,3})[: ](\d{1,2})[: ]([\d.]+)\s*([EW])/i.exec(
      text,
    );
  const point = dms
    ? {
        lat:
          (Number(dms[1]) + Number(dms[2]) / 60 + Number(dms[3]) / 3600) *
          (dms[4]!.toUpperCase() === "S" ? -1 : 1),
        lon:
          (Number(dms[5]) + Number(dms[6]) / 60 + Number(dms[7]) / 3600) *
          (dms[8]!.toUpperCase() === "W" ? -1 : 1),
      }
    : null;
  if (point && Math.abs(point.lat) <= 90 && Math.abs(point.lon) <= 180)
    return point;
  const cup =
    /(\d{2})(\d{2}(?:\.\d+)?)([NS])\s*[,;\s]\s*(\d{3})(\d{2}(?:\.\d+)?)([EW])/i.exec(
      text,
    );
  if (cup) {
    const lat =
      (Number(cup[1]) + Number(cup[2]) / 60) * (/S/i.test(cup[3]!) ? -1 : 1);
    const lon =
      (Number(cup[4]) + Number(cup[5]) / 60) * (/W/i.test(cup[6]!) ? -1 : 1);
    if (Math.abs(lat) <= 90 && Math.abs(lon) <= 180) return { lat, lon };
  }
  const decimal = /^\s*(-?\d+(?:\.\d+)?)\s*[,; ]\s*(-?\d+(?:\.\d+)?)\s*$/.exec(
    text,
  );
  if (
    decimal &&
    Math.abs(Number(decimal[1])) <= 90 &&
    Math.abs(Number(decimal[2])) <= 180
  )
    return { lat: Number(decimal[1]), lon: Number(decimal[2]) };
  return null;
}

/** Local OpenAir files; never replace the collector's airspace feed. Reject unsupported geometry explicitly. */
export function parseOpenAir(text: string): ImportedZone[] {
  const zones: ImportedZone[] = [];
  let zone: ImportedZone | null = null,
    center: LatLon | null = null,
    radius: number | null = null;
  const finish = () => {
    if (!zone) return;
    if (center && radius !== null) {
      const c = center;
      zone.ring = Array.from({ length: 73 }, (_, i) => {
        const p = destinationPoint(c, i * 5, radius!);
        return [p.lon, p.lat];
      });
    }
    if (zone.ring.length >= 3) {
      if (
        zone.ring[0]![0] !== zone.ring.at(-1)![0] ||
        zone.ring[0]![1] !== zone.ring.at(-1)![1]
      )
        zone.ring.push(zone.ring[0]!);
      zones.push(zone);
    }
    zone = null;
    center = null;
    radius = null;
  };
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("*")) continue;
    const tag = line.slice(0, 2).toUpperCase(),
      value = line.slice(2).trim();
    if (tag === "AC") {
      finish();
      zone = {
        name: "OpenAir",
        class: value,
        lower: "GND",
        upper: "UNL",
        ring: [],
      };
      continue;
    }
    if (!zone) continue;
    if (tag === "AN") zone.name = value;
    else if (tag === "AL") zone.lower = value;
    else if (tag === "AH") zone.upper = value;
    else if (tag === "DP") {
      const p = coordinate(value);
      if (!p) throw new Error("Invalid OpenAir coordinate");
      zone.ring.push([p.lon, p.lat]);
    } else if (/^V\s+X\s*=/i.test(line)) {
      center = coordinate(line.replace(/^V\s+X\s*=\s*/i, ""));
      if (!center) throw new Error("Invalid OpenAir center");
    } else if (tag === "DC") {
      radius = Number(value);
      if (!Number.isFinite(radius) || radius <= 0)
        throw new Error("Invalid OpenAir radius");
    } else if (tag === "DA" || tag === "DB")
      throw new Error("OpenAir arcs require a polygon export");
  }
  finish();
  if (!zones.length) throw new Error("No airspace geometry");
  return zones;
}
