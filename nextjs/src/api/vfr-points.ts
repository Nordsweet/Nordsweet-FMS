import { type Navpoint } from "~/data/schemas";

import { type Place } from "./aviation/schemas";

/**
 * Maps an Aviation API VFR point ("EPML ALFA") to a navpoint. The legacy planner shortened these
 * to ICAO + first letter ("EPMLA"), and saved routes still use that form, so it is kept as alias.
 */
export function vfrPointToNavpoint(place: Place): Navpoint {
  const code = (place.code ?? place.name).trim().toUpperCase();
  const [airport, ...rest] = code.split(/\s+/);
  const isAirportPoint =
    !!airport && /^[A-Z]{4}$/.test(airport) && rest.length > 0;
  return {
    ident: code,
    aliases: isAirportPoint ? [airport + rest.join(" ").charAt(0)] : [],
    name: place.name,
    kind: "vfr-reporting-point",
    lat: place.lat,
    lon: place.lon,
    airport: isAirportPoint ? airport : null,
    description: place.description,
    airways: [],
    navaid: null,
    source: "aviation-api (lotnik_cup)",
  };
}
