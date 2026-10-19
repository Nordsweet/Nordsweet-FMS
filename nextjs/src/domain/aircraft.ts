import { type Aircraft } from "~/data/aircraft";

export type FuelIndicationMode = "exact" | "estimated";

/** "SP-abc " → "SPABC", as the legacy planner keys registrations. */
export const normalizeRegistration = (value: string) =>
  value.toUpperCase().replace(/[^A-Z0-9]+/g, "");

/** One entry per type (the default profiles), in the legacy order. */
export const aircraftTypes = (list: readonly Aircraft[]) =>
  list.filter((a) => a.registration === null).sort((a, b) => a.order - b.order);

/** The registration's own profile when there is one, else the type's default profile. */
export function resolveAircraft(
  list: readonly Aircraft[],
  type: string,
  registration: string,
): Aircraft | null {
  const reg = normalizeRegistration(registration);
  const own = reg
    ? list.find((a) => a.type === type && a.registration === reg)
    : undefined;
  return (
    own ?? list.find((a) => a.type === type && a.registration === null) ?? null
  );
}

/** "P2006T (P06T)" as in the legacy type list. */
export const aircraftLabel = (a: Pick<Aircraft, "type" | "icaoType">) =>
  `${a.type} (${a.icaoType})`;

/** Exact airframe profiles and remembered choices take precedence over generic database types. */
export function aircraftForRegistration(
  list: readonly Aircraft[],
  registration: string,
  remembered: readonly string[] = [],
  identity?: { icaoType: string | null; model?: string | null } | null,
): Aircraft | null {
  const reg = normalizeRegistration(registration);
  if (!reg) return null;
  const own = list.find(
    (a) => a.registration && normalizeRegistration(a.registration) === reg,
  );
  if (own) return own;
  for (const type of remembered) {
    const saved = resolveAircraft(list, type, reg);
    if (saved) return saved;
  }
  const candidates = aircraftTypes(list).filter(
    (a) => a.icaoType === identity?.icaoType,
  );
  const model = identity?.model?.toUpperCase().replace(/[^A-Z0-9]/g, "") ?? "";
  const matches = candidates.filter((a) => {
    const designation = a.type.replace(/[^A-Z0-9]/g, "");
    return (
      model.includes(designation) ||
      (/^C\d/.test(designation) && model.includes(designation.slice(1)))
    );
  });
  const longest = Math.max(0, ...matches.map((a) => a.type.length));
  const exact = matches.filter((a) => a.type.length === longest);
  if (exact.length === 1) return exact[0]!;
  // C172 is shared by several variants; do not assign performance from a guessed subtype.
  return (
    candidates.find((a) => a.type === identity?.icaoType) ??
    (candidates.length === 1 ? candidates[0]! : null)
  );
}

/** The legacy planner's default: these aircraft have a fuel flowmeter / exact gauges. */
export function defaultFuelIndicationMode(
  type: string,
  registration: string,
): FuelIndicationMode {
  const reg = normalizeRegistration(registration);
  if (type === "P2006T" || type === "SD-4") return "exact";
  if (type === "R172K" && reg === "OEKMT") return "exact";
  if (type === "A-1A HUSKY" && reg === "SPOKO") return "exact";
  return "estimated";
}

export type PerformanceStatus = "available" | "partial" | "none";

export function performanceStatus(a: Aircraft): PerformanceStatus {
  const tables = [a.takeoff, a.landing, a.climb, a.cruise];
  const loaded = tables.filter((t) => t !== null).length;
  return loaded === tables.length ? "available" : loaded ? "partial" : "none";
}

/** Engine hours as the legacy "00000.00"; null when the input is not a number. */
export function formatMth(value: string): string | null {
  const hours = Number(value.trim().replace(",", "."));
  if (value.trim() === "" || !Number.isFinite(hours)) return null;
  const [whole, fraction] = Math.min(99999.99, Math.max(0, hours))
    .toFixed(2)
    .split(".");
  return `${whole!.padStart(5, "0")}.${fraction}`;
}
