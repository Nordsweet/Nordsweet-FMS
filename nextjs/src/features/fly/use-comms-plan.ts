"use client";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { api } from "~/api";
import {
  type AirportRows,
  commsZones,
  estimateComms,
  routeRadioGroups,
  rowsAt,
} from "~/domain/comms";
import { type FlightPhase } from "~/domain/flight-phase";
import { AIRSPACE_QUERY } from "~/features/map/map-view";
import { usePlan } from "~/features/plan/use-plan";
import { useInFlight } from "~/stores/inflight";
import { useMapSettings } from "~/stores/map";
import { type GpsFix } from "./use-gps";
import { useTerrainHeight } from "./use-terrain-height";
const FRESH_FIX_MS = 30_000;

/** Shared radio estimate keeps COMMs and the always-visible hand-off popup in sync. */
export function useCommsPlan(
  phase: FlightPhase,
  fix: GpsFix | null,
  now: number,
  enabled: boolean,
) {
  const { flight, cruiseSpeedKt } = usePlan();
  const route = useInFlight((s) => s.route);
  const plan = useMapSettings((s) => s.plan);
  const frequencies = useQuery({
    ...api.frequencies.list.queryOptions(undefined),
    enabled,
  });
  const airspace = useQuery({
    ...api.airspace.around.queryOptions({
      ...AIRSPACE_QUERY,
      plan: plan === "none" ? "current" : plan,
    }),
    enabled,
  });
  // Recompute at most every 2 s of GPS time, like legacy.
  const tick = fix ? Math.floor(Date.parse(fix.time) / 2000) : 0;
  const freshFix = !!fix && now - Date.parse(fix.time) < FRESH_FIX_MS;
  const fresh = freshFix ? fix : null;
  const height = useTerrainHeight(fresh);
  const position = fresh
    ? {
        ...fresh,
        altitudeFt: height.mslFt ?? fresh.altitudeFt,
        altitudeAglFt: height.aglFt,
      }
    : null;

  const result = useMemo(() => {
    const list = frequencies.data ?? [];
    const airport: AirportRows = (icao, services) =>
      list
        .filter((f) => f.airport === icao && services.includes(f.service))
        .map((f) => ({ ...f, serviceId: f.service }))
        .sort(
          (a, b) => services.indexOf(a.service) - services.indexOf(b.service),
        );
    const zones = commsZones(airspace.data?.features ?? []);
    const dep = flight.departure?.ident ?? "";
    const arr = flight.destination?.ident ?? "";
    return {
      estimate: estimateComms(
        {
          phase,
          position: enabled ? position : null,
          gpsSpeedKt: fresh?.groundSpeedKt ?? null,
          plannedSpeedKt: cruiseSpeedKt,
          route,
        },
        {
          dep: (services) => airport(dep, services),
          arr: (services) => airport(arr, services),
          at: (point) => rowsAt(point, zones, airport),
        },
      ),
      groups: routeRadioGroups(route, zones, airport),
    };
    // `fresh` changes every fix; `tick` throttles it to 2 s.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    phase,
    tick,
    freshFix,
    height.mslFt,
    height.aglFt,
    enabled,
    route,
    frequencies.data,
    airspace.data,
    flight.departure,
    flight.destination,
    cruiseSpeedKt,
  ]);

  return { ...result, loading: !frequencies.data || !airspace.data };
}
