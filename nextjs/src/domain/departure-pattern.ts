import type { Flight } from "~/data/flight";
import type { Airport, Ground } from "~/data/schemas";
import { patternRunwayGeometry } from "./traffic-pattern";
import type { NavPoint } from "./progress";
import type { FlightPhase } from "./flight-phase";

/** On a round trip the home airport becomes an arrival once the departure pattern's final fix is passed. */
export function isDeparturePatternTarget(
  flight: Pick<Flight, "departure" | "destination">,
  navigation: {
    startedAt: string | null;
    route: NavPoint[];
    activeLeg: number;
    phase: FlightPhase;
    departurePattern: { id: string } | null;
  },
  airport: string,
) {
  if (flight.departure?.ident !== airport) return false;
  if (flight.destination?.ident !== airport || !navigation.startedAt)
    return true;
  const last = navigation.departurePattern
    ? navigation.route
        .map((p) => p.patternId)
        .lastIndexOf(navigation.departurePattern.id)
    : -1;
  if (last >= 0) return navigation.activeLeg < last;
  return (
    !navigation.departurePattern &&
    ["taxiout", "takeoff"].includes(navigation.phase)
  );
}

/** Recognise a runway only when a selected taxi endpoint identifies one unambiguous runway end. */
export function taxiDepartureRunway(
  airport: Airport,
  ground: Ground | null | undefined,
  id: string | null,
) {
  const element = ground?.elements.find((e) => e.id === id);
  if (!element || !["runway", "holdingPoint"].includes(element.type))
    return null;
  const ends = new Set(
    [
      ...`${element.id} ${element.label}`
        .toUpperCase()
        .matchAll(
          /(?:RWY\s*|RW|HP|\b)(0?[1-9]|[12]\d|3[0-6])([LRC]?)(?=\b|\/)/g,
        ),
    ].map((m) => m[1]!.padStart(2, "0") + m[2]!),
  );
  const matches = airport.runways.filter((r) => ends.has(r.designator));
  return matches.length === 1 ? matches[0]! : null;
}

/** Latest explicit Take-off/Taxi-out choice wins; old saved inputs remain usable. */
export function departureRunwayChoice(
  flight: Flight,
  airport: Airport,
  ground?: Ground | null,
) {
  const selected =
    flight.departureRunway?.airport === airport.ident
      ? flight.departureRunway
      : null;
  const takeoff =
    flight.performanceInputs[
      `takeoff|${airport.ident}|${flight.aircraftId ?? ""}`
    ]?.runwayId;
  const taxi = taxiDepartureRunway(
    airport,
    ground,
    flight.taxiInputs[`departure|${airport.ident}`]?.to ?? null,
  );
  const designator = selected?.designator ?? takeoff ?? taxi?.designator;
  const runway = airport.runways.find((r) => r.designator === designator);
  return runway
    ? {
        runway,
        source:
          selected?.source ??
          (takeoff ? ("takeoff" as const) : ("taxi" as const)),
      }
    : null;
}

/** Automatic departure patterns follow runway choices without storing derived route vertices. */
export function resolvedDeparturePattern(
  flight: Flight,
  airport: Airport | null,
  ground?: Ground | null,
) {
  const pattern = flight.departurePattern;
  if (!airport || pattern?.airport.ident !== airport.ident) return null;
  const choice = pattern.runwayAutomatic
    ? departureRunwayChoice(flight, airport, ground)
    : null;
  const geometry = choice && patternRunwayGeometry(airport, choice.runway);
  return choice && geometry
    ? { ...pattern, runway: { ...choice.runway, ...geometry } }
    : pattern;
}
