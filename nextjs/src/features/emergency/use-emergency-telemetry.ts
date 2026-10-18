"use client";
import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "~/api";
import { useEmergency, emergencyScope } from "~/stores/emergency";
import { useFlight } from "~/stores/flight";
import { useInFlight } from "~/stores/inflight";
import { usePlan } from "~/features/plan/use-plan";
import { useGps } from "~/features/fly/use-gps";
import { geoidSeparationM, gnssAltitudeTrend } from "~/domain/terrain";

/** GNSS height is corrected to EGM96; missing accuracy/height never creates a synthetic descent. */
export function useEmergencyTelemetry() {
  const session = useEmergency((s) => s.session),
    measure = useEmergency((s) => s.measure);
  const flight = useFlight((s) => s.flight),
    startedAt = useInFlight((s) => s.startedAt);
  const { aircraft } = usePlan();
  const active =
    !!session &&
    session.scope ===
      emergencyScope(
        flight.id,
        aircraft?.id ?? flight.aircraftId,
        startedAt,
        flight.registration,
      ) &&
    session.family === "failure" &&
    session.routeRequested;
  const { fix, error } = useGps(active);
  const geoid = useQuery({
    ...api.terrain.geoid.queryOptions(undefined),
    enabled: active,
  }).data;
  const buffer = useRef<{
    id: string;
    samples: { at: number; altitudeM: number }[];
  }>({ id: "", samples: [] });
  useEffect(() => {
    if (!active || !session || !fix || error || !geoid) return;
    if (buffer.current.id !== session.id)
      buffer.current = { id: session.id, samples: [] };
    const at = Date.parse(fix.time),
      age = Date.now() - at;
    if (
      fix.source === "replay" ||
      age < -1000 ||
      age > 20_000 ||
      fix.altitudeFt === null ||
      !Number.isFinite(fix.altitudeFt) ||
      fix.altitudeAccuracyM == null ||
      !Number.isFinite(fix.altitudeAccuracyM) ||
      !Number.isFinite(fix.accuracyM) ||
      fix.altitudeAccuracyM <= 0 ||
      fix.altitudeAccuracyM > 30 ||
      fix.accuracyM > 100 ||
      fix.groundSpeedKt === null ||
      fix.trackDeg === null
    ) {
      buffer.current.samples = [];
      return;
    }
    const separation = geoidSeparationM(geoid, fix);
    if (separation === null) return;
    const last = buffer.current.samples.at(-1);
    if (last && at <= last.at) return;
    if (last && at - last.at > 5000) buffer.current.samples = [];
    const samples = [
      ...buffer.current.samples.filter((s) => at - s.at <= 10_000),
      { at, altitudeM: fix.altitudeFt * 0.3048 - separation },
    ];
    buffer.current.samples = samples;
    const trend = gnssAltitudeTrend(samples);
    if (!trend) return;
    const instrument = [...useEmergency.getState().measurements]
      .reverse()
      .find((s) => s.source !== "gnss-egm96");
    if (instrument && Date.now() - instrument.at <= 20_000) return;
    const previous = useEmergency.getState().measurements.at(-1);
    if (previous && at - previous.at < 10000) return;
    measure({
      at,
      lat: fix.lat,
      lon: fix.lon,
      source: "gnss-egm96",
      altitudeDatum: "AMSL",
      altitudeAmslFt: trend.altitudeM / 0.3048,
      verticalSpeedFpm: trend.verticalSpeedFpm,
      groundSpeedKt: fix.groundSpeedKt,
      trackDeg: fix.trackDeg,
    });
  }, [active, session, fix, error, geoid, measure]);
}
