"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { GpsFix } from "~/features/fly/use-gps";
import { useTerrainHeight } from "~/features/fly/use-terrain-height";
import { descentGlideAvailable } from "~/domain/descent-glide";
import type { EmergencyMeasurement } from "~/domain/emergency";
import { useInFlight } from "~/stores/inflight";
import { useFlight } from "~/stores/flight";
import { useGlideReach } from "./use-glide-reach";

type Sample = { scope: string; fix: GpsFix; measurement: EmergencyMeasurement };

/** Sample the live descent without continually superseding terrain-worker jobs or emergency state. */
export function useDescentGlide(
  fix: GpsFix | null,
  error: unknown,
  now: number,
  enabled: boolean,
) {
  const { mslFt } = useTerrainHeight(enabled ? fix : null);
  const startedAt = useInFlight((s) => s.startedAt);
  const flightId = useFlight((s) => s.flight.id);
  const scope = "descent:" + flightId + ":" + (startedAt ?? "map");
  const active =
    enabled &&
    !error &&
    descentGlideAvailable(fix, mslFt, Math.max(now, fix?.receivedAt ?? now));
  const latest = useRef({ fix, mslFt, active, scope });
  useEffect(() => {
    latest.current = { fix, mslFt, active, scope };
  }, [fix, mslFt, active, scope]);
  const [sample, setSample] = useState<Sample | null>(null);
  useEffect(() => {
    const timer = setInterval(() => {
      const current = latest.current;
      const fix = current.fix;
      if (
        !current.active ||
        !fix ||
        !descentGlideAvailable(fix, current.mslFt, Date.now())
      ) {
        setSample(null);
        return;
      }
      const at = Date.parse(fix.time);
      setSample((previous) =>
        previous?.scope === current.scope &&
        previous.fix.source === fix.source &&
        at - previous.measurement.at < 10000
          ? previous
          : {
              scope: current.scope,
              fix,
              measurement: {
                at,
                lat: fix.lat,
                lon: fix.lon,
                source:
                  fix.source === "connector" || fix.source === "demo"
                    ? "instrument"
                    : "gnss-egm96",
                altitudeDatum: "AMSL",
                altitudeAmslFt: current.mslFt,
                verticalSpeedFpm: fix.verticalSpeedFpm ?? null,
                groundSpeedKt: fix.groundSpeedKt,
                trackDeg: fix.trackDeg,
              },
            },
      );
    }, 1000);
    return () => clearInterval(timer);
  }, []);
  const samples = useMemo(
    () => (sample?.scope === scope ? [sample.measurement] : []),
    [sample, scope],
  );
  return useGlideReach(
    active && samples.length > 0 && sample?.fix.source === fix?.source,
    enabled ? scope : null,
    sample?.fix ?? null,
    samples,
    now,
    false,
  );
}
