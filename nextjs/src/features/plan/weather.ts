import { useQuery } from "@tanstack/react-query";

import { api } from "~/api";
import { type FlightPoint } from "~/data/flight";
import { distanceNm } from "~/domain/geo";

const MAX_STATION_DISTANCE_NM = 25;

/**
 * Where to get weather for a route point: the field itself if it has an ICAO code, otherwise the
 * nearest ICAO airport within 25 NM (strips have no METAR of their own).
 */
export function useWeatherStation(point: FlightPoint | null) {
  const airports = useQuery({
    ...api.airports.list.queryOptions(undefined),
    enabled: !!point,
  });
  if (!point || !airports.data) return null;
  const own = airports.data.find((a) => a.ident === point.ident);
  if (own?.isIcao && /^[A-Z]{4}$/.test(own.ident))
    return { icao: own.ident, distanceNm: 0 };
  const nearest = airports.data
    .filter((a) => a.isIcao && /^[A-Z]{4}$/.test(a.ident))
    .map((a) => ({ icao: a.ident, distanceNm: distanceNm(point, a) }))
    .sort((a, b) => a.distanceNm - b.distanceNm)[0];
  return nearest && nearest.distanceNm <= MAX_STATION_DISTANCE_NM
    ? nearest
    : null;
}

export function useBriefing(point: FlightPoint | null) {
  const station = useWeatherStation(point);
  const briefing = useQuery({
    ...api.airports.briefing.queryOptions({ icao: station?.icao ?? "" }),
    enabled: !!station,
  });
  return { station, briefing };
}
