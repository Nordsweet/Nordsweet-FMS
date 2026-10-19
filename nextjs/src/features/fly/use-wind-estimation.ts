import { useEffect } from "react";
import { isRunning } from "~/domain/flight-timers";
import { useInFlight } from "~/stores/inflight";
import { useWind } from "~/stores/wind";
import { useGps } from "./use-gps";
import { usePositionSource } from "~/stores/position-source";

/** Native GPS circle fitting and P3D instrument wind share the live position stream, not track decimation. */
export function useWindEstimation() {
  const session = useInFlight((s) => s.startedAt);
  const airborne = useInFlight((s) => isRunning(s.timers.airTime));
  const source = usePositionSource((s) => s.source);
  const { fix, error } = useGps(session !== null || source === "connector");
  useEffect(() => {
    if (source === "connector") {
      useWind.getState().observeSimulator(
        session,
        fix?.source === "connector" &&
          !fix.paused &&
          !error &&
          fix.groundSpeedKt !== null &&
          fix.trackDeg !== null &&
          fix.altitudeFt !== null &&
          fix.trueAirspeedKt !== undefined &&
          fix.headingTrueDeg !== undefined &&
          fix.onGround === false
          ? {
              at: Date.parse(fix.time),
              altitudeFt: fix.altitudeFt,
              groundSpeedKt: fix.groundSpeedKt,
              trackTrueDeg: fix.trackDeg,
              trueAirspeedKt: fix.trueAirspeedKt,
              headingTrueDeg: fix.headingTrueDeg,
              onGround: false,
            }
          : null,
        Date.now(),
      );
      return;
    }
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
  }, [session, airborne, fix, error, source]);
}
