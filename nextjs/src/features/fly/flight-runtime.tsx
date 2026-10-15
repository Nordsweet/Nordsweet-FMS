"use client";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { api } from "~/api";
import { distanceNm } from "~/domain/geo";
import { computeProgress } from "~/domain/progress";
import { useFlight } from "~/stores/flight";
import { useInFlight } from "~/stores/inflight";
import { useMapSettings } from "~/stores/map";
import { playChime } from "./chime";
import { useGps } from "./use-gps";

const useAirport = (code: string | undefined) =>
  useQuery({
    ...api.airports.get.queryOptions({ code: code ?? "" }),
    enabled: !!code,
  }).data ?? null;

/** Mounted once above routes: leg sequencing, recording and flight timers continue across screens. */
export function FlightRuntime() {
  const flight = useInFlight();
  const plan = useFlight((s) => s.flight);
  const observeGps = useMapSettings((s) => s.observeGps);
  const enabled = useMapSettings((s) => s.gpsEnabled);
  const { fix, error } = useGps(enabled || flight.startedAt !== null);
  const { record, setActiveLeg, observe, tick } = flight;
  const departure = useAirport(plan.departure?.ident);
  const airports = useQuery(api.airports.list.queryOptions(undefined)).data;
  const flying = flight.startedAt !== null;
  useEffect(() => {
    if (!flying) return;
    const id = setInterval(() => {
      if (tick(Date.now())) playChime();
    }, 1000);
    return () => clearInterval(id);
  }, [flying, tick]);
  useEffect(() => {
    if (!fix || error || Date.now() - Date.parse(fix.time) > 20000) return;
    observeGps(fix);
    if (!flight.startedAt) return;
    flight.observePattern(fix);
    const progress = computeProgress(flight.route, fix, flight.activeLeg);
    if (progress && progress.activeLeg !== flight.activeLeg)
      setActiveLeg(progress.activeLeg);
    record({
      lat: fix.lat,
      lon: fix.lon,
      altitudeFt: fix.altitudeFt,
      time: fix.time,
    });
    // Legacy: the ground under the aircraft is the nearest airport's elevation.
    const ground = airports?.reduce<{ d: number; ft: number } | null>(
      (best, a) => {
        const d = distanceNm(a, fix);
        return !best || d < best.d ? { d, ft: a.elevationFt } : best;
      },
      null,
    );
    observe(
      {
        at: Date.parse(fix.time),
        lat: fix.lat,
        lon: fix.lon,
        altitudeFt: fix.altitudeFt,
        speedKt: fix.groundSpeedKt,
        headingDeg: fix.trackDeg,
      },
      {
        departureElevationFt: departure?.elevationFt ?? 0,
        cruiseAltitudeFt: plan.cruiseAltitudeFt,
        groundElevationFt: ground?.ft ?? departure?.elevationFt ?? 0,
      },
    );
    // Only a new fix drives the timers; the rest is read at that moment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fix, error]);
  return null;
}
