"use client";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { api } from "~/api";
import { distanceNm } from "~/domain/geo";
import { departureRunwayChoice } from "~/domain/departure-pattern";
import { patternRunwayGeometry } from "~/domain/traffic-pattern";
import { navigationProgress } from "~/domain/holding";
import { useFlight } from "~/stores/flight";
import { useEngineTimers } from "~/stores/engine-timers";
import { useInFlight } from "~/stores/inflight";
import { useMapSettings } from "~/stores/map";
import { playChime } from "./chime";
import { useGps } from "./use-gps";
import { useTurnPerformance } from "./use-turn-performance";
import { useWindEstimation } from "./use-wind-estimation";
import { useEmergencyTelemetry } from "~/features/emergency/use-emergency-telemetry";
import { useCruiseAltitude } from "~/stores/cruise-altitude";
import { flightGuidanceAvailable } from "~/domain/flight-guidance";
import { fredaAvailable } from "~/domain/freda";
import { useTerrainHeight } from "./use-terrain-height";
import { recordAirrep, useAirrepUpload } from "./use-airrep";

const useAirport = (code: string | undefined) =>
  useQuery({
    ...api.airports.get.queryOptions({ code: code ?? "" }),
    enabled: !!code,
  }).data ?? null;

/** Mounted once above routes: leg sequencing, recording and flight timers continue across screens. */
export function FlightRuntime() {
  useWindEstimation();
  useAirrepUpload();
  useEmergencyTelemetry();
  // Only what this component reads: the store changes on every GPS fix and every second.
  const startedAt = useInFlight((s) => s.startedAt);
  const phase = useInFlight((s) => s.phase);
  const holding = useInFlight((s) => s.holding);
  const route = useInFlight((s) => s.route);
  const activeLeg = useInFlight((s) => s.activeLeg);
  const plan = useFlight((s) => s.flight);
  const observeGps = useMapSettings((s) => s.observeGps);
  const enabled = useMapSettings((s) => s.gpsEnabled);
  const { fix, error } = useGps(enabled || startedAt !== null);
  const turns = useTurnPerformance(startedAt ? fix : null);
  // Actions never change identity.
  const { record, setActiveLeg, observe, tick, setFredaAvailable } =
    useInFlight.getState();
  const [now, setNow] = useState(() => Date.now());
  const departure = useAirport(plan.departure?.ident);
  const groundData = useQuery({
    ...api.ground.byAirport.queryOptions({
      airport: plan.departure?.ident ?? "",
    }),
    enabled: !!plan.departure,
  }).data;
  const airports = useQuery(api.airports.list.queryOptions(undefined)).data;
  const flying = startedAt !== null;
  const fresh =
    fix &&
    !error &&
    !fix.paused &&
    Math.abs(now - Date.parse(fix.time)) <= 20000
      ? fix
      : null;
  const height = useTerrainHeight(
    ["descent", "landing", "taxiin"].includes(phase) ? fresh : null,
  );
  useEffect(() => {
    useEngineTimers.getState().observe({
      session: startedAt,
      phase,
      now,
      sample: fresh
        ? {
            at: fresh.receivedAt ?? Date.parse(fresh.time),
            groundSpeedKt: fresh.groundSpeedKt,
            onGround: fresh.onGround,
            paused: fresh.paused,
          }
        : null,
    });
  }, [startedAt, phase, now, fresh]);
  useEffect(() => {
    setFredaAvailable(
      fredaAvailable(phase, height.mslFt, height.aglFt, plan.cruiseAltitudeFt),
    );
  }, [
    phase,
    setFredaAvailable,
    height.mslFt,
    height.aglFt,
    plan.cruiseAltitudeFt,
  ]);
  useEffect(() => {
    const now = Date.now();
    const available = !error && flightGuidanceAvailable({ now, phase, fix });
    useCruiseAltitude.getState().observe(
      {
        session: startedAt,
        plannedFt: plan.cruiseAltitudeFt,
        phase,
        source: fix?.source ?? "gps",
        blocked:
          (!!holding && holding.phase !== "armed") ||
          !!route[activeLeg + 1]?.patternId,
        sample:
          available && fix?.altitudeFt != null
            ? {
                at: Date.parse(fix.time),
                altitudeFt: fix.altitudeFt,
                verticalSpeedFpm: fix.verticalSpeedFpm,
              }
            : null,
      },
      now,
    );
  }, [
    fix,
    error,
    startedAt,
    phase,
    holding,
    route,
    activeLeg,
    plan.cruiseAltitudeFt,
  ]);
  useEffect(() => {
    if (!flying) return;
    const id = setInterval(() => {
      const at = Date.now();
      setNow(at);
      if (tick(at)) playChime();
    }, 1000);
    return () => clearInterval(id);
  }, [flying, tick]);
  useEffect(() => {
    if (
      !fix ||
      fix.paused ||
      error ||
      Date.now() - Date.parse(fix.time) > 20000
    )
      return;
    observeGps(fix);
    if (!startedAt) return;
    useInFlight.getState().observePattern(fix, turns);
    useInFlight.getState().observeHolding(fix, Date.now());
    const current = useInFlight.getState();
    const progress = navigationProgress(
      current.route,
      fix,
      current.activeLeg,
      turns,
      current.holding,
    );
    if (progress && progress.activeLeg > current.activeLeg) {
      for (let i = current.activeLeg + 1; i <= progress.activeLeg; i++)
        recordAirrep(startedAt, current.route, i, fix);
    }
    const last = current.route.at(-1);
    if (
      last &&
      current.activeLeg === current.route.length - 2 &&
      distanceNm(last, fix) <= 0.3
    )
      recordAirrep(startedAt, current.route, current.route.length - 1, fix);
    if (progress && progress.activeLeg !== activeLeg)
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
        onGround: fix.onGround,
        altitudeAglFt: fix.altitudeAglFt,
      },
      {
        departureElevationFt: departure?.elevationFt ?? 0,
        cruiseAltitudeFt: plan.cruiseAltitudeFt,
        groundElevationFt: ground?.ft ?? departure?.elevationFt ?? 0,
        departureRunway:
          current.departurePattern?.runway ??
          (departure
            ? (() => {
                const runway = departureRunwayChoice(
                  plan,
                  departure,
                  groundData,
                )?.runway;
                return runway
                  ? patternRunwayGeometry(departure, runway)
                  : (departure.runways
                      .map((r) => patternRunwayGeometry(departure, r))
                      .filter((r) => r !== null)
                      .sort(
                        (a, b) =>
                          distanceNm(fix, a.threshold) -
                          distanceNm(fix, b.threshold),
                      )[0] ?? null);
              })()
            : null),
      },
    );
    // Only a new fix drives the timers; the rest is read at that moment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fix, error]);
  return null;
}
