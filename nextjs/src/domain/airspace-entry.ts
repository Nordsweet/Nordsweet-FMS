import type { AirspaceFeature } from "~/api/aviation/schemas";
import { destinationPoint, distanceNm, type LatLon } from "./geo";
import {
  airspaceAltitudeFt,
  airspaceKind,
  polygonContainsPoint,
  routeCrossesPolygon,
} from "./map-navigation";

export type EntryObservation = {
  key: string;
  name: string;
  inside: boolean;
  seconds: number | null;
  distanceNm: number;
  /** A boundary transition already within controlled airspace needs information, not another clearance prompt. */
  informationOnly?: boolean;
};
export type EntryVisit = EntryObservation & {
  visit: number;
  entered: boolean;
  cleared: boolean;
  dismissed: boolean;
};
export type EntryMonitor = {
  session: string | null;
  sequence: number;
  visits: EntryVisit[];
};
export const emptyEntryMonitor: EntryMonitor = {
  session: null,
  sequence: 0,
  visits: [],
};

/** Controlled C/CTR/TMA and temporary reserved TR/TRA volumes require an entry acknowledgement. */
export function requiresEntryClearance(zone: AirspaceFeature) {
  if (/\bFIR\b/i.test(zone.properties.name)) return false;
  const cls = zone.properties.class.toUpperCase().replace(/[^A-Z]/g, "");
  return (
    ["C", "CLASSC", "KLASAC", "TR", "TRA"].includes(cls) ||
    ["CTR", "MCTR", "TMA", "MTMA", "TRA"].includes(
      airspaceKind(zone.properties.name, zone.properties.class),
    ) ||
    /^(?:EP)?TR\s*\d/i.test(zone.properties.name)
  );
}

function isFir(zone: AirspaceFeature) {
  return /\bFIR\b/i.test(zone.properties.name);
}

function isControlled(zone: AirspaceFeature) {
  if (isFir(zone)) return false;
  const cls = zone.properties.class.toUpperCase().replace(/[^A-Z]/g, "");
  return (
    ["C", "CLASSC", "KLASAC"].includes(cls) ||
    ["CTR", "MCTR", "TMA", "MTMA"].includes(
      airspaceKind(zone.properties.name, zone.properties.class),
    )
  );
}

/** A TMA's letter/number shelves share one visit; airport names remain distinct. */
function entryIdentity(zone: AirspaceFeature) {
  const name = zone.properties.name
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
  const kind = airspaceKind(name, zone.properties.class);
  if (kind === "TMA" || kind === "MTMA") {
    const base = name.replace(/\s+(?:[A-Z]|\d{1,2}[A-Z]?)$/, "");
    return `TMA:${base}`;
  }
  return JSON.stringify([
    zone.properties.name,
    zone.properties.class,
    zone.properties.lower,
    zone.properties.upper,
    zone.bbox,
  ]);
}

function boundaryDistance(zone: AirspaceFeature, point: LatLon) {
  let best = Infinity;
  const scale = Math.cos((point.lat * Math.PI) / 180);
  for (const ring of zone.geometry.coordinates)
    for (let i = 1; i < ring.length; i++) {
      const a = ring[i - 1]!,
        b = ring[i]!;
      const ax = (a[0] - point.lon) * scale,
        ay = a[1] - point.lat;
      const dx = (b[0] - a[0]) * scale,
        dy = b[1] - a[1];
      const length = dx * dx + dy * dy;
      const t = length
        ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / length))
        : 0;
      best = Math.min(
        best,
        distanceNm(point, {
          lon: a[0] + (b[0] - a[0]) * t,
          lat: a[1] + dy * t,
        }),
      );
    }
  return best;
}

/** Two-minute measured-track projection, clipped to the zone's vertical limits before intersection. */
export function airspaceEntryObservations(
  zones: AirspaceFeature[],
  position: LatLon & {
    altitudeFt: number | null;
    altitudeAglFt: number | null;
    groundSpeedKt: number;
    trackDeg: number | null;
    verticalSpeedFpm?: number;
  },
): EntryObservation[] {
  const result = new Map<
    string,
    EntryObservation & { controlled: boolean; fir: boolean }
  >();
  const nearbyNm = Math.max(5, position.groundSpeedKt / 30);
  for (const zone of zones) {
    if (
      (!requiresEntryClearance(zone) && !isFir(zone)) ||
      zone.properties.active_now === false
    )
      continue;
    const [west, south, east, north] = zone.bbox;
    const lonMargin =
      nearbyNm / (60 * Math.max(0.1, Math.cos((position.lat * Math.PI) / 180)));
    if (
      position.lon < west - lonMargin ||
      position.lon > east + lonMargin ||
      position.lat < south - nearbyNm / 60 ||
      position.lat > north + nearbyNm / 60
    )
      continue;
    const horizontalInside = polygonContainsPoint(
      zone.geometry.coordinates,
      position,
    );
    const distance = horizontalInside ? 0 : boundaryDistance(zone, position);
    if (distance > nearbyNm) continue;
    let start = 0,
      end = 120,
      verticalInside = true;
    const rate = Number.isFinite(position.verticalSpeedFpm)
      ? position.verticalSpeedFpm! / 60
      : 0;
    for (const [index, limit] of [
      zone.properties.lower,
      zone.properties.upper,
    ].entries()) {
      const height = /AGL|GND|SFC|SURFACE/i.test(limit)
        ? position.altitudeAglFt
        : position.altitudeFt;
      const bound = airspaceAltitudeFt(limit);
      if (
        height === null ||
        !Number.isFinite(height) ||
        bound === null ||
        !Number.isFinite(bound)
      )
        continue;
      const below = index === 0;
      const matches = below ? height >= bound : height <= bound;
      verticalInside &&= matches;
      if (rate === 0) {
        if (!matches) end = -1;
      } else {
        const crossing = (bound - height) / rate;
        if (below === rate > 0) start = Math.max(start, crossing);
        else end = Math.min(end, crossing);
      }
    }
    const inside = horizontalInside && verticalInside;
    let seconds: number | null = inside ? 0 : null;
    if (
      !inside &&
      start <= end &&
      position.trackDeg !== null &&
      position.groundSpeedKt >= 5
    ) {
      const at = (seconds: number) =>
        destinationPoint(
          position,
          position.trackDeg!,
          (position.groundSpeedKt * seconds) / 3600,
        );
      const from = at(start),
        to = at(end);
      if (routeCrossesPolygon([from, to], zone.geometry.coordinates)) {
        let low = start,
          high = end;
        for (let i = 0; i < 18; i++) {
          const mid = (low + high) / 2;
          if (routeCrossesPolygon([from, at(mid)], zone.geometry.coordinates))
            high = mid;
          else low = mid;
        }
        seconds = high;
      }
    }
    const key = entryIdentity(zone);
    const existing = result.get(key);
    result.set(key, {
      key,
      name: existing?.name ?? zone.properties.name,
      inside: (existing?.inside ?? false) || inside,
      seconds:
        existing?.seconds == null
          ? seconds
          : seconds == null
            ? existing.seconds
            : Math.min(existing.seconds, seconds),
      distanceNm: Math.min(existing?.distanceNm ?? Infinity, distance),
      controlled: (existing?.controlled ?? false) || isControlled(zone),
      fir: isFir(zone),
    });
  }
  const observations = [...result.values()];
  return observations.map(({ controlled, fir, ...entry }) => ({
    ...entry,
    informationOnly:
      fir ||
      (controlled &&
        observations.some(
          (other) =>
            other.key !== entry.key && other.controlled && other.inside,
        )),
  }));
}

/** Clearance and dismissal belong to one visit, and expire on departure or when moving away. */
export function observeEntryMonitor(
  previous: EntryMonitor,
  session: string | null,
  observations: EntryObservation[],
): EntryMonitor {
  const state =
    previous.session === session ? previous : { ...emptyEntryMonitor, session };
  let sequence = state.sequence;
  const visits: EntryVisit[] = [];
  for (const observation of session ? observations : []) {
    const old = state.visits.find((v) => v.key === observation.key);
    const left =
      old?.entered && !observation.inside && observation.seconds === null;
    if (
      left ||
      (!old &&
        (observation.seconds === null ||
          (observation.informationOnly && observation.inside)))
    )
      continue;
    visits.push(
      old
        ? {
            ...old,
            ...observation,
            informationOnly:
              old.informationOnly === true ||
              observation.informationOnly === true,
            entered: old.entered || observation.inside,
          }
        : {
            ...observation,
            visit: ++sequence,
            entered: observation.inside,
            cleared: false,
            dismissed: false,
          },
    );
  }
  return { session, sequence, visits };
}
