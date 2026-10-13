import { type Airport, type Procedure, type Runway } from "~/data/schemas";

import { toRad } from "./angles";
import { distanceNm, initialBearingDeg } from "./geo";

/**
 * The legacy route planner (Route tab), ported rule for rule: free-text route tokens (DCT, airways,
 * SID/STAR/APPROACH, coordinates), procedure selection, runway thresholds, TOC/TOD from the
 * vertical profile, altitude at each point and waypoint WX winds.
 */

export type ProcedureType = Procedure["type"];
export type ProcedureLeg = Procedure["legs"][number];
/** null = none, "AUTO" = suggested for the runway in use, otherwise a procedure id. */
export type ProcedureSelection = string | null;

export type SurfaceWind = {
  /** null = variable or unknown. */
  directionDeg: number | null;
  speedKt: number;
};

export type WxRow = {
  altitudeFt: string;
  windDirection: string;
  windSpeed: string;
};
type ProfileWind = {
  altitudeFt: number;
  windDirection: number;
  windSpeed: number;
};
export type PlannerWind = {
  windDirection: number;
  windSpeed: number;
  variableWind?: boolean;
};

export type AltitudeRestriction = {
  label: string;
  minFt: number | null;
  maxFt: number | null;
  type: "exact" | "atOrAbove" | "atOrBelow";
};

export type ProcedureChoice = {
  key: string;
  type: ProcedureType;
  baseFix: string;
  procedures: Procedure[];
  selectedId: string;
};

export type RoutePoint = {
  /** Key for altitude/WX entries: ident, coordinate id, THRxx, TOC/TOD. */
  id: string;
  kind:
    | "airport"
    | "threshold"
    | "coordinate"
    | "waypoint"
    | "procedure"
    | "procedure-choice"
    | "user-waypoint"
    | "profile";
  lat: number;
  lon: number;
  /** Coordinates as typed (e.g. "492622N 0195727E"). */
  label?: string;
  airportIcao?: string;
  runwayId?: string;
  thresholdMissingCoordinates?: boolean;
  procedure?: Procedure;
  procedureType?: ProcedureType;
  procedureLeg?: ProcedureLeg;
  procedureChoice?: ProcedureChoice;
  isProfilePoint?: boolean;
  profileLabels?: string[];
  routeDistanceNm?: number;
};

export type RouteLeg = {
  /** Published magnetic track, else the rounded true great-circle bearing (as legacy). */
  bearingDeg: number;
  distanceNm: number;
  from: RoutePoint;
  to: RoutePoint;
};

export type RouteWarning =
  | { code: "airway-empty"; airway: string }
  | { code: "unknown-token"; token: string }
  | {
      code: "procedure-not-found";
      procedure: string;
      departure: string;
      destination: string;
    }
  | {
      code: "threshold-missing";
      role: "departure" | "destination";
      icao: string;
      runway: string;
    }
  | { code: "procedure-entry-missing"; procedure: string; fix: string }
  | { code: "procedure-leg-missing"; procedure: string; leg: string }
  | { code: "request-not-found"; request: string; airport: string }
  | { code: "request-select-variant"; request: string }
  | { code: "request-entry-missing"; request: string };

export type RouteData = {
  airport: (code: string) => Airport | null;
  /** Navdata point by legacy key (ident or alias). */
  point: (key: string) => { lat: number; lon: number } | null;
  procedures: (airport: string, type: ProcedureType) => Procedure[];
  airways: Record<string, string[]>;
};

export type RoutePlanInput = {
  departure: Airport | null;
  destination: Airport | null;
  alternate: Airport | null;
  altitudeFt: number;
  routeText: string;
  selections: Record<ProcedureType, ProcedureSelection>;
  /** Variant picked for "SID NAVUR"-style requests, keyed by choice key. */
  inlineSelections: Record<string, string>;
  /** Points added on the map, inserted into the nearest leg. */
  insertedWaypoints: { ident: string; lat: number; lon: number }[];
  waypointAltitudes: Record<string, number>;
  waypointWx: Record<string, WxRow[]>;
  /** Current conditions wind: route wind where no waypoint WX is entered. */
  conditionsWind: SurfaceWind | null;
  /** Wind used to pick the runway (and so the AUTO procedure) at an airport. */
  runwayWind: (airport: Airport) => SurfaceWind | null;
  climbGradientFtPerNm: number;
};

const DESCENT_GLIDE_RATIO = 13;
export const DESCENT_GRADIENT_FT_PER_NM = 6076.12 / DESCENT_GLIDE_RATIO;
/** Default when the aircraft has no usable climb table. */
export const FALLBACK_CLIMB_GRADIENT_FT_PER_NM = 450;
const PROFILE_EPSILON_NM = 0.25;
const MIN_GROUND_SPEED_KT = 30;

const clean = (value: string | null | undefined) => (value ?? "").trim();
export const normalizeProcedureId = (value: string | null | undefined) =>
  clean(value)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
export const pointKey = (point: Pick<RoutePoint, "id"> | null | undefined) =>
  clean(point?.id).toUpperCase();
const finite = (v: number | null | undefined): v is number =>
  typeof v === "number" && Number.isFinite(v);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

// ---------- waypoint references ----------

const waypointName = (v: string) =>
  clean(v)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 6);
const waypointGroup = (v: string) =>
  clean(v)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 4);
const isRunwayWaypointId = (id: string) =>
  /^RW\d{1,2}[LRC]?$/.test(waypointName(id));

function groupedKey(id: string, group: string) {
  if (!id) return "";
  if (!group) return id;
  if (isRunwayWaypointId(id)) return id + "/" + group;
  if (id.length === 5 && id.startsWith(group)) return id;
  return group + id.charAt(0);
}

function waypointReference(value: string) {
  const [first = "", second = ""] = clean(value).toUpperCase().split("/");
  const id = waypointName(first);
  const group = waypointGroup(second);
  return { id, group, key: groupedKey(id, group) };
}

// ---------- coordinates ----------

function canonicalCoordinate(value: string, axis: "lat" | "lon") {
  const token = clean(value)
    .toUpperCase()
    .replace(/[^0-9NSEW]/g, "");
  const suffix = token.match(
    axis === "lat" ? /^(\d{6})([NS])$/ : /^(\d{7})([EW])$/,
  );
  if (suffix) return suffix[1]! + suffix[2]!;
  const prefix = token.match(
    axis === "lat" ? /^([NS])(\d{6})$/ : /^([EW])(\d{7})$/,
  );
  if (prefix) return prefix[2]! + prefix[1]!;
  return token;
}

function compactDms(value: string, axis: "lat" | "lon") {
  const m = canonicalCoordinate(value, axis).match(
    axis === "lat"
      ? /^(\d{2})(\d{2})(\d{2})([NS])$/
      : /^(\d{3})(\d{2})(\d{2})([EW])$/,
  );
  if (!m) return null;
  const [deg, min, sec] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const max = axis === "lat" ? 90 : 180;
  if (
    deg > max ||
    min > 59 ||
    sec > 59 ||
    (deg === max && (min > 0 || sec > 0))
  )
    return null;
  const decimal = deg + min / 60 + sec / 3600;
  return m[4] === "S" || m[4] === "W" ? -decimal : decimal;
}

export function parseCoordinatePair(latToken: string, lonToken: string) {
  const latText = canonicalCoordinate(latToken, "lat");
  const lonText = canonicalCoordinate(lonToken, "lon");
  const lat = compactDms(latText, "lat");
  const lon = compactDms(lonText, "lon");
  if (lat === null || lon === null) return null;
  return { id: latText + lonText, label: latText + " " + lonText, lat, lon };
}

function coordinatePoint(token: string): RoutePoint | null {
  const m = /^COORD_(\d{6}[NS])(\d{7}[EW])$/.exec(token);
  const c = m ? parseCoordinatePair(m[1]!, m[2]!) : null;
  return c
    ? { id: c.id, kind: "coordinate", label: c.label, lat: c.lat, lon: c.lon }
    : null;
}

// ---------- tokens ----------

function procedureTypeFromKeyword(token: string): ProcedureType | "" {
  const t = normalizeProcedureId(token);
  if (t === "SID" || t === "SIDS") return "SID";
  if (t === "STAR" || t === "STARS") return "STAR";
  if (["APP", "APPS", "APPROACH", "APPROACHES"].includes(t)) return "APPROACH";
  return "";
}

const isProcedureDesignatorToken = (token: string) =>
  /^[A-Z]{2,6}\d{1,2}[A-Z]?$/.test(normalizeProcedureId(token));

const requestToken = (type: ProcedureType, baseFix: string) => {
  const fix = normalizeProcedureId(baseFix);
  return fix ? `PROC_${type}_${fix}` : "";
};

function parseRequestToken(token: string) {
  const m = /^PROC_(SID|STAR|APPROACH)_([A-Z0-9]+)$/.exec(token);
  return m ? { type: m[1] as ProcedureType, baseFix: m[2]! } : null;
}

/** Route text → tokens: coordinate pairs, "NAVUR 6J" → "NAVUR6J", "SID NAVUR" → a request. */
export function routeTokens(routeText: string) {
  const raw = routeText
    .toUpperCase()
    .replace(/[,:;]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  const tokens: string[] = [];
  for (let i = 0; i < raw.length; i++) {
    const [token, next = "", next2 = "", next3 = ""] = raw.slice(i, i + 4) as [
      string,
      ...string[],
    ];
    const coordinate = parseCoordinatePair(token, next);
    if (coordinate) {
      tokens.push("COORD_" + coordinate.id);
      i += 1;
      continue;
    }
    const keywordType = procedureTypeFromKeyword(token);
    if (keywordType) {
      if (/^[A-Z]{2,6}$/.test(next) && /^\d{1,2}[A-Z]?$/.test(next2)) {
        tokens.push(next + next2);
        i += 2;
      } else if (
        /^[A-Z]{3,6}$/.test(next) &&
        /^\d{1,2}$/.test(next2) &&
        /^[A-Z]$/.test(next3)
      ) {
        tokens.push(next + next2 + next3);
        i += 3;
      } else if (/^[A-Z]{3,6}$/.test(next)) {
        tokens.push(requestToken(keywordType, next));
        i += 1;
      }
      continue;
    }
    if (/^[A-Z]{2,6}$/.test(token) && /^\d{1,2}[A-Z]?$/.test(next)) {
      tokens.push(token + next);
      i += 1;
    } else if (
      /^[A-Z]{3,6}$/.test(token) &&
      /^\d{1,2}$/.test(next) &&
      /^[A-Z]$/.test(next2)
    ) {
      tokens.push(token + next + next2);
      i += 2;
    } else if (/^[A-Z]{3,6}$/.test(token) && procedureTypeFromKeyword(next)) {
      tokens.push(
        requestToken(procedureTypeFromKeyword(next) as ProcedureType, token),
      );
      i += 1;
    } else {
      tokens.push(token);
    }
  }
  return tokens;
}

// ---------- runways and procedures ----------

/** Legacy wind components: calm, variable or 000 wind gives no headwind. */
export function legacyHeadwindKt(
  headingDeg: number,
  wind: SurfaceWind | PlannerWind | null,
) {
  if (!wind) return 0;
  const speed = "speedKt" in wind ? wind.speedKt : wind.windSpeed;
  const direction = "speedKt" in wind ? wind.directionDeg : wind.windDirection;
  const variable = "variableWind" in wind && wind.variableWind;
  if (!speed || variable || !finite(direction) || direction === 0) return 0;
  return speed * Math.cos(toRad(direction - headingDeg));
}

/** Legacy runway in use: most headwind (then length) with a known wind, else the longest. */
export function bestRunway(
  airport: Airport,
  wind: SurfaceWind | null,
): Runway | null {
  const known = !!wind && finite(wind.directionDeg) && wind.directionDeg > 0;
  let best: Runway | null = null;
  let bestScore = -Infinity;
  for (const runway of airport.runways) {
    const length = runway.toraM ?? runway.lengthM ?? 0;
    const score = known
      ? legacyHeadwindKt(runway.trueHeadingDeg, wind) * 100 + length
      : length * 10 - Math.abs(runway.slopePct);
    if (score > bestScore) {
      bestScore = score;
      best = runway;
    }
  }
  return best ?? airport.runways[0] ?? null;
}

const matchesRunway = (p: Procedure, runwayId: string) =>
  !p.runways.length ||
  !runwayId ||
  p.runways.map((r) => r.toUpperCase()).includes(runwayId);

function scoreProcedure(p: Procedure, runwayId: string) {
  if (matchesRunway(p, runwayId)) return runwayId ? 40 : 5;
  return p.runways.length ? -25 : 0;
}

export const procedureLabel = (p: Procedure | null | undefined) =>
  p ? p.designator || p.id || "Procedure" : "None";
export const procedureRunwayLabel = (p: Procedure) =>
  p.runways.length ? "RWY " + p.runways.join("/") : "RWY any";

export function procedureBaseFix(p: Procedure) {
  const base = normalizeProcedureId(p.designator).replace(/\d{1,2}[A-Z]?$/, "");
  if (base) return base;
  const raw = normalizeProcedureId(p.id);
  const m = /(?:SID|STAR|APPROACH|APP)?_?([A-Z]{2,6})\d{1,2}[A-Z]?/.exec(raw);
  return m ? m[1]! : raw.replace(/\d{1,2}[A-Z]?$/, "");
}

function rankFor(procedures: Procedure[], runwayId: string) {
  return (
    [...procedures].sort(
      (a, b) =>
        scoreProcedure(b, runwayId) - scoreProcedure(a, runwayId) ||
        normalizeProcedureId(a.id).localeCompare(normalizeProcedureId(b.id)),
    )[0] ?? null
  );
}

export function createRouteContext(
  data: RouteData,
  input: Pick<RoutePlanInput, "runwayWind" | "inlineSelections">,
) {
  const runwayFor = (airport: Airport | null) =>
    airport ? bestRunway(airport, input.runwayWind(airport)) : null;
  const proceduresAt = (airport: Airport | null, type: ProcedureType) =>
    airport ? data.procedures(airport.ident, type) : [];
  const suggested = (airport: Airport | null, type: ProcedureType) =>
    rankFor(
      proceduresAt(airport, type),
      runwayFor(airport)?.designator.toUpperCase() ?? "",
    );
  const byId = (
    airport: Airport | null,
    type: ProcedureType,
    value: string,
  ) => {
    const v = normalizeProcedureId(value);
    return v
      ? (proceduresAt(airport, type).find(
          (p) =>
            normalizeProcedureId(p.id) === v ||
            normalizeProcedureId(p.designator) === v,
        ) ?? null)
      : null;
  };
  const selected = (
    airport: Airport | null,
    type: ProcedureType,
    selection: ProcedureSelection,
  ) =>
    !selection || selection === "NONE"
      ? null
      : selection === "AUTO"
        ? suggested(airport, type)
        : byId(airport, type, selection);

  function choice(
    airport: Airport | null,
    type: ProcedureType,
    baseFix: string,
  ) {
    const fix = normalizeProcedureId(baseFix);
    const procedures = proceduresAt(airport, type).filter(
      (p) => procedureBaseFix(p) === fix,
    );
    const key = [airport?.ident ?? "----", type, fix].join("|");
    const stored = normalizeProcedureId(input.inlineSelections[key]);
    const best = rankFor(
      procedures,
      runwayFor(airport)?.designator.toUpperCase() ?? "",
    );
    const pick =
      procedures.find((p) => normalizeProcedureId(p.id) === stored) ?? best;
    return {
      key,
      type,
      baseFix: fix,
      procedures,
      selected: pick,
      selectedId: pick ? normalizeProcedureId(pick.id) : "",
    };
  }

  function point(token: string): RoutePoint | null {
    const coordinate = coordinatePoint(token);
    if (coordinate) return coordinate;
    const ref = waypointReference(token);
    const normalized = ref.key || clean(token).toUpperCase();
    const airport = data.airport(normalized);
    if (airport) return airportPoint(airport);
    const waypoint =
      data.point(normalized) ?? (!ref.group ? data.point(ref.id) : null);
    if (waypoint)
      return {
        id: normalized,
        kind: "waypoint",
        lat: waypoint.lat,
        lon: waypoint.lon,
      };
    if (ref.group && isRunwayWaypointId(ref.id)) {
      const runwayAirport = data.airport(ref.group);
      const runway = runwayAirport?.runways.find(
        (r) => r.designator.toUpperCase() === ref.id.replace(/^RW/, ""),
      );
      if (runwayAirport && runway)
        return {
          ...thresholdPoint(runwayAirport, runway),
          id: ref.key,
          label: undefined,
        };
    }
    return null;
  }

  return { runwayFor, proceduresAt, suggested, byId, selected, choice, point };
}

type RouteContext = ReturnType<typeof createRouteContext>;

export const airportPoint = (airport: Airport): RoutePoint => ({
  id: airport.ident,
  kind: "airport",
  lat: airport.lat,
  lon: airport.lon,
});

function thresholdPoint(airport: Airport, runway: Runway | null): RoutePoint {
  if (!runway) return airportPoint(airport);
  const t = runway.threshold;
  const runwayId = runway.designator.toUpperCase();
  return {
    id: "THR" + runwayId,
    kind: "threshold",
    airportIcao: airport.ident,
    lat: t?.lat ?? airport.lat,
    lon: t?.lon ?? airport.lon,
    runwayId,
    thresholdMissingCoordinates: !t,
  };
}

const runwayForProcedure = (
  ctx: RouteContext,
  airport: Airport,
  procedure: Procedure,
) => {
  const current = ctx.runwayFor(airport);
  if (current && matchesRunway(procedure, current.designator.toUpperCase()))
    return current;
  const wanted = procedure.runways.map((r) => r.toUpperCase());
  return (
    airport.runways.find((r) => wanted.includes(r.designator.toUpperCase())) ??
    current ??
    airport.runways[0] ??
    null
  );
};

const legPoint = (
  ctx: RouteContext,
  leg: ProcedureLeg,
  procedure: Procedure,
): RoutePoint | null => {
  const fallback =
    finite(leg.lat) && finite(leg.lon) ? null : ctx.point(leg.ident);
  const lat = finite(leg.lat) ? leg.lat : fallback?.lat;
  const lon = finite(leg.lon) ? leg.lon : fallback?.lon;
  if (!finite(lat) || !finite(lon)) return null;
  return {
    id: leg.ident,
    kind: "procedure",
    lat,
    lon,
    procedure,
    procedureType: procedure.type,
    procedureLeg: leg,
  };
};

const baseFixPoint = (
  ctx: RouteContext,
  procedure: Procedure,
): RoutePoint | null => {
  const base = ctx.point(procedureBaseFix(procedure));
  return base
    ? { ...base, kind: "procedure", procedure, procedureType: procedure.type }
    : null;
};

function procedureEndpoint(
  ctx: RouteContext,
  procedure: Procedure,
  position: "first" | "last",
) {
  if (!procedure.legs.length) return null;
  if (procedure.type === "STAR" && position === "first")
    return baseFixPoint(ctx, procedure);
  return legPoint(
    ctx,
    position === "first" ? procedure.legs[0]! : procedure.legs.at(-1)!,
    procedure,
  );
}

function appendPoint(points: RoutePoint[], point: RoutePoint | null) {
  if (!point || !finite(point.lat) || !finite(point.lon)) return;
  if (points.at(-1)?.id === point.id) return;
  points.push(point);
}

function appendProcedure(
  ctx: RouteContext,
  points: RoutePoint[],
  procedure: Procedure,
  warnings: RouteWarning[],
  procedureChoice?: ProcedureChoice,
) {
  const procedurePoints: RoutePoint[] = [];
  if (procedure.type === "STAR") {
    const entry = baseFixPoint(ctx, procedure);
    if (!entry) {
      warnings.push({
        code: "procedure-entry-missing",
        procedure: procedureLabel(procedure),
        fix: procedureBaseFix(procedure),
      });
      return false;
    }
    procedurePoints.push(entry);
  }
  for (const [i, leg] of procedure.legs.entries()) {
    const p = legPoint(ctx, leg, procedure);
    if (!p) {
      warnings.push({
        code: "procedure-leg-missing",
        procedure: procedureLabel(procedure),
        leg: leg.ident || String(i + 1),
      });
      return false;
    }
    procedurePoints.push(p);
  }
  if (procedureChoice && procedurePoints.length)
    procedurePoints[0] = { ...procedurePoints[0]!, procedureChoice };
  procedurePoints.forEach((p) => appendPoint(points, p));
  return procedurePoints.length > 0;
}

const requestAirport = (
  type: ProcedureType,
  departure: Airport,
  destination: Airport,
) => (type === "SID" ? departure : destination);

function findProcedureByToken(
  ctx: RouteContext,
  token: string,
  departure: Airport,
  destination: Airport,
) {
  const t = normalizeProcedureId(token);
  if (!t) return null;
  return (
    ctx.byId(departure, "SID", t) ??
    ctx.byId(destination, "STAR", t) ??
    ctx.byId(destination, "APPROACH", t)
  );
}

function choicePoint(
  ctx: RouteContext,
  choice: ReturnType<RouteContext["choice"]>,
): RoutePoint | null {
  const base = ctx.point(choice.baseFix);
  return base
    ? {
        ...base,
        kind: "procedure-choice",
        procedureChoice: toChoice(choice),
        procedureType: choice.type,
      }
    : null;
}

const toChoice = (c: ReturnType<RouteContext["choice"]>): ProcedureChoice => ({
  key: c.key,
  type: c.type,
  baseFix: c.baseFix,
  procedures: c.procedures,
  selectedId: c.selectedId,
});

function tokenPoint(
  ctx: RouteContext,
  token: string,
  departure: Airport,
  destination: Airport,
) {
  const request = parseRequestToken(token);
  if (request) {
    const c = ctx.choice(
      requestAirport(request.type, departure, destination),
      request.type,
      request.baseFix,
    );
    if (c.selected)
      return procedureEndpoint(
        ctx,
        c.selected,
        c.type === "SID" ? "last" : "first",
      );
    return choicePoint(ctx, c);
  }
  const p = ctx.point(token);
  if (p) return p;
  const procedure = findProcedureByToken(ctx, token, departure, destination);
  if (!procedure) return null;
  return procedureEndpoint(
    ctx,
    procedure,
    procedure.type === "SID" ? "last" : "first",
  );
}

function airwaySegment(
  ctx: RouteContext,
  airways: RouteData["airways"],
  name: string,
  from: RoutePoint,
  to: RoutePoint | null,
) {
  const fixes = (airways[name] ?? [])
    .map((id) => ctx.point(id))
    .filter((p) => p !== null);
  if (!fixes.length || !to) return [];
  const nearest = (ref: RoutePoint) =>
    fixes.reduce(
      (best, p, i) =>
        distanceNm(ref, p) < distanceNm(ref, fixes[best]!) ? i : best,
      0,
    );
  const a = nearest(from);
  const b = nearest(to);
  const segment = fixes.slice(Math.min(a, b), Math.max(a, b) + 1);
  return a <= b ? segment : segment.reverse();
}

/** Procedures named in the route text, which the SID/STAR/APPROACH selects follow. */
export function requestedProcedures(data: RouteData, input: RoutePlanInput) {
  const { departure, destination } = input;
  const out: Record<ProcedureType, Procedure | null> = {
    SID: null,
    STAR: null,
    APPROACH: null,
  };
  if (!departure || !destination) return out;
  const ctx = createRouteContext(data, input);
  for (const token of routeTokens(input.routeText)) {
    const request = parseRequestToken(token);
    if (request) {
      const c = ctx.choice(
        requestAirport(request.type, departure, destination),
        request.type,
        request.baseFix,
      );
      if (c.selected) out[request.type] = c.selected;
      continue;
    }
    const p = findProcedureByToken(ctx, token, departure, destination);
    if (p) out[p.type] = p;
  }
  return out;
}

// ---------- altitudes and restrictions ----------

export function parseAltitudeFeet(value: string) {
  const text = clean(value).toUpperCase().replace(/\s+/g, "");
  if (!text) return null;
  const fl = /FL(\d{2,3})/.exec(text);
  if (fl) return Number(fl[1]) * 100;
  const ft = /(\d{3,5})(?:FT)?/.exec(text);
  return ft ? Number(ft[1]) : null;
}

// shortcut: pilot-entered restrictions (legacy map editor) are not ported yet; procedure ones only.
export function altitudeRestriction(
  point: RoutePoint | null | undefined,
): AltitudeRestriction | null {
  const altitude = point?.procedureLeg?.altitude;
  if (!altitude) return null;
  const feet = parseAltitudeFeet(altitude.raw);
  if (feet === null) return null;
  if (altitude.type === "atOrAbove")
    return { label: altitude.raw, minFt: feet, maxFt: null, type: "atOrAbove" };
  if (altitude.type === "atOrBelow")
    return { label: altitude.raw, minFt: null, maxFt: feet, type: "atOrBelow" };
  return { label: altitude.raw, minFt: feet, maxFt: feet, type: "exact" };
}

export function speedRestrictionKt(point: RoutePoint | null | undefined) {
  const speed = point?.procedureLeg?.speedKt;
  return finite(speed) && speed > 0 ? Math.round(speed) : null;
}

export function isRestrictionConflict(
  altitudeFt: number | null | undefined,
  r: AltitudeRestriction | null,
) {
  if (!r || !finite(altitudeFt)) return false;
  const tolerance = r.type === "exact" ? 100 : 0;
  return (
    (finite(r.minFt) && altitudeFt < r.minFt - tolerance) ||
    (finite(r.maxFt) && altitudeFt > r.maxFt + tolerance)
  );
}

export function legCruiseSpeedKt(leg: RouteLeg, cruiseSpeedKt: number) {
  if (!(cruiseSpeedKt > 0)) return NaN;
  const restriction = speedRestrictionKt(leg.to);
  return restriction !== null
    ? Math.max(MIN_GROUND_SPEED_KT, Math.min(cruiseSpeedKt, restriction))
    : cruiseSpeedKt;
}

// ---------- legs and vertical profile ----------

function createLegs(points: RoutePoint[]): RouteLeg[] {
  return points.slice(0, -1).map((from, i) => {
    const to = points[i + 1]!;
    const leg = to.procedureLeg;
    const routeDistance =
      finite(from.routeDistanceNm) && finite(to.routeDistanceNm)
        ? Math.max(0, to.routeDistanceNm - from.routeDistanceNm)
        : NaN;
    return {
      bearingDeg: finite(leg?.trackMagDeg)
        ? leg.trackMagDeg
        : Math.round(initialBearingDeg(from, to)),
      distanceNm: finite(routeDistance)
        ? routeDistance
        : finite(leg?.distanceNm)
          ? leg.distanceNm
          : distanceNm(from, to),
      from,
      to,
    };
  });
}

function annotateDistances(points: RoutePoint[], legs: RouteLeg[]) {
  const out = points.map((p) => ({ ...p }));
  let total = 0;
  if (out[0]) out[0].routeDistanceNm = 0;
  legs.forEach((leg, i) => {
    total += Math.max(0, leg.distanceNm);
    if (out[i + 1]) out[i + 1]!.routeDistanceNm = total;
  });
  return { points: out, totalDistanceNm: total };
}

function insertProfilePoints(
  points: RoutePoint[],
  profilePoints: { id: string; routeDistanceNm: number }[],
) {
  const base = points.map((p) => ({ ...p }));
  const sorted = profilePoints
    .filter((p) => finite(p.routeDistanceNm))
    .sort((a, b) => a.routeDistanceNm - b.routeDistanceNm);
  if (!sorted.length || base.length < 2) return base;
  // A profile event at an existing waypoint must not disappear between legs.
  const interior = sorted.filter((pp) => {
    const coincident = base.find(
      (p) =>
        Math.abs(Number(p.routeDistanceNm) - pp.routeDistanceNm) <=
        PROFILE_EPSILON_NM,
    );
    if (!coincident) return true;
    coincident.profileLabels = [
      ...new Set([...(coincident.profileLabels ?? []), pp.id]),
    ];
    return false;
  });
  const out: RoutePoint[] = [];
  for (let i = 0; i < base.length - 1; i++) {
    const from = base[i]!;
    const to = base[i + 1]!;
    out.push(from);
    const fromDistance = from.routeDistanceNm ?? 0;
    const toDistance = to.routeDistanceNm ?? fromDistance;
    for (const pp of interior) {
      if (!(
        pp.routeDistanceNm > fromDistance + PROFILE_EPSILON_NM &&
        pp.routeDistanceNm < toDistance - PROFILE_EPSILON_NM
      ))
        continue;
      const ratio = Math.max(
        0,
        Math.min(
          (pp.routeDistanceNm - fromDistance) /
            Math.max(0.001, toDistance - fromDistance),
          1,
        ),
      );
      out.push({
        id: pp.id,
        kind: "profile",
        isProfilePoint: true,
        lat: lerp(from.lat, to.lat, ratio),
        lon: lerp(from.lon, to.lon, ratio),
        procedure: to.procedure,
        procedureType: to.procedureType,
        routeDistanceNm: finite(from.routeDistanceNm)
          ? pp.routeDistanceNm
          : undefined,
      });
    }
  }
  out.push(base.at(-1)!);
  return out;
}

const isSidPoint = (p: RoutePoint) => p.procedureType === "SID";
const isArrivalPoint = (p: RoutePoint) =>
  p.procedureType === "STAR" || p.procedureType === "APPROACH";

function overrideFt(input: RoutePlanInput, point: RoutePoint) {
  const v = input.waypointAltitudes[pointKey(point)];
  return finite(v) ? Math.max(0, Math.round(v)) : null;
}

type DescentConstraint = { altitudeFt: number; distanceNm: number };

function descentConstraints(
  input: RoutePlanInput,
  points: RoutePoint[],
  destinationElevationFt: number,
  options: {
    includeManual: boolean;
    minDistanceNm?: number;
    routeTargetAltitudeFt: number;
  },
) {
  const min = options.minDistanceNm ?? -Infinity;
  const out: DescentConstraint[] = [];
  for (const point of points) {
    const distance = point.routeDistanceNm;
    if (!finite(distance) || distance <= min + PROFILE_EPSILON_NM) continue;
    const r = altitudeRestriction(point);
    if (r && isArrivalPoint(point) && finite(r.maxFt))
      out.push({ altitudeFt: r.maxFt, distanceNm: distance });
    const manual = options.includeManual ? overrideFt(input, point) : null;
    if (manual !== null && manual < options.routeTargetAltitudeFt - 100)
      out.push({ altitudeFt: manual, distanceNm: distance });
  }
  const last = points.at(-1);
  if (last && finite(last.routeDistanceNm))
    out.push({
      altitudeFt: Math.max(0, destinationElevationFt),
      distanceNm: last.routeDistanceNm,
    });
  return out;
}

function applyRestriction(altitudeFt: number, r: AltitudeRestriction | null) {
  if (!r) return altitudeFt;
  if (r.type === "exact" && finite(r.minFt)) return r.minFt;
  let next = altitudeFt;
  if (finite(r.minFt)) next = Math.max(next, r.minFt);
  if (finite(r.maxFt)) next = Math.min(next, r.maxFt);
  return next;
}

function findTopOfClimb(
  points: RoutePoint[],
  suggested: Record<string, number>,
  target: number,
  gradient: number,
  maxDistanceNm: number,
) {
  const none = { stepClimbStartKey: "", topOfClimbNm: NaN };
  if (!points.length || !finite(target) || !(gradient > 0)) return none;
  const altitudeAt = (i: number, fallback: number) => {
    const v = suggested[pointKey(points[i])];
    return finite(v) ? v : fallback;
  };
  for (let i = 1; i < points.length; i++) {
    const prevDistance = points[i - 1]!.routeDistanceNm ?? 0;
    const distance = points[i]!.routeDistanceNm ?? prevDistance;
    if (prevDistance >= maxDistanceNm - PROFILE_EPSILON_NM) break;
    const prevAltitude = altitudeAt(i - 1, 0);
    const altitude = altitudeAt(i, prevAltitude);
    if (prevAltitude >= target)
      return { stepClimbStartKey: "", topOfClimbNm: prevDistance };
    if (altitude >= target) {
      const toc = Math.min(
        distance,
        prevDistance + Math.max(0, (target - prevAltitude) / gradient),
      );
      if (toc >= maxDistanceNm - PROFILE_EPSILON_NM) break;
      return {
        stepClimbStartKey: i > 1 ? pointKey(points[i - 1]) : "",
        topOfClimbNm: toc,
      };
    }
  }
  let latest = none;
  points.forEach((point, i) => {
    const distance = point.routeDistanceNm;
    if (!finite(distance) || distance >= maxDistanceNm - PROFILE_EPSILON_NM)
      return;
    const altitude = altitudeAt(i, 0);
    if (altitude >= target - 50) return;
    const toc = distance + Math.max(0, target - altitude) / gradient;
    if (
      toc > distance + PROFILE_EPSILON_NM &&
      toc < maxDistanceNm - PROFILE_EPSILON_NM
    )
      latest = {
        stepClimbStartKey: i > 0 ? pointKey(point) : "",
        topOfClimbNm: toc,
      };
  });
  return latest;
}

function verticalProfile(
  input: RoutePlanInput,
  points: RoutePoint[],
  legs: RouteLeg[],
  departure: Airport,
  destination: Airport,
) {
  const annotated = annotateDistances(points, legs);
  const routePoints = annotated.points;
  const total = annotated.totalDistanceNm;
  const departureElevationFt = departure.elevationFt;
  const destinationElevationFt = destination.elevationFt;
  const climbGradient = input.climbGradientFtPerNm;
  const descentGradient = DESCENT_GRADIENT_FT_PER_NM;
  const target = routePoints.reduce(
    (t, p) => {
      const r = altitudeRestriction(p);
      return Math.max(
        t,
        finite(r?.minFt) ? r.minFt : 0,
        overrideFt(input, p) ?? 0,
      );
    },
    Math.max(0, Math.round(input.altitudeFt)),
  );
  const preliminary = descentConstraints(
    input,
    routePoints,
    destinationElevationFt,
    {
      includeManual: false,
      routeTargetAltitudeFt: target,
    },
  );
  const descentCeiling = (distance: number) =>
    preliminary.reduce(
      (ceiling, c) =>
        c.distanceNm < distance
          ? ceiling
          : Math.min(
              ceiling,
              c.altitudeFt + (c.distanceNm - distance) * descentGradient,
            ),
      target,
    );
  const suggested: Record<string, number> = {};
  routePoints.forEach((point, i) => {
    const key = pointKey(point);
    if (!key) return;
    const manual = overrideFt(input, point);
    if (manual !== null) {
      suggested[key] = Math.max(
        0,
        Math.round(applyRestriction(manual, altitudeRestriction(point))),
      );
      return;
    }
    if (point.isProfilePoint && (key === "TOC" || key === "TOD")) {
      suggested[key] = Math.max(0, Math.round(target));
      return;
    }
    const distance = point.routeDistanceNm ?? 0;
    const prev = i > 0 ? routePoints[i - 1]! : null;
    const prevAltitude =
      prev && finite(suggested[pointKey(prev)])
        ? suggested[pointKey(prev)]!
        : departureElevationFt;
    const prevDistance = prev?.routeDistanceNm ?? 0;
    const climbCeiling =
      i === 0
        ? departureElevationFt
        : prevAltitude + Math.max(0, distance - prevDistance) * climbGradient;
    const sidCap = routePoints.slice(i).reduce((cap, p) => {
      if (!isSidPoint(p)) return cap;
      const r = altitudeRestriction(p);
      return finite(r?.maxFt) ? Math.min(cap, r.maxFt) : cap;
    }, target);
    let altitude = Math.min(
      target,
      sidCap,
      climbCeiling,
      descentCeiling(distance),
    );
    if (i === 0) altitude = departureElevationFt;
    else if (i === routePoints.length - 1) altitude = destinationElevationFt;
    altitude = applyRestriction(altitude, altitudeRestriction(point));
    suggested[key] = Math.max(0, Math.round(altitude / 100) * 100);
  });

  const profilePoints: { id: string; routeDistanceNm: number }[] = [];
  const todCandidates = (constraints: DescentConstraint[]) =>
    constraints
      .map(
        (c) =>
          c.distanceNm - Math.max(0, target - c.altitudeFt) / descentGradient,
      )
      .filter(finite);
  const preliminaryTod = todCandidates(preliminary);
  const climb = findTopOfClimb(
    routePoints,
    suggested,
    target,
    climbGradient,
    preliminaryTod.length ? Math.min(...preliminaryTod) : total,
  );
  const profileRolesByKey: Record<string, "SOC"> = {};
  if (climb.stepClimbStartKey)
    profileRolesByKey[climb.stepClimbStartKey] = "SOC";
  const toc = climb.topOfClimbNm;
  if (
    finite(toc) &&
    toc > PROFILE_EPSILON_NM &&
    toc < total - PROFILE_EPSILON_NM
  )
    profilePoints.push({ id: "TOC", routeDistanceNm: toc });
  const tods = todCandidates(
    descentConstraints(input, routePoints, destinationElevationFt, {
      includeManual: true,
      minDistanceNm: finite(toc) ? toc : 0,
      routeTargetAltitudeFt: target,
    }),
  );
  const tod = tods.length ? Math.min(...tods) : NaN;
  if (
    finite(tod) &&
    tod > PROFILE_EPSILON_NM &&
    tod < total - PROFILE_EPSILON_NM
  )
    profilePoints.push({ id: "TOD", routeDistanceNm: tod });

  return {
    climbGradientFtPerNm: climbGradient,
    descentGradientFtPerNm: descentGradient,
    points: routePoints,
    profilePoints,
    profileRolesByKey,
    routeTargetAltitudeFt: target,
    suggestedAltitudesByKey: suggested,
    totalDistanceNm: total,
  };
}

// ---------- winds ----------

const normalizeWindDirection = (value: number) => {
  const rounded = Math.round(value);
  const normalized = ((rounded % 360) + 360) % 360;
  return normalized === 0 && rounded !== 0 ? 360 : normalized;
};

/** Valid rows of a waypoint's wind profile, by altitude. */
export function waypointWindProfile(rows: WxRow[] | undefined): ProfileWind[] {
  return (rows ?? [])
    .map((r) => ({
      altitudeFt: Number(r.altitudeFt),
      windDirection: Number(r.windDirection),
      windSpeed: Number(r.windSpeed),
      valid:
        r.altitudeFt.trim() !== "" &&
        r.windDirection.trim() !== "" &&
        r.windSpeed.trim() !== "",
    }))
    .filter(
      (r) =>
        r.valid &&
        finite(r.altitudeFt) &&
        finite(r.windDirection) &&
        finite(r.windSpeed) &&
        r.windSpeed >= 0,
    )
    .map((r) => ({
      altitudeFt: Math.max(0, Math.round(r.altitudeFt)),
      windDirection: normalizeWindDirection(r.windDirection),
      windSpeed: Math.max(0, r.windSpeed),
    }))
    .sort((a, b) => a.altitudeFt - b.altitudeFt);
}

const vector = (w: PlannerWind) => {
  const r = toRad(w.windDirection % 360);
  return { east: Math.sin(r) * w.windSpeed, north: Math.cos(r) * w.windSpeed };
};

function fromVector(v: { east: number; north: number }): PlannerWind {
  const speed = Math.hypot(v.east, v.north);
  if (!finite(speed) || speed <= 0.01)
    return { windDirection: 0, windSpeed: 0 };
  const direction = Math.round(
    ((Math.atan2(v.east, v.north) * 180) / Math.PI + 360) % 360,
  );
  return { windDirection: direction === 0 ? 360 : direction, windSpeed: speed };
}

export function interpolateWindProfile(
  profile: ProfileWind[],
  altitudeFt: number,
): PlannerWind | null {
  if (!profile.length) return null;
  const target = Math.max(0, Math.round(altitudeFt));
  if (profile.length === 1 || target <= profile[0]!.altitudeFt)
    return profile[0]!;
  const last = profile.at(-1)!;
  if (target >= last.altitudeFt) return last;
  for (let i = 0; i < profile.length - 1; i++) {
    const lo = profile[i]!;
    const hi = profile[i + 1]!;
    if (target >= lo.altitudeFt && target <= hi.altitudeFt) {
      const t =
        hi.altitudeFt === lo.altitudeFt
          ? 0
          : (target - lo.altitudeFt) / (hi.altitudeFt - lo.altitudeFt);
      const a = vector(lo);
      const b = vector(hi);
      return fromVector({
        east: lerp(a.east, b.east, t),
        north: lerp(a.north, b.north, t),
      });
    }
  }
  return null;
}

function combineWinds(winds: (PlannerWind | null)[]): PlannerWind | null {
  const valid = winds.filter(
    (w): w is PlannerWind =>
      !!w && finite(w.windDirection) && finite(w.windSpeed),
  );
  if (!valid.length) return null;
  if (valid.every((w) => w.variableWind))
    return {
      variableWind: true,
      windDirection: 0,
      windSpeed: valid.reduce((s, w) => s + w.windSpeed, 0) / valid.length,
    };
  const sum = valid.reduce(
    (acc, w) => {
      const v = vector(w);
      return { east: acc.east + v.east, north: acc.north + v.north };
    },
    { east: 0, north: 0 },
  );
  return fromVector({
    east: sum.east / valid.length,
    north: sum.north / valid.length,
  });
}

export type WindContext = {
  samples: { distanceNm: number; profile: ProfileWind[] }[];
  profileFor: (point: RoutePoint) => ProfileWind[];
  conditions: PlannerWind;
};

export function windContext(
  input: Pick<RoutePlanInput, "waypointWx" | "conditionsWind">,
  points: RoutePoint[],
): WindContext {
  const profileFor = (p: RoutePoint) =>
    waypointWindProfile(input.waypointWx[pointKey(p)]);
  const c = input.conditionsWind;
  return {
    samples: points
      .map((p, i) => ({
        distanceNm: p.routeDistanceNm ?? i,
        key: pointKey(p),
        profile: profileFor(p),
      }))
      .filter((s) => s.key && s.profile.length)
      .sort((a, b) => a.distanceNm - b.distanceNm),
    profileFor,
    conditions:
      c?.directionDeg == null
        ? {
            variableWind: !!c && c.speedKt > 0,
            windDirection: 0,
            windSpeed: c?.speedKt ?? 0,
          }
        : {
            windDirection: normalizeWindDirection(c.directionDeg),
            windSpeed: c.speedKt,
          },
  };
}

function windBetweenSamples(
  ctx: WindContext,
  distance: number,
  altitudeFt: number,
) {
  const s = ctx.samples;
  if (!s.length) return null;
  if (distance <= s[0]!.distanceNm)
    return interpolateWindProfile(s[0]!.profile, altitudeFt);
  if (distance >= s.at(-1)!.distanceNm)
    return interpolateWindProfile(s.at(-1)!.profile, altitudeFt);
  for (let i = 0; i < s.length - 1; i++) {
    const lo = s[i]!;
    const hi = s[i + 1]!;
    if (distance >= lo.distanceNm && distance <= hi.distanceNm) {
      const a = interpolateWindProfile(lo.profile, altitudeFt);
      const b = interpolateWindProfile(hi.profile, altitudeFt);
      if (!a || !b) return combineWinds([a, b]);
      const span = hi.distanceNm - lo.distanceNm;
      const t = span > 0 ? (distance - lo.distanceNm) / span : 0;
      const va = vector(a);
      const vb = vector(b);
      return fromVector({
        east: lerp(va.east, vb.east, t),
        north: lerp(va.north, vb.north, t),
      });
    }
  }
  return null;
}

/** Waypoint WX at the point, else interpolated between WX points along the route, else conditions. */
export function pointWind(
  ctx: WindContext,
  point: RoutePoint,
  altitudeFt: number,
  fallbackIndex = 0,
) {
  const own = ctx.profileFor(point);
  if (own.length) return interpolateWindProfile(own, altitudeFt);
  return (
    windBetweenSamples(
      ctx,
      point.routeDistanceNm ?? fallbackIndex,
      altitudeFt,
    ) ?? ctx.conditions
  );
}

export function legWind(
  ctx: WindContext,
  leg: RouteLeg,
  fromFt: number,
  toFt: number,
  index = 0,
) {
  const wind = combineWinds([
    pointWind(ctx, leg.from, fromFt, index),
    pointWind(ctx, leg.to, toFt, index + 1),
  ]);
  if (!wind) return null;
  return {
    altitudeFt: Math.round((fromFt + toFt) / 2),
    wind,
    windComponentKt: wind.variableWind
      ? 0
      : -legacyHeadwindKt(leg.bearingDeg, wind) || 0,
  };
}

// ---------- the plan ----------

export type RoutePlan = NonNullable<ReturnType<typeof buildRoutePlan>>;

export function buildRoutePlan(data: RouteData, input: RoutePlanInput) {
  const { departure, destination } = input;
  if (!departure || !destination) return null;
  const ctx = createRouteContext(data, input);
  const altitudeFt = Math.max(0, Math.round(input.altitudeFt));
  const tokens = routeTokens(input.routeText);
  const warnings: RouteWarning[] = [];
  const usedAirways: string[] = [];
  const usedProcedures: Procedure[] = [];
  const departurePoint = airportPoint(departure);
  const destinationPoint = airportPoint(destination);
  const points: RoutePoint[] = [departurePoint];

  const explicit = (type: ProcedureType) =>
    tokens.some(
      (t) =>
        parseRequestToken(t)?.type === type ||
        findProcedureByToken(ctx, t, departure, destination)?.type === type,
    );
  const sid = explicit("SID")
    ? null
    : ctx.selected(departure, "SID", input.selections.SID);
  const star = explicit("STAR")
    ? null
    : ctx.selected(destination, "STAR", input.selections.STAR);
  const approach = explicit("APPROACH")
    ? null
    : ctx.selected(destination, "APPROACH", input.selections.APPROACH);

  if (sid && appendProcedure(ctx, points, sid, warnings))
    usedProcedures.push(sid);

  tokens.forEach((token, index) => {
    const current = points.at(-1) ?? departurePoint;
    if (token === "DCT") return;
    const request = parseRequestToken(token);
    if (request) {
      const airport = requestAirport(request.type, departure, destination);
      const c = ctx.choice(airport, request.type, request.baseFix);
      const label = c.type + " " + c.baseFix;
      if (!c.procedures.length) {
        warnings.push({
          code: "request-not-found",
          request: label,
          airport: airport.ident,
        });
        return;
      }
      if (c.selected) {
        if (appendProcedure(ctx, points, c.selected, warnings, toChoice(c)))
          usedProcedures.push(c.selected);
        return;
      }
      const p = choicePoint(ctx, c);
      if (p) {
        appendPoint(points, p);
        warnings.push({ code: "request-select-variant", request: label });
      } else warnings.push({ code: "request-entry-missing", request: label });
      return;
    }
    const procedure = findProcedureByToken(ctx, token, departure, destination);
    if (procedure) {
      if (appendProcedure(ctx, points, procedure, warnings))
        usedProcedures.push(procedure);
      return;
    }
    if (data.airways[token]) {
      const nextToken = tokens
        .slice(index + 1)
        .find(
          (t) =>
            t !== "DCT" &&
            !data.airways[t] &&
            tokenPoint(ctx, t, departure, destination),
        );
      const target = nextToken
        ? tokenPoint(ctx, nextToken, departure, destination)
        : star
          ? procedureEndpoint(ctx, star, "first")
          : approach
            ? procedureEndpoint(ctx, approach, "first")
            : destinationPoint;
      const segment = airwaySegment(ctx, data.airways, token, current, target);
      if (segment.length) {
        segment.forEach((p) => appendPoint(points, p));
        usedAirways.push(token);
      } else warnings.push({ code: "airway-empty", airway: token });
      return;
    }
    const p = ctx.point(token);
    if (p) {
      appendPoint(points, p);
      return;
    }
    if (isProcedureDesignatorToken(token)) {
      warnings.push({
        code: "procedure-not-found",
        procedure: normalizeProcedureId(token),
        departure: departure.ident,
        destination: destination.ident,
      });
      return;
    }
    warnings.push({ code: "unknown-token", token });
  });

  if (star && appendProcedure(ctx, points, star, warnings))
    usedProcedures.push(star);
  if (approach && appendProcedure(ctx, points, approach, warnings))
    usedProcedures.push(approach);

  const usedSid = usedProcedures.find((p) => p.type === "SID") ?? null;
  const usedStar =
    [...usedProcedures].reverse().find((p) => p.type === "STAR") ?? null;
  const usedApproach =
    [...usedProcedures].reverse().find((p) => p.type === "APPROACH") ?? null;

  if (usedSid) {
    const runway = runwayForProcedure(ctx, departure, usedSid);
    const threshold = thresholdPoint(departure, runway);
    points[0] = threshold;
    if (threshold.thresholdMissingCoordinates)
      warnings.push({
        code: "threshold-missing",
        role: "departure",
        icao: departure.ident,
        runway: runway?.designator ?? "--",
      });
  }
  const finalProcedure = usedApproach ?? usedStar;
  const finalPoint = finalProcedure
    ? thresholdPoint(
        destination,
        runwayForProcedure(ctx, destination, finalProcedure),
      )
    : destinationPoint;
  if (finalPoint.thresholdMissingCoordinates)
    warnings.push({
      code: "threshold-missing",
      role: "destination",
      icao: destination.ident,
      runway: finalPoint.runwayId ?? "--",
    });
  appendPoint(points, finalPoint);

  const withUserPoints = insertUserWaypoints(points, input.insertedWaypoints);
  const base = verticalProfile(
    input,
    withUserPoints,
    createLegs(withUserPoints),
    departure,
    destination,
  );
  const enriched = insertProfilePoints(base.points, base.profilePoints);
  const profile = verticalProfile(
    input,
    enriched,
    createLegs(enriched),
    departure,
    destination,
  );
  const finalPoints = profile.points;
  const legs = createLegs(finalPoints);
  const pointAltitudeByKey: Record<string, number> = {};
  for (const p of finalPoints) {
    const key = pointKey(p);
    if (!key || key in pointAltitudeByKey) continue;
    const suggested = profile.suggestedAltitudesByKey[key];
    pointAltitudeByKey[key] =
      overrideFt(input, p) ??
      (finite(suggested) ? Math.max(0, Math.round(suggested)) : altitudeFt);
  }
  const altitudeOf = (p: RoutePoint) =>
    pointAltitudeByKey[pointKey(p)] ?? altitudeFt;
  const winds = windContext(input, finalPoints);
  const legWinds = legs.map((leg, i) =>
    legWind(winds, leg, altitudeOf(leg.from), altitudeOf(leg.to), i),
  );
  const weighted = legs.reduce(
    (acc, leg, i) => {
      const w = legWinds[i];
      if (!w || !(leg.distanceNm > 0)) return acc;
      return {
        distanceNm: acc.distanceNm + leg.distanceNm,
        wind: acc.wind + w.windComponentKt * leg.distanceNm,
      };
    },
    { distanceNm: 0, wind: 0 },
  );
  const minutesAt = (speedKt: number) =>
    legs.reduce((minutes, leg, i) => {
      const gs = Math.max(
        MIN_GROUND_SPEED_KT,
        legCruiseSpeedKt(leg, speedKt) + (legWinds[i]?.windComponentKt ?? 0),
      );
      return minutes + (Math.max(0, leg.distanceNm) / gs) * 60;
    }, 0);

  return {
    departure,
    destination,
    alternate: input.alternate,
    altitudeFt,
    tokens,
    points: finalPoints,
    legs,
    pointAltitudeByKey,
    verticalProfile: profile,
    legWinds,
    routeWindAvailable: weighted.distanceNm > 0,
    routeWindComponentKt:
      weighted.distanceNm > 0 ? weighted.wind / weighted.distanceNm : null,
    /** En-route minutes at a cruise speed (legs slowed by procedure speed limits). */
    minutesAt,
    totalDistanceNm: legs.reduce((s, l) => s + l.distanceNm, 0),
    usedAirways,
    usedProcedures,
    warnings,
  };
}

function insertUserWaypoints(
  points: RoutePoint[],
  inserted: RoutePlanInput["insertedWaypoints"],
) {
  const out = [...points];
  const seen = new Set<string>();
  for (const w of inserted) {
    const id = clean(w.ident).toUpperCase();
    if (!id || seen.has(id) || !finite(w.lat) || !finite(w.lon)) continue;
    seen.add(id);
    if (out.some((p) => pointKey(p) === id)) continue;
    const point: RoutePoint = {
      id,
      kind: "user-waypoint",
      lat: w.lat,
      lon: w.lon,
    };
    // shortcut: legacy also honours a map anchor (the leg it was dropped on); we use the nearest leg.
    let at = Math.max(1, out.length - 1);
    let best = Infinity;
    for (let i = 0; i < out.length - 1; i++) {
      const score = Math.max(
        0,
        distanceNm(out[i]!, point) +
          distanceNm(point, out[i + 1]!) -
          distanceNm(out[i]!, out[i + 1]!),
      );
      if (score < best) {
        best = score;
        at = i + 1;
      }
    }
    out.splice(at, 0, point);
  }
  return out;
}

/** How legacy names a point in the route strip and leg cards. */
export function formatRoutePoint(point: RoutePoint) {
  if (point.profileLabels?.length)
    return [point.id, ...point.profileLabels].join(" / ");
  if (point.kind === "threshold")
    return [point.airportIcao, point.id].filter(Boolean).join(" ");
  if (point.kind === "coordinate") return point.label ?? point.id;
  return point.id;
}

export const isStarEntryPoint = (point: RoutePoint) =>
  point.procedureType === "STAR" && !point.procedureLeg;

/** Legacy "Head 12 kt" / "Tail 5 kt" / "0 kt". */
export function formatRouteWind(componentKt: number | null) {
  if (componentKt === null || !finite(componentKt) || componentKt === 0)
    return "0 kt";
  return (
    (componentKt > 0 ? "Tail " : "Head ") +
    Math.abs(Math.round(componentKt)) +
    " kt"
  );
}
