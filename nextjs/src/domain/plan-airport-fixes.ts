import { type Navpoint, type Procedure } from "~/data/schemas";

/** Airport terminal fixes are scoped to plan endpoints; ordinary VFR/en-route points stay global. */
export function planAirportFixes(
  points: Navpoint[],
  procedures: Procedure[],
  airportCodes: string[],
  selectedAirports: (string | null | undefined)[],
) {
  const normalize = (value: string) => value.trim().toUpperCase();
  const airportSet = new Set(airportCodes.map(normalize));
  const active = new Set(
    selectedAirports.filter((code): code is string => !!code).map(normalize),
  );
  const owners = new Map<string, Set<string>>();
  for (const procedure of procedures) {
    if (procedure.type !== "SID" && procedure.type !== "STAR") continue;
    for (const leg of procedure.legs) {
      const key = normalize(leg.ident),
        airports = owners.get(key) ?? new Set<string>();
      airports.add(normalize(procedure.airport));
      owners.set(key, airports);
    }
  }
  const terminalOwners = new Map<string, string[]>();
  for (const code of airportCodes)
    if (/^[A-Z]{4}$/.test(normalize(code))) {
      const prefix = normalize(code).slice(2);
      terminalOwners.set(prefix, [
        ...(terminalOwners.get(prefix) ?? []),
        normalize(code),
      ]);
    }
  const visible = points.filter((point) => {
    if (point.kind === "navaid") return true;
    const id = normalize(point.ident);
    if (point.kind === "runway-threshold") {
      const airport = point.airport ?? /\/([A-Z]{4})$/i.exec(point.name)?.[1];
      return !!airport && active.has(normalize(airport));
    }
    // Phonetic VFR reporting points are not terminal procedure fixes.
    if (point.kind === "vfr-reporting-point" && point.airport) return true;
    // An airway fix is shared en-route infrastructure, even when a SID/STAR joins there.
    if (point.airways.length > 0) return true;
    const published = owners.get(id);
    if (published) return [...published].some((airport) => active.has(airport));
    const prefix = /^([A-Z]{2})\d{3,4}[A-Z]?$/.exec(id)?.[1];
    const airports = prefix ? terminalOwners.get(prefix) : undefined;
    if (airports) return airports.some((airport) => active.has(airport));
    return !point.airport || active.has(normalize(point.airport));
  });
  const seen = new Set(visible.map((point) => normalize(point.ident)));
  for (const procedure of procedures) {
    if (
      !active.has(normalize(procedure.airport)) ||
      (procedure.type !== "SID" && procedure.type !== "STAR")
    )
      continue;
    for (const leg of procedure.legs) {
      const id = normalize(leg.ident);
      if (
        airportSet.has(id) ||
        seen.has(id) ||
        leg.lat === null ||
        leg.lon === null
      )
        continue;
      seen.add(id);
      visible.push({
        ident: id,
        aliases: [],
        name: id,
        kind: "ifr-waypoint",
        lat: leg.lat,
        lon: leg.lon,
        airport: normalize(procedure.airport),
        description: procedure.designator,
        airways: [],
        navaid: null,
        source: procedure.source,
      });
    }
  }
  return visible;
}
