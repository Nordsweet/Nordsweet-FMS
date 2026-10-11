/**
 * Converts the legacy `window.*` data scripts in public/ into validated JSON datasets
 * in public/data/. Run with `pnpm data:import`. Delete together with the legacy files.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

import {
  type Airport,
  type AirportType,
  type DatasetName,
  datasetSchemas,
  type Frequency,
  type Navpoint,
  type Runway,
} from "../src/data/schemas";

import { importAircraft } from "./legacy-aircraft";

const publicDir = path.resolve(import.meta.dirname, "../public");
const outDir = path.join(publicDir, "data");

type Legacy = Record<string, any>;

function loadLegacy(files: string[]): Legacy {
  const window: Legacy = {};
  window.window = window;
  const context = vm.createContext({ window });
  for (const file of files)
    vm.runInContext(
      fs.readFileSync(path.join(publicDir, file), "utf8"),
      context,
    );
  return window;
}

const text = (value: unknown) => {
  const s = typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
  return s || null;
};
const positive = (value: unknown) => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
};
const fold = (s: string) =>
  s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim();

const airportTypeByStatus: Record<string, AirportType> = {
  lotnisko: "aerodrome",
  "lotnisko zarejestrowane": "aerodrome",
  "lotnisko kontrolowane": "controlled",
  "lotnisko wojskowe": "military",
  ladowisko: "airstrip",
  "ladowisko zarejestrowane": "airstrip",
  "ladowisko trudne": "airstrip-difficult",
  "ladowisko niepotwierdzone": "airstrip-unconfirmed",
  "drogowy odcinek lotniskowy": "road-strip",
};

function airportType(raw: Legacy): AirportType {
  // Some records have an empty status but start their CUP description with it.
  const declared = String(raw.status ?? "").trim();
  const described = String(raw.sourceDescription ?? "").split(";")[0] ?? "";
  const status = fold(declared === "" ? described : declared);
  const type = airportTypeByStatus[status];
  if (!type)
    throw new Error(`${raw.icao}: unknown airport status "${raw.status}"`);
  return type;
}

function runway(raw: Legacy): Runway {
  const surface = ["asphalt", "concrete", "paved", "grass"].includes(
    raw.surface,
  )
    ? (raw.surface as Runway["surface"])
    : "unknown";
  const threshold = raw.threshold as Legacy | undefined;
  return {
    designator: String(raw.id),
    trueHeadingDeg: Number(raw.trueHdg ?? raw.hdg),
    surface,
    lengthM: positive(raw.length_m),
    widthM: positive(raw.width_m),
    slopePct: Number(raw.slope) || 0,
    toraM: positive(raw.tora),
    todaM: positive(raw.toda),
    asdaM: positive(raw.asda),
    ldaM: positive(raw.lda),
    threshold:
      threshold && Number.isFinite(threshold.lat)
        ? {
            lat: threshold.lat,
            lon: threshold.lon,
            elevationFt: Number(threshold.elevation),
          }
        : null,
  };
}

function importAirports(): Airport[] {
  const legacy = loadLegacy(["airports.js", "airports-cz-sk.js"]);
  return (legacy.TECNAM_DATA.airports as Legacy[])
    .filter((raw) => raw.icao !== "EPXX") // "Test Airport" fixture shipped in the legacy data
    .map((raw) => ({
      ident: String(raw.icao),
      aliases: [],
      isIcao: Boolean(raw.isIcao),
      name: String(raw.name).trim(),
      country: String(raw.country),
      type: airportType(raw),
      lat: raw.lat,
      lon: raw.lon,
      elevationFt: Number(raw.elevation) || 0,
      runways: ((raw.runways ?? []) as Legacy[]).map(runway),
      weatherStation: text(raw.weatherSourceIcao),
      contact: text(raw.contact),
      links: ((raw.links ?? []) as unknown[]).map(String),
      remarks: text(
        Array.isArray(raw.remarks) ? raw.remarks.join("; ") : raw.remarks,
      ),
      source: String(raw.source ?? "unknown"),
    }));
}

function airways(routes: unknown): string[] {
  const list = Array.isArray(routes)
    ? routes
    : typeof routes === "string"
      ? routes.split(/[\s,;]+/)
      : routes && typeof routes === "object"
        ? Object.values(routes)
        : [];
  return [
    ...new Set(
      list.filter((r): r is string => typeof r === "string" && r.trim() !== ""),
    ),
  ];
}

/** Within ~1 km: the legacy waypoint and airport records describe the same field. */
function findAirportAt(airports: Airport[], lat: number, lon: number) {
  return airports.find(
    (a) =>
      Math.hypot(a.lat - lat, (a.lon - lon) * Math.cos((lat * Math.PI) / 180)) <
      0.01,
  );
}

function importNavpoints(airports: Airport[]): Navpoint[] {
  const airportIdents = new Set(airports.map((a) => a.ident));
  const legacy = loadLegacy(["navdata.js", "Waypoints/Poland.js"]);
  const points: Navpoint[] = [];

  for (const raw of Object.values<Legacy>(legacy.NORDSWEET_NAVDATA.waypoints)) {
    points.push({
      ident: raw.id,
      aliases: [],
      name: raw.name,
      kind: "ifr-waypoint",
      lat: raw.lat,
      lon: raw.lon,
      airport: null,
      description: null,
      airways: airways(raw.routes),
      navaid: null,
      source: raw.source,
    });
  }

  let aliased = 0;
  for (const raw of Object.values<Legacy>(
    legacy.NORDSWEET_PRIVATE_WAYPOINTS.POLAND.waypoints,
  )) {
    const cupKind = raw.cup?.kind as string | undefined;
    const isAirfield = cupKind === "airfield" || cupKind === "landing-site";
    if (isAirfield && airportIdents.has(raw.id)) continue;
    const airport = isAirfield
      ? findAirportAt(airports, raw.lat, raw.lon)
      : undefined;
    if (airport) {
      airport.aliases.push(raw.id);
      aliased++;
      continue;
    }
    const navaid = raw.navaid as Legacy | null;
    const threshold = raw.runwayThreshold as Legacy | null;
    const kind: Navpoint["kind"] | null = isAirfield
      ? "airfield"
      : navaid
        ? "navaid"
        : threshold
          ? "runway-threshold"
          : raw.rules === "IFR"
            ? "ifr-waypoint"
            : null; // VFR reporting points come from the Aviation API (`places`).
    if (!kind) continue;
    points.push({
      ident: raw.id,
      aliases: [],
      name: navaid?.name ?? raw.cup?.name ?? raw.name,
      kind,
      lat: raw.lat,
      lon: raw.lon,
      airport: text(threshold?.airport) ?? text(raw.group),
      description: text(raw.note),
      airways: airways(raw.routes),
      navaid: navaid
        ? {
            type: navaid.type,
            frequency: text(navaid.frequency),
            channel: text(navaid.channel),
          }
        : null,
      source: raw.source,
    });
  }

  const unique = new Map<string, Navpoint>();
  for (const point of points) {
    const key = `${point.kind}|${point.ident}|${point.airport ?? ""}`;
    if (!unique.has(key)) unique.set(key, point);
  }
  console.log(`navpoints: ${aliased} airfield codes became airport aliases`);
  return [...unique.values()];
}

function importFrequencies(): Frequency[] {
  const legacy = loadLegacy(["airport-frequencies-data.js"]);
  return (legacy.NORDSWEET_FREQUENCIES.entries as Legacy[]).map((raw) => ({
    airport: raw.airportIcao,
    service: raw.serviceId,
    frequencyMhz: raw.frequencyMhz,
    callsign: String(raw.callsign ?? "").trim(),
    sector: text(raw.sector),
    notes: text(raw.notes),
    primary: raw.priority === "primary",
  }));
}

function write(name: DatasetName, rows: unknown[]) {
  const data = datasetSchemas[name].parse(rows);
  const json = JSON.stringify(data);
  fs.writeFileSync(path.join(outDir, `${name}.json`), json + "\n");
  console.log(
    `${name}: ${data.length} records, ${(json.length / 1024).toFixed(0)} KiB`,
  );
  return crypto.createHash("sha256").update(json).digest("hex");
}

fs.mkdirSync(outDir, { recursive: true });
const airports = importAirports();
const byIdent = (a: { ident: string }, b: { ident: string }) =>
  a.ident.localeCompare(b.ident);
const navpoints = importNavpoints(airports);
const hashes = [
  write(
    "aircraft",
    importAircraft(
      publicDir,
      fs.readFileSync(
        path.resolve(import.meta.dirname, "../src/runtime/index.js"),
        "utf8",
      ),
    ),
  ),
  write("airports", airports.sort(byIdent)),
  write("navpoints", navpoints.sort(byIdent)),
  write(
    "frequencies",
    importFrequencies().sort((a, b) =>
      byIdent({ ident: a.airport }, { ident: b.airport }),
    ),
  ),
];
const version = crypto
  .createHash("sha256")
  .update(hashes.join())
  .digest("hex")
  .slice(0, 12);
fs.writeFileSync(
  path.join(outDir, "manifest.json"),
  JSON.stringify({ version }, null, 2) + "\n",
);
console.log(`manifest: version ${version}`);
