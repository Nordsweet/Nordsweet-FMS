import { type Airport, type Navpoint } from "~/data/schemas";
import {
  type AirspaceFeature,
  type TrafficAircraft,
} from "~/api/aviation/schemas";
import { airspaceCaption } from "./airspace-labels";

export type MapSearchResult =
  | {
      kind: "point";
      label: string;
      point: {
        ident: string;
        name: string;
        kind: string;
        lat: number;
        lon: number;
      };
    }
  | { kind: "airspace"; label: string; zone: AirspaceFeature }
  | { kind: "traffic"; label: string; aircraft: TrafficAircraft };

/** Compare compact codes, registrations and names without case, accents or separators. */
export function mapSearchKey(value: string) {
  return value
    .toUpperCase()
    .replace(/Ł/g, "L")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9]/g, "");
}

/** Exact identifiers win; ambiguous descriptive names return a choice instead of an arbitrary object. */
export function findMapObjects(
  query: string,
  data: {
    airports: Airport[];
    points: Navpoint[];
    zones: AirspaceFeature[];
    aircraft: TrafficAircraft[];
  },
  aircraftAliases: string[] = [],
): MapSearchResult[] {
  const key = mapSearchKey(query);
  if (!key) return [];
  const candidates: { result: MapSearchResult; keys: string[] }[] = [];
  for (const airport of data.airports)
    candidates.push({
      result: {
        kind: "point",
        label: `${airport.ident} · ${airport.name}`,
        point: { ...airport, kind: "airport" },
      },
      keys: [airport.ident, ...airport.aliases, airport.name],
    });
  for (const point of data.points)
    candidates.push({
      result: {
        kind: "point",
        label: `${point.aliases[0] ?? point.ident} · ${point.name}`,
        point,
      },
      keys: [
        point.ident,
        ...point.aliases,
        point.name,
        ...(point.airport && point.kind === "runway-threshold"
          ? [`${point.ident}/${point.airport}`]
          : []),
      ],
    });
  for (const zone of data.zones)
    candidates.push({
      result: { kind: "airspace", label: zone.properties.name, zone },
      keys: [
        zone.properties.name,
        airspaceCaption(zone.properties.name, zone.properties.class).title,
        ...zone.properties.activations.map((a) => a.designator),
      ],
    });
  for (const aircraft of data.aircraft) {
    const keys = [
      aircraft.callsign ?? "",
      aircraft.registration ?? "",
      aircraft.hex,
    ];
    if (
      aircraftAliases.some((alias) =>
        keys.some((id) => mapSearchKey(id) === mapSearchKey(alias)),
      )
    )
      keys.push(query);
    candidates.push({
      result: {
        kind: "traffic",
        label: [aircraft.callsign, aircraft.registration, aircraft.hex]
          .filter(Boolean)
          .join(" · "),
        aircraft,
      },
      keys,
    });
  }
  const exact = candidates.filter((c) =>
    c.keys.some((id) => mapSearchKey(id) === key),
  );
  return (
    exact.length
      ? exact
      : candidates.filter((c) =>
          c.keys.some((id) => mapSearchKey(id).includes(key)),
        )
  ).map((c) => c.result);
}
