import { useEffect } from "react";
import { isRunning } from "~/domain/flight-timers";
import { useInFlight } from "~/stores/inflight";
import { useWind } from "~/stores/wind";
import { useGps } from "./use-gps";

/** Feed the shared estimator at native GPS cadence, before the flight track's 5 s decimation. */
export function useWindEstimation() {
  const session = useInFlight((s) => s.startedAt);
  const airborne = useInFlight((s) => isRunning(s.timers.airTime));
  const { fix, error } = useGps(session !== null);
  useEffect(() => {
    useWind.getState().observe(
      session,
      airborne,
      fix &&
        !fix.paused &&
        fix.source !== "connector" &&
        fix.source !== "demo" &&
        !error &&
        fix.groundSpeedKt !== null &&
        fix.trackDeg !== null &&
        fix.altitudeFt !== null
        ? {
            source: fix.source ?? "gps",
            at: Date.parse(fix.time),
            speedMps: (fix.groundSpeedKt * 1852) / 3600,
            trackDeg: fix.trackDeg,
            altitudeM: fix.altitudeFt * 0.3048,
            accuracyM: fix.accuracyM,
          }
        : null,
      Date.now(),
    );
  }, [session, airborne, fix, error]);
}
