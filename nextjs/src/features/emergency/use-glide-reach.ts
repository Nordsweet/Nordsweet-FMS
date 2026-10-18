"use client";
import { useEffect, useMemo, useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "~/api";
import {
  type GlideInput,
  type GlideReach,
  type GlideWind,
} from "~/data/terrain";
import { type EmergencyMeasurement } from "~/domain/emergency";
import { type GpsFix } from "~/features/fly/use-gps";
import { useGlide } from "~/stores/glide";
import { useWind } from "~/stores/wind";
import { useInFlight } from "~/stores/inflight";
import { windStatus } from "~/domain/wind-estimation";
import { measuredTasKt } from "~/domain/glide-reach";

/** Terrain planning runs in a cancellable worker; an old job cannot repaint a new flight/fix. */
export function useGlideReach(
  active: boolean,
  sessionId: string | null,
  fix: GpsFix | null,
  samples: EmergencyMeasurement[],
  now: number,
) {
  const windState = useWind(),
    clearance = useGlide((s) => s.clearanceM),
    manual = useGlide((s) => s.manualWind),
    publish = useGlide((s) => s.publish),
    startedAt = useInFlight((s) => s.startedAt);
  const [planningWind, setPlanningWind] = useState(() => ({
    session: windState.session,
    estimate: windState.state.estimate,
  }));
  useEffect(() => {
    // A new live fit every GPS tick must not keep superseding a running solve.
    const read = () => {
      const current = useWind.getState();
      setPlanningWind({
        session: current.session,
        estimate: current.state.estimate,
      });
    };
    const timer = setInterval(read, 30000);
    const unsubscribe = useWind.subscribe((next, previous) => {
      if (
        next.session !== previous.session ||
        !!next.state.estimate !== !!previous.state.estimate
      )
        read();
    });
    return () => {
      clearInterval(timer);
      unsubscribe();
    };
  }, []);
  // A GPS callback can arrive between ticks of the map clock.
  now = Math.max(now, fix?.receivedAt ?? now);
  const measurement = samples.at(-1);
  const live =
    windState.session === startedAt &&
    planningWind.session === startedAt &&
    windStatus(
      { ...windState.state, estimate: planningWind.estimate },
      Math.max(now, windState.state.lastAcceptedAt ?? 0),
    ) === "valid"
      ? planningWind.estimate
      : null;
  const wind: GlideWind | null =
    manual?.sessionId === sessionId &&
    now - manual.at >= -1000 &&
    now - manual.at < 600_000
      ? manual
      : live
        ? {
            eastKt: (live.eastMps * 3600) / 1852,
            northKt: (live.northMps * 3600) / 1852,
            source: "live",
          }
        : null;
  const valid =
    active &&
    !!fix &&
    !!measurement &&
    measurement.altitudeDatum === "AMSL" &&
    measurement.altitudeAmslFt !== null &&
    now - measurement.at >= -1000 &&
    now - measurement.at <= 20_000 &&
    now - Date.parse(fix.time) <= 20_000 &&
    now - Date.parse(fix.time) >= -1000 &&
    measurement.verticalSpeedFpm !== null &&
    measurement.verticalSpeedFpm <= -50 &&
    measurement.groundSpeedKt !== null &&
    measurement.groundSpeedKt > 0 &&
    (measurement.trackDeg ?? fix.trackDeg) !== null;
  const altitudeM = valid ? measurement.altitudeAmslFt! * 0.3048 : 0;
  const sinkFpm = valid
    ? -samples
        .filter(
          (s) =>
            measurement.at - s.at <= 10_000 &&
            s.verticalSpeedFpm !== null &&
            s.source === measurement.source,
        )
        .reduce((a, s) => a + s.verticalSpeedFpm!, 0) /
      samples.filter(
        (s) =>
          measurement.at - s.at <= 10_000 &&
          s.verticalSpeedFpm !== null &&
          s.source === measurement.source,
      ).length
    : 0;
  const tasKt =
    valid && wind
      ? measuredTasKt(
          measurement.groundSpeedKt!,
          (measurement.trackDeg ?? fix.trackDeg)!,
          wind,
        )
      : 0;
  const radiusM =
    valid && wind && sinkFpm >= 50
      ? Math.min(
          100_000,
          Math.max(
            1000,
            (((altitudeM - clearance) / ((sinkFpm * 0.3048) / 60)) *
              (tasKt + Math.hypot(wind.eastKt, wind.northKt)) *
              1852) /
              3600,
          ),
        )
      : 0;
  const lat = measurement?.lat ?? fix?.lat ?? 0,
    lon = measurement?.lon ?? fix?.lon ?? 0;
  const eastKt = wind?.eastKt,
    northKt = wind?.northKt,
    source = wind?.source,
    clearanceM = clearance;
  const input = useMemo<GlideInput | null>(
    () =>
      valid &&
      eastKt !== undefined &&
      northKt !== undefined &&
      source &&
      tasKt > 0 &&
      sinkFpm >= 50 &&
      altitudeM > clearanceM
        ? {
            origin: { lat, lon },
            altitudeM,
            tasKt,
            sinkFpm,
            wind: { eastKt, northKt, source },
            clearanceM,
            radiusM,
            stepM: Math.max(200, radiusM / 64),
          }
        : null,
    [
      valid,
      lat,
      lon,
      altitudeM,
      tasKt,
      sinkFpm,
      eastKt,
      northKt,
      source,
      clearanceM,
      radiusM,
    ],
  );
  const regionInput = {
    lat: Math.round((fix?.lat ?? 0) * 50) / 50,
    lon: Math.round((fix?.lon ?? 0) * 50) / 50,
    radiusNm: Math.ceil(radiusM / 1852 / 5) * 5 + 2,
  };
  const region = useQuery({
    ...api.terrain.region.queryOptions(regionInput),
    enabled: !!input,
    retry: false,
  });
  const id =
    input && sessionId
      ? JSON.stringify([sessionId, input, region.dataUpdatedAt])
      : "";
  const [result, setResult] = useState<{
    id: string;
    reach?: GlideReach;
    error?: boolean;
  }>({ id: "" });
  const workerRef = useRef<Worker | null>(null);
  useEffect(() => {
    if (!sessionId) return;
    const worker = new Worker(new URL("./glide-worker.ts", import.meta.url));
    workerRef.current = worker;
    worker.onmessage = (
      event: MessageEvent<{ id: string; reach?: GlideReach; error?: boolean }>,
    ) => setResult(event.data);
    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, [sessionId]);
  useEffect(() => {
    if (!input || !region.data || !id || !workerRef.current) return;
    workerRef.current.onerror = () => setResult({ id, error: true });
    workerRef.current.postMessage({ id, input, region: region.data });
  }, [input, region.data, id]);
  const reach =
    result.id === id && valid && wind ? (result.reach ?? null) : null;
  const status =
    !valid || (!!wind && !input)
      ? ("inputs" as const)
      : !wind
        ? ("wind" as const)
        : region.isError ||
            (result.id === id && result.error) ||
            reach?.visited === 0
          ? ("missing" as const)
          : !reach
            ? ("loading" as const)
            : ("ready" as const);
  const heightSource = measurement?.source ?? "instrument",
    missing = region.data?.missing ?? 0;
  useEffect(() => {
    publish({ sessionId, status, reach, input, source: heightSource, missing });
  }, [publish, sessionId, status, reach, input, heightSource, missing]);
  return { reach, input, wind, source: heightSource, missing, status };
}
