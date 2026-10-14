import { z } from "zod";
import { routeExport } from "~/domain/route-export";
import { createStore, del, entries, get, set } from "idb-keyval";

import { type Flight, flightSchema, newFlight } from "~/data/flight";
import { parseNordFile, toNordFile, legacyAircraftId } from "~/data/nord";

import { findAirport } from "./search";
import { loadAircraft } from "./aircraft";
import { loadDataset } from "./datasets";

// shortcut: one IndexedDB store on this device; replace with a sync queue once the backend exists.
const store =
  typeof indexedDB === "undefined"
    ? undefined
    : createStore("nordsweet-flights", "flights");
const MIGRATED_KEY = "legacy-saved-routes-imported";

/** Imports the legacy planner's saved routes (localStorage) once. */
async function migrateLegacy() {
  if (await get(MIGRATED_KEY, store)) return;
  const [profiles, airports] = await Promise.all([
    loadAircraft(),
    loadDataset("airports"),
  ]);
  const known = profiles.map((a) => a.id);
  let routes: unknown[] = [];
  try {
    routes = JSON.parse(
      localStorage.getItem("nordsweet.savedRoutes.v1") ?? "[]",
    ) as unknown[];
  } catch {
    // unreadable legacy data: nothing to import
  }
  for (const route of Array.isArray(routes) ? routes : []) {
    try {
      const { flight, alternateCode } = parseNordFile(
        JSON.stringify({ format: "nordsweet.flight", version: 1, route }),
        known,
      );
      const alternate = alternateCode
        ? findAirport(airports, alternateCode)
        : undefined;
      await set(
        flight.id,
        {
          ...flight,
          alternate:
            flight.alternate ??
            (alternate
              ? {
                  ident: alternate.ident,
                  lat: alternate.lat,
                  lon: alternate.lon,
                }
              : null),
        },
        store,
      );
    } catch {
      // skip routes without coordinates
    }
  }
  await set(MIGRATED_KEY, true, store);
}

export async function listFlights(): Promise<Flight[]> {
  await migrateLegacy();
  return (await entries(store))
    .filter(([key]) => key !== MIGRATED_KEY)
    .map(([, value]) => flightSchema.safeParse(value))
    .filter((r) => r.success)
    .map((r) => r.data)
    .sort((a, b) => b.savedAt.localeCompare(a.savedAt));
}

export async function saveFlight(flight: Flight) {
  const saved = flightSchema.parse({
    ...flight,
    savedAt: new Date().toISOString(),
  });
  await set(saved.id, saved, store);
  return saved;
}

/** Renaming does not alter the snapshot date or its ordering in the library. */
export async function renameFlight({ id, name }: { id: string; name: string }) {
  const flight = flightSchema.parse(await get(id, store));
  const renamed = flightSchema.parse({ ...flight, name: name.trim() });
  await set(id, renamed, store);
  return renamed;
}

export async function removeFlight(id: string) {
  await del(id, store);
}

/** Parse uploaded files at the data boundary, including the legacy code-only alternate. */
export async function importFlight({
  text,
  fileName,
}: {
  text: string;
  fileName: string;
}) {
  const [aircraft, airports] = await Promise.all([
    loadAircraft(),
    loadDataset("airports"),
  ]);
  const { flight, alternateCode } = parseNordFile(
    text,
    aircraft.map((a) => a.id),
  );
  const alternate = alternateCode
    ? findAirport(airports, alternateCode)
    : undefined;
  const imported = flightSchema.parse({
    ...flight,
    id: crypto.randomUUID(),
    name:
      flight.name.trim() === ""
        ? fileName.replace(/\.nord$/i, "")
        : flight.name,
    alternate:
      flight.alternate ??
      (alternate
        ? { ident: alternate.ident, lat: alternate.lat, lon: alternate.lon }
        : null),
  });
  await set(imported.id, imported, store);
  return imported;
}

export async function exportFlight(
  flight: Flight,
  points?: Parameters<typeof toNordFile>[2],
) {
  const validated = flightSchema.parse(flight);
  const aircraft = (await loadAircraft()).find(
    (a) => a.id === validated.aircraftId,
  );
  const date = new Date(validated.savedAt);
  const stamp = [
    date.getDate(),
    date.getMonth() + 1,
    date.getFullYear() % 100,
    date.getHours(),
    date.getMinutes(),
  ]
    .map((n) => String(n).padStart(2, "0"))
    .join("");
  const prefix = (
    [validated.registration, aircraft?.type].find((value) => value?.trim()) ??
    "AIRCRAFT"
  )
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  return {
    fileName: `${prefix}${stamp}.nord`,
    text: toNordFile(validated, aircraft?.type ?? null, points),
  };
}

/** Legacy device draft only; a modern draft or a pilot edit always takes precedence. */
export async function legacyDraft(): Promise<Flight | null> {
  const keys = [
    "aircraftType",
    "aircraftRegistration",
    "lastRoute",
    "fuelPlanning",
    "weightBalance",
  ];
  if (!keys.some((key) => localStorage.getItem(`nordsweet.${key}.v1`)))
    return null;
  const [aircraft, airports] = await Promise.all([
    loadAircraft(),
    loadDataset("airports"),
  ]);
  const read = (key: string) =>
    localStorage.getItem(`nordsweet.${key}.v1`) ?? "";
  const object = (key: string): Record<string, unknown> => {
    try {
      const value: unknown = JSON.parse(read(key));
      return value && typeof value === "object" && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : {};
    } catch {
      return {};
    }
  };
  let flight = newFlight();
  const route = object("lastRoute");
  try {
    const imported = parseNordFile(
      JSON.stringify({ format: "nordsweet.flight", version: 1, route }),
      aircraft.map((a) => a.id),
    );
    flight = imported.flight;
  } catch {
    // Older drafts have only airport codes, not a calculated plan.
    for (const [field, code] of [
      ["departure", route.departureIcao],
      ["destination", route.destinationIcao],
      ["alternate", route.alternateIcao],
    ] as const) {
      const airport =
        typeof code === "string" ? findAirport(airports, code) : undefined;
      if (airport)
        flight[field] = {
          ident: airport.ident,
          lat: airport.lat,
          lon: airport.lon,
        };
    }
    const points = [flight.departure, flight.destination]
      .filter((p) => p !== null)
      .map((p) => ({ id: p.ident, lat: p.lat, lon: p.lon }));
    if (points.length) {
      try {
        flight = parseNordFile(
          JSON.stringify({
            format: "nordsweet.flight",
            version: 1,
            route: { ...route, plan: { points } },
          }),
          aircraft.map((a) => a.id),
        ).flight;
      } catch {
        /* Retain resolved airport endpoints if other legacy fields are corrupt. */
      }
    }
  }
  const registration = read("aircraftRegistration").trim();
  const id = legacyAircraftId(
    read("aircraftType"),
    registration,
    aircraft.map((a) => a.id),
  );
  flight.aircraftId = id ?? flight.aircraftId;
  flight.registration =
    registration === "" ? flight.registration : registration;
  const profile = aircraft.find((a) => a.id === flight.aircraftId);
  const wb = object("weightBalance");
  const massKeys: Record<string, string> = {
    pilot: "pilotWeightKg",
    coPilot: "coPilotWeightKg",
    firstPassenger: "firstPassengerWeightKg",
    secondPassenger: "secondPassengerWeightKg",
    baggage: "baggageWeightKg",
  };
  const finite = (v: unknown) =>
    (typeof v === "number" || typeof v === "string") &&
    String(v).trim() &&
    Number.isFinite(Number(v)) &&
    Number(v) >= 0
      ? Number(v)
      : null;
  for (const station of profile?.weightBalance?.stations ?? []) {
    flight.stationsKg[station.id] =
      finite(wb[massKeys[station.id] ?? ""]) ??
      (station.id === "pilot"
        ? (finite(read("pilotWeightKg")) ??
          (station.defaultKg > 0 ? station.defaultKg : 85))
        : station.defaultKg);
  }
  flight.fuel.blockL =
    finite(wb.usableFuelLiters) ?? profile?.weightBalance?.fuel.defaultL ?? 0;
  const fuel = object("fuelPlanning");
  for (const key of [
    "plannedTrip",
    "startTaxi",
    "climb",
    "departureArrival",
    "alternate",
  ] as const) {
    const row = fuel[key];
    if (!row || typeof row !== "object") continue;
    const parsed = row as { fuelLiters?: unknown; time?: unknown };
    const match =
      typeof parsed.time === "string"
        ? /^(\d+):(\d{2})$/.exec(parsed.time)
        : null;
    const minutes =
      match && Number(match[2]) < 60
        ? Number(match[1]) * 60 + Number(match[2])
        : null;
    const fuelL = finite(parsed.fuelLiters);
    if (minutes !== null || fuelL !== null)
      flight.fuelOverrides[key] = { minutes, fuelL };
  }
  const alternate =
    typeof route.alternateIcao === "string"
      ? findAirport(airports, route.alternateIcao)
      : undefined;
  if (alternate)
    flight.alternate = {
      ident: alternate.ident,
      lat: alternate.lat,
      lon: alternate.lon,
    };
  return flightSchema.parse(flight);
}

const routeExportSchema = z.object({
  flight: flightSchema,
  format: z.enum(["gpx", "kml"]),
  points: z
    .array(
      z.object({
        ident: z.string().min(1),
        lat: z.number().min(-90).max(90),
        lon: z.number().min(-180).max(180),
        altitudeFt: z.number(),
      }),
    )
    .min(1),
});
export async function exportRoute(input: z.infer<typeof routeExportSchema>) {
  const { flight, format, points } = routeExportSchema.parse(input);
  const { fileName } = await exportFlight(flight);
  return {
    fileName: fileName.replace(/\.nord$/, `.${format}`),
    text: routeExport(flight.name, points, format),
  };
}

export async function exportFlightWithRoute(input: {
  flight: Flight;
  points: z.infer<typeof routeExportSchema>["points"];
}) {
  const parsed = routeExportSchema.parse({ ...input, format: "gpx" });
  return exportFlight(parsed.flight, parsed.points);
}
