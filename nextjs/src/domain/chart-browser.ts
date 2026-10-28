import {
  type AipCatalog,
  type BrowserChart,
  type ChartCategory,
  type ChartLibrary,
  type ChartOverlay,
} from "~/data/charts";
import { type Airport, type Chart, type Procedure } from "~/data/schemas";

/** PANSA adds missing fields to the airport picker without replacing curated airport performance data. */
export function chartAirports(
  known: Airport[],
  catalog: AipCatalog,
): Airport[] {
  const byCode = new Map(known.map((a) => [a.ident, a]));
  for (const a of catalog.airports)
    if (!byCode.has(a.icao))
      byCode.set(a.icao, {
        ident: a.icao,
        name: a.name,
        aliases: [],
        isIcao: true,
        country: "PL",
        type: a.volume === "MIL" ? "military" : "aerodrome",
        lat: a.lat,
        lon: a.lon,
        elevationFt: 0,
        runways: [],
        weatherStation: null,
        contact: null,
        links: [a.source_url],
        remarks:
          "AIP: airport reference position only; consult airport information for elevation and runways.",
        source: "pansa.aip",
      });
  return [...byCode.values()].sort((a, b) => a.ident.localeCompare(b.ident));
}

function libraryPath(src: string) {
  try {
    const path = decodeURIComponent(
      src.replace(/^\.\/charts\//, "").replace(/^\/charts\//, ""),
    );
    return path &&
      !path.includes("..") &&
      !path.includes("\\") &&
      !path.startsWith("/")
      ? path
      : null;
  } catch {
    return null;
  }
}

/** Keep each official sheet, editor-owned PDFs, and runway-grouped NordCharts independently selectable. */
export function browserCharts(
  catalog: AipCatalog | undefined,
  library: ChartLibrary | undefined,
  bundled: Chart[],
  procedures: Procedure[],
): BrowserChart[] {
  const charts: BrowserChart[] = (catalog?.charts ?? []).map((c) => ({
    id: c.id,
    airport: c.airport,
    title: c.title,
    category: c.category,
    source: "aip",
    volume: c.volume,
    sourceUrl: c.source_url,
    effectiveFrom: c.effective_from,
    effectiveUntil: c.effective_until,
    pdf: { kind: "aip", id: c.id, sha256: c.sha256 },
  }));
  const seen = new Set<string>();
  for (const [airport, ground] of Object.entries(library?.ground ?? {})) {
    const overlay = ground.chartOverlay;
    const path = overlay?.chart && libraryPath(overlay.chart.src);
    if (!path) continue;
    seen.add(path);
    charts.push({
      id: `library:${path}`,
      airport,
      title: overlay?.chart?.title ?? path,
      source: "library",
      category: "aerodrome",
      pdf: { kind: "library", path, revision: library?.revisions[path] ?? 0 },
      overlay,
    });
  }
  for (const c of library?.charts ?? []) {
    if (seen.has(c.path)) continue;
    const airport = /\b(?:EP|LZ)[A-Z0-9]{2}\b/.exec(c.path)?.[0];
    if (!airport) continue;
    seen.add(c.path);
    charts.push({
      id: `library:${c.path}`,
      airport,
      title: c.path.split("/").at(-1) ?? c.path,
      source: "library",
      category: "other",
      pdf: { kind: "library", path: c.path, revision: c.revision },
    });
  }
  for (const c of bundled) {
    const path = libraryPath(c.src);
    if (!path || seen.has(path)) continue;
    seen.add(path);
    charts.push({
      id: `bundled:${path}`,
      airport: c.airport,
      title: c.title,
      source: "library",
      category: "other",
      pdf: { kind: "bundled", src: c.src },
    });
  }
  const groups = new Map<string, Procedure[]>();
  for (const p of procedures)
    for (const runway of p.runways.length ? p.runways : ["—"]) {
      const key = `${p.airport}:${p.type}:${runway}`;
      groups.set(key, [...(groups.get(key) ?? []), p]);
    }
  for (const [key, ps] of groups) {
    const p = ps[0]!;
    const runway = key.split(":").at(-1)!;
    charts.push({
      id: `nord:${key}`,
      airport: p.airport,
      title: `${p.type} RWY ${runway} — ${ps.map((p) => p.designator).join(", ")}`,
      category: p.type === "SID" ? "sid" : "star",
      source: "nord",
      procedureIds: ps.map((p) => p.id),
      runway,
    });
  }
  return charts;
}

/** Seven legacy flight stages, with real chart categories rather than ambiguous AD page numbers. */
export const chartSequence: {
  scope: "departure" | "arrival";
  category: ChartCategory;
}[] = [
  { scope: "departure", category: "parking" },
  { scope: "departure", category: "aerodrome" },
  { scope: "departure", category: "sid" },
  { scope: "arrival", category: "star" },
  { scope: "arrival", category: "approach" },
  { scope: "arrival", category: "aerodrome" },
  { scope: "arrival", category: "parking" },
];

/** Draw only calibrated geometry. A missing intersection must not become an invented straight taxi clearance. */
export function chartTaxiPaths(
  overlay: ChartOverlay,
  route: string[],
): { x: number; y: number }[][] {
  const paths: { x: number; y: number }[][] = [];
  let current: { x: number; y: number }[] = [];
  const finish = () => {
    if (current.length > 1) paths.push(current);
    current = [];
  };
  for (let i = 0; i < route.length; i++) {
    const id = route[i]!;
    const calibrated = overlay.taxiwayPaths[id];
    if (calibrated?.length) {
      const previous = current.at(-1);
      const distance = (p: { x: number; y: number }) =>
        previous ? Math.hypot(previous.x - p.x, previous.y - p.y) : 0;
      const points =
        previous && distance(calibrated.at(-1)!) < distance(calibrated[0]!)
          ? [...calibrated].reverse()
          : calibrated;
      current.push(...points);
    } else {
      const candidates = overlay.intersections.filter((p) =>
        p.members.includes(id),
      );
      const next = route[i + 1];
      const shared = candidates.find((p) => next && p.members.includes(next));
      if (shared) current.push(shared);
      else if (candidates.length === 1) current.push(candidates[0]!);
      else finish();
    }
  }
  finish();
  return paths;
}
