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
