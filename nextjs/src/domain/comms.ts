import { type AirspaceFeature } from "~/api/aviation/schemas";

import { type FlightPhase } from "./flight-phase";
import { type LatLon, distanceNm } from "./geo";
import { zoneRadioRows } from "./map-radio";
import {
  airspaceKind,
  polygonContainsPoint,
  routeCrossesPolygon,
  airspaceAltitudeFt,
} from "./map-navigation";

/** Route-based radio suggestions (legacy public/comms.js + the map's comms responder). */
export type RadioRow = {
  frequencyMhz: string;
  callsign: string;
  sector: string | null;
  serviceId?: string;
  airport?: string;
};
/** Airport frequencies for these services, in the order the services are given. */
export type AirportRows = (icao: string, services: string[]) => RadioRow[];
export type RadioPosition = LatLon & {
  altitudeFt?: number | null;
  altitudeAglFt?: number | null;
};

const rowKey = (r: RadioRow) => [r.frequencyMhz, r.callsign].join("|");

export function uniqueRows(rows: RadioRow[]) {
  const seen = new Set<string>();
  return rows.filter((r) => {
    const key = rowKey(r);
    if (!r.frequencyMhz || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
export const radioRowsKey = (rows: RadioRow[]) =>
  uniqueRows(rows).map(rowKey).sort().join(";");
const rowsKey = radioRowsKey;

const isEnrouteInfo = (z: AirspaceFeature) =>
  /FIS|FIR/.test((z.properties.name + " " + z.properties.class).toUpperCase());
const kind = (z: AirspaceFeature) =>
  /^(?:EP\s*)?TR(?:A)?\s*\d/i.test(z.properties.name) ||
  /^(TR|TRA)$/.test(z.properties.class)
    ? "TRA"
    : airspaceKind(z.properties.name, z.properties.class);

/** Lotnik can append the exact closed ring in reverse; its two traversals cancel ray casting. */
function withoutRetrace(ring: [number, number][]) {
  const clean = ring.filter(
    (p, i) => i === 0 || p[0] !== ring[i - 1]![0] || p[1] !== ring[i - 1]![1],
  );
  const end = clean.findIndex(
    (p, i) => i > 0 && p[0] === clean[0]![0] && p[1] === clean[0]![1],
  );
  if (
    end >= 3 &&
    clean.length === 2 * end + 1 &&
    clean.every(
      (p, i) =>
        i <= end ||
        (p[0] === clean[2 * end - i]![0] && p[1] === clean[2 * end - i]![1]),
    )
  )
    return clean.slice(0, end + 1);
  return ring;
}

/** Local service volumes and FIS/FIR background, including cached retraced OpenAir boundaries. */
export const commsZones = (zones: AirspaceFeature[]) =>
  zones
    .filter(
      (z) =>
        isEnrouteInfo(z) ||
        ["ATZ", "CTR", "TMA", "TRA", "MATZ", "MCTR", "MTMA"].includes(kind(z)),
    )
    .map((z) => ({
      ...z,
      geometry: {
        ...z.geometry,
        coordinates: z.geometry.coordinates.map(withoutRetrace),
      },
    }));

const FIS_UNITS: [RegExp, string][] = [
  [/KRAK[OÓ]W/i, "EPKK"],
  [/GDA[NŃ]SK/i, "EPGD"],
  [/POZNA[NŃ]/i, "EPPO"],
  [/WARSZAWA/i, "EPWA"],
];
const SECTORS: Record<string, string> = {
  N: "NORTH",
  S: "SOUTH",
  E: "EAST",
  W: "WEST",
};

/** Legacy commsZoneRows: ATZ → its aerodrome's radio/tower, FIS sector → its unit's sector rows. */
export function zoneRows(z: AirspaceFeature, airport: AirportRows) {
  const name = z.properties.name;
  // A sector's own channel is more specific than an aerodrome's complete service list.
  const embedded = zoneRadioRows(z.properties);
  if (embedded.length) return embedded;
  if (["CTR", "TMA"].includes(kind(z))) {
    const icao =
      /\bEP[A-Z0-9]{2}\b/.exec(name.toUpperCase())?.[0] ??
      FIS_UNITS.find(([pattern]) => pattern.test(name))?.[1];
    return icao
      ? airport(
          icao,
          kind(z) === "TMA"
            ? ["zblizanie", "radar", "approach"]
            : ["tower", "zblizanie"],
        )
      : [];
  }
  if (kind(z) === "ATZ") {
    const icao = /\bEP[A-Z0-9]{2}\b/.exec(name.toUpperCase())?.[0];
    const rows = icao ? airport(icao, ["radio", "informacja", "tower"]) : [];
    return (rows.length ? rows : zoneRadioRows(z.properties)).map((r) => ({
      ...r,
      sector: [name, r.sector].filter(Boolean).join(" / "),
    }));
  }
  // Legacy mapped only Kraków FIS West/East to EPKK; every Polish FIS unit has sector rows.
  const unit = FIS_UNITS.find(([pattern]) => pattern.test(name));
  // A FIR identifies the national airspace, not the responsible regional FIS unit.
  if (unit && kind(z) === "FIS") {
    const rows = airport(unit[1], ["fiss"]);
    const word = /\b([NSEW])(?:ORTH|OUTH|AST|EST)?\b/.exec(
      name.toUpperCase(),
    )?.[1];
    const sector = rows.filter(
      (r) => word && r.sector?.toUpperCase().startsWith(SECTORS[word]!),
    );
    if (rows.length) return sector.length ? sector : rows;
  }
  return zoneRadioRows(z.properties);
}

/** Rows for a position: the ATZ first, then the FIS sector (else any FIR/FIS zone). */
export function rowsAt(
  point: RadioPosition,
  zones: AirspaceFeature[],
  airport: AirportRows,
) {
  const containing = zones.filter(
    ({ bbox: [w, s, e, n], geometry, properties }) =>
      properties.active_now !== false &&
      [properties.lower, properties.upper].every((limit, i) => {
        const height = /AGL|GND|SFC|SURFACE/i.test(limit)
          ? point.altitudeAglFt
          : point.altitudeFt;
        const bound = airspaceAltitudeFt(limit);
        return (
          height == null ||
          bound == null ||
          (i === 0 ? height >= bound : height <= bound)
        );
      }) &&
      point.lon >= w &&
      point.lon <= e &&
      point.lat >= s &&
      point.lat <= n &&
      polygonContainsPoint(geometry.coordinates, point),
  );
  // Resolve the most specific local service before the enclosing FIS/FIR background.
  // Smaller published sectors override umbrella polygons of the same service.
  const area = (z: AirspaceFeature) =>
    (z.bbox[2] - z.bbox[0]) * (z.bbox[3] - z.bbox[1]);
  for (const types of [
    ["TRA"],
    ["CTR", "MCTR"],
    ["TMA", "MTMA"],
    ["ATZ", "MATZ"],
    ["FIS"],
    ["OTHER"],
  ]) {
    const candidates = containing
      .filter(
        (z) =>
          types.includes(kind(z)) && (kind(z) !== "OTHER" || isEnrouteInfo(z)),
      )
      .sort((a, b) => area(a) - area(b));
    for (const zone of candidates) {
      const rows = zoneRows(zone, airport);
      if (rows.length) return uniqueRows(rows);
    }
  }
  return [];
}

/** "FIS / ATZ on route": every crossed zone with its rows, without repeats. */
export function routeRadioGroups(
  route: LatLon[],
  zones: AirspaceFeature[],
  airport: AirportRows,
) {
  const groups = zones
    .filter((z) => routeCrossesPolygon(route, z.geometry.coordinates))
    .map((z) => ({ name: z.properties.name, rows: zoneRows(z, airport) }));
  const seen = new Set<string>();
  return groups.filter((g) => {
    const key = g.name + "|" + g.rows.map((r) => r.frequencyMhz).join(",");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Legacy segmentFraction: projection on the segment in a locally scaled lat/lon plane. */
function segmentFraction(p: LatLon, a: LatLon, b: LatLon) {
  const scale = Math.cos((((a.lat + b.lat + p.lat) / 3) * Math.PI) / 180) || 1;
  const dx = (b.lon - a.lon) * scale;
  const dy = b.lat - a.lat;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq <= 1e-12) return 0;
  const t = ((p.lon - a.lon) * scale * dx + (p.lat - a.lat) * dy) / lengthSq;
  return Math.max(0, Math.min(1, t));
}
const along = (a: LatLon, b: LatLon, t: number) => ({
  lat: a.lat + (b.lat - a.lat) * t,
  lon: a.lon + (b.lon - a.lon) * t,
});

export type CommsNote =
  "atc" | "waitingGps" | "addRoute" | "offRoute" | "approximate" | "noBoundary";

export type CommsEstimate = {
  current: RadioRow[];
  next: RadioRow[];
  /** Sector notes ("sectors") plus a detail, or the ATC note on ground/terminal phases. */
  notes: ("sectors" | CommsNote)[];
  distanceNm: number | null;
  seconds: number | null;
  speedKt: number | null;
  speedSource: "gps" | "planned" | null;
};

/**
 * Legacy NordsweetComms.estimate. Outside cruise the current/next pair comes from the phase and the
 * airports; in cruise from the sector at the GPS position and the first change along the route.
 */
export function estimateComms(
  input: {
    phase: FlightPhase;
    /** A GPS fix less than 30 s old, else null. */
    position: RadioPosition | null;
    gpsSpeedKt: number | null;
    plannedSpeedKt: number;
    route: RadioPosition[];
    /** Sequenced leg prevents a returning route from projecting onto its earlier crossing. */
    activeLeg?: number;
    activeLegEnd?: number;
  },
  api: {
    dep: (services: string[]) => RadioRow[];
    arr: (services: string[]) => RadioRow[];
    at: (point: RadioPosition) => RadioRow[];
  },
): CommsEstimate {
  const { phase, position, route } = input;
  const point = position ?? route[0] ?? null;
  const enroute = point ? uniqueRows(api.at(point)) : [];
  const dep = (s: string[]) => uniqueRows(api.dep(s));
  const arr = (s: string[]) => uniqueRows(api.arr(s));
  const tower = ["tower", "radio"];
  const approach = ["zblizanie", "radar"];
  const first = (...lists: RadioRow[][]) => lists.find((r) => r.length) ?? [];
  const result: CommsEstimate = {
    current: enroute,
    next: [],
    notes: ["sectors"],
    distanceNm: null,
    seconds: null,
    speedKt: null,
    speedSource: null,
  };
  if (
    phase !== "cruise" &&
    !(position && !["taxiout", "taxiin"].includes(phase))
  ) {
    const pairs: Record<Exclude<FlightPhase, "cruise">, () => RadioRow[][]> = {
      taxiout: () => [first(dep(["ground"]), dep(tower)), dep(tower)],
      takeoff: () => [dep(tower), first(dep(approach), enroute)],
      climb: () => [first(dep(approach), enroute), enroute],
      descent: () => [first(arr(approach), arr(tower)), arr(tower)],
      landing: () => [arr(tower), arr(["ground"])],
      taxiin: () => [first(arr(["ground"]), arr(tower)), []],
    };
    const [current, next] = pairs[phase]() as [RadioRow[], RadioRow[]];
    return {
      ...result,
      current,
      next: rowsKey(current) === rowsKey(next) ? [] : next,
      notes: ["atc"],
    };
  }
  if (!position) return { ...result, current: [], notes: ["waitingGps"] };
  if (route.length < 2) return { ...result, notes: ["sectors", "addRoute"] };

  let best = { distance: Infinity, index: 0, t: 0 };
  for (let i = 0; i < route.length - 1; i++) {
    if (
      input.activeLeg !== undefined &&
      (i < input.activeLeg || i >= (input.activeLegEnd ?? input.activeLeg + 1))
    )
      continue;
    const t = segmentFraction(position, route[i]!, route[i + 1]!);
    const distance = distanceNm(position, along(route[i]!, route[i + 1]!, t));
    if (distance < best.distance) best = { distance, index: i, t };
  }
  if (best.distance > 3) return { ...result, notes: ["sectors", "offRoute"] };

  // Walk the route in 0.25 NM steps to the first point with different rows.
  const initial = rowsKey(enroute);
  let travelled = 0;
  for (let i = best.index; i < route.length - 1; i++) {
    const a = route[i]!;
    const b = route[i + 1]!;
    const length = distanceNm(a, b);
    const start = i === best.index ? best.t : 0;
    const steps = Math.max(1, Math.ceil((length * (1 - start)) / 0.25));
    for (let j = 1; j <= steps; j++) {
      const t = start + ((1 - start) * j) / steps;
      const rows = uniqueRows(
        api.at({
          ...along(a, b, t),
          altitudeFt:
            a.altitudeFt != null && b.altitudeFt != null
              ? a.altitudeFt + (b.altitudeFt - a.altitudeFt) * t
              : position.altitudeFt,
          // AGL at a distant point is unknown without its terrain, not the current AGL.
          altitudeAglFt: null,
        }),
      );
      if (rowsKey(rows) !== initial) {
        const distance = travelled + length * (t - start);
        const gps = input.gpsSpeedKt;
        const speed = gps ?? input.plannedSpeedKt;
        return {
          ...result,
          next: rows,
          distanceNm: distance,
          speedKt: speed,
          speedSource: gps !== null ? "gps" : "planned",
          seconds: speed > 1 ? (distance / speed) * 3600 : null,
          notes: ["sectors", "approximate"],
        };
      }
    }
    travelled += length * (1 - start);
  }
  const next = first(arr(approach), arr(tower));
  return {
    ...result,
    next: rowsKey(next) === initial ? [] : next,
    notes: ["sectors", "noBoundary"],
  };
}
