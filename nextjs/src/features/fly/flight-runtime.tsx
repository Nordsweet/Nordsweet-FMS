"use client";
import { useEffect } from "react";
import { computeProgress } from "~/domain/progress";
import { useInFlight } from "~/stores/inflight";
import { useMapSettings } from "~/stores/map";
import { useGps } from "./use-gps";

/** Mounted once above routes: leg sequencing and recording continue when the pilot changes screens. */
export function FlightRuntime() {
  const flight = useInFlight();
  const observeGps = useMapSettings((s) => s.observeGps);
  const enabled = useMapSettings((s) => s.gpsEnabled);
  const { fix, error } = useGps(enabled || flight.startedAt !== null);
  const { record, setActiveLeg } = flight;
  useEffect(() => {
    if (!fix || error || Date.now() - Date.parse(fix.time) > 20000) return;
    observeGps(fix);
    if (!flight.startedAt) return;
    const progress = computeProgress(flight.route, fix, flight.activeLeg);
    if (progress && progress.activeLeg !== flight.activeLeg)
      setActiveLeg(progress.activeLeg);
    record({
      lat: fix.lat,
      lon: fix.lon,
      altitudeFt: fix.altitudeFt,
      time: fix.time,
    });
  }, [
    fix,
    error,
    observeGps,
    flight.startedAt,
    flight.route,
    flight.activeLeg,
    record,
    setActiveLeg,
  ]);
  return null;
}
