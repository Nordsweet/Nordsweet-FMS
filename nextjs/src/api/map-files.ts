import { get, set } from "idb-keyval";
import { z } from "zod";
import {
  airspaceFeatureSchema,
  type AirspaceFeature,
  airspaceServiceSchema,
} from "./aviation/schemas";
import { parseOpenAir } from "~/domain/openair";
import { type FlightPoint } from "~/data/flight";
import { destinationPoint } from "~/domain/geo";
import { readGpx } from "~/domain/gpx";

const pointSchema = z.object({
  ident: z.string().min(1),
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
});
/** Every track, route and waypoint becomes a plan point; one invalid point rejects the file. */
export function parseGpx(text: string): FlightPoint[] {
  const points = readGpx(text).map((p, index) =>
    pointSchema.parse({
      ident: p.name || `GPX ${index + 1}`,
      lat: p.lat,
      lon: p.lon,
    }),
  );
  if (!points.length) throw new Error("Empty GPX");
  return points;
}

export function parseMapAirspace(text: string): AirspaceFeature[] {
  if (/^\s*[\[{]/.test(text)) {
    const schema = z.union([
      z.array(airspaceFeatureSchema),
      z.object({ features: z.array(airspaceFeatureSchema) }),
    ]);
    const raw: unknown = JSON.parse(text);
    const parsed = schema.safeParse(raw);
    if (parsed.success)
      return Array.isArray(parsed.data) ? parsed.data : parsed.data.features;
    const coordinate = z.object({
      lat: z.number().min(-90).max(90),
      lon: z.number().min(-180).max(180),
    });
    const zoneSchema = z.object({
      name: z.string(),
      classType: z.string().default("OTHER"),
      lower: z.string().default("GND"),
      upper: z.string().default("UNL"),
      points: z.array(coordinate).default([]),
      circle: z
        .object({ center: coordinate, radiusNm: z.number().positive() })
        .nullable()
        .optional(),
      frequencies: z
        .array(
          z.union([
            airspaceServiceSchema,
            z
              .string()
              .transform((frequencyMhz) =>
                airspaceServiceSchema.parse({ frequencyMhz }),
              ),
          ]),
        )
        .default([]),
    });
    const list = z
      .union([
        z.array(zoneSchema),
        z.object({ zones: z.array(zoneSchema) }),
        z.object({ items: z.array(zoneSchema) }),
        z.object({ airspaces: z.array(zoneSchema) }),
      ])
      .parse(raw);
    const items = Array.isArray(list)
      ? list
      : "zones" in list
        ? list.zones
        : "items" in list
          ? list.items
          : list.airspaces;
    return items.map((zone) => {
      const points = zone.circle
        ? Array.from({ length: 73 }, (_, i) =>
            destinationPoint(zone.circle!.center, i * 5, zone.circle!.radiusNm),
          )
        : zone.points;
      if (points.length < 3) throw new Error("Invalid polygon");
      const ring: [number, number][] = points.map((p) => [p.lon, p.lat]);
      if (ring.at(-1)![0] !== ring[0]![0] || ring.at(-1)![1] !== ring[0]![1])
        ring.push(ring[0]!);
      return {
        type: "Feature",
        bbox: [
          Math.min(...points.map((p) => p.lon)),
          Math.min(...points.map((p) => p.lat)),
          Math.max(...points.map((p) => p.lon)),
          Math.max(...points.map((p) => p.lat)),
        ],
        geometry: { type: "Polygon", coordinates: [ring] },
        properties: {
          name: zone.name,
          class: zone.classType,
          lower: zone.lower,
          upper: zone.upper,
          activations: [],
          active_now: null,
          frequencies: zone.frequencies,
        },
      };
    });
  }
  return parseOpenAir(text).map((zone) => {
    const xs = zone.ring.map((p) => p[0]),
      ys = zone.ring.map((p) => p[1]);
    return {
      type: "Feature",
      bbox: [
        Math.min(...xs),
        Math.min(...ys),
        Math.max(...xs),
        Math.max(...ys),
      ],
      geometry: { type: "Polygon", coordinates: [zone.ring] },
      properties: {
        name: zone.name,
        class: zone.class,
        lower: zone.lower,
        upper: zone.upper,
        activations: [],
        active_now: null,
        frequencies: [],
      },
    };
  });
}
const KEY = "nordsweet.map.imported-zones.v1";
export async function loadMapAirspace() {
  const value: unknown = await get(KEY);
  return z.array(airspaceFeatureSchema).catch([]).parse(value);
}
export async function saveMapAirspace(zones: AirspaceFeature[]) {
  const parsed = z.array(airspaceFeatureSchema).parse(zones);
  await set(KEY, parsed);
  return parsed;
}
