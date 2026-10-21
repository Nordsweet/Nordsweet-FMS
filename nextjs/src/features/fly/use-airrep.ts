import { useEffect } from "react";
import { AviationApiError, aviationApi } from "~/api/aviation/client";
import { airrepSchema } from "~/data/airrep";
import { useAuth } from "~/stores/auth";
import { useAirrep } from "~/stores/airrep";
import { useWind } from "~/stores/wind";
import { windStatus } from "~/domain/wind-estimation";
import { distanceNm } from "~/domain/geo";
import { type NavPoint } from "~/domain/progress";
import { type GpsFix } from "./use-gps";

/** Called only by automatic sequencing; manual Skip/Set Next never creates a report. */
export function recordAirrep(
  session: string,
  route: NavPoint[],
  index: number,
  fix: GpsFix,
) {
  const owner = useAuth.getState().session?.username;
  const wind = useWind.getState();
  const estimate = wind.state.estimate;
  const point = route[index];
  const at = Date.parse(fix.time);
  if (
    !owner ||
    !point ||
    point.ident === "DCT" ||
    wind.session !== session ||
    !estimate ||
    wind.position?.at !== estimate.at ||
    windStatus(wind.state, at) !== "valid" ||
    !["gps", "connector"].includes(fix.source ?? "gps") ||
    distanceNm(point, fix) > 3
  )
    return;
  const occurrence = route
    .slice(0, index + 1)
    .filter(
      (p) =>
        p.ident === point.ident && p.lat === point.lat && p.lon === point.lon,
    ).length;
  const ident = point.ident.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 64);
  const id = `${Date.parse(session)}.${wind.mode}.${ident}.${point.lat.toFixed(5)}.${point.lon.toFixed(5)}.${occurrence}`;
  const parsed = airrepSchema.safeParse({
    id,
    flight_started_at: session,
    waypoint: point.ident,
    passed_at: new Date(at).toISOString(),
    observed_at: new Date(estimate.at).toISOString(),
    source: wind.mode,
    lat: wind.position.lat,
    lon: wind.position.lon,
    altitude_ft: estimate.altitudeM / 0.3048,
    wind_from_deg: estimate.fromDeg,
    wind_speed_kt: (estimate.speedMps * 3600) / 1852,
    residual_kt: (estimate.residualMps * 3600) / 1852,
  });
  if (parsed.success) useAirrep.getState().enqueue(owner, parsed.data);
}

/** One in-flight uploader retries on connectivity changes and leaves failed writes on disk. */
export function useAirrepUpload() {
  useEffect(() => {
    let stopped = false;
    let busy = false;
    const flush = async () => {
      if (busy || stopped || !navigator.onLine) return;
      busy = true;
      try {
        const session = useAuth.getState().session;
        if (!session) return;
        for (const entry of useAirrep
          .getState()
          .pending.filter((e) => e.owner === session.username)) {
          if (stopped || useAuth.getState().session?.token !== session.token)
            break;
          const report = airrepSchema.parse(entry.report);
          try {
            await aviationApi.submitAirrep(report, AbortSignal.timeout(15000));
          } catch (error) {
            // Another device already archived this passage: first observation wins.
            if (!(error instanceof AviationApiError && error.status === 409))
              throw error;
          }
          useAirrep.getState().acknowledge(entry.owner, report.id);
        }
      } catch {
        // Offline/server failures leave the original observation intact for the next wake.
      } finally {
        busy = false;
      }
    };
    const wake = () => {
      void flush();
    };
    const unsubscribe = useAirrep.subscribe(wake);
    const auth = useAuth.subscribe(wake);
    const timer = setInterval(wake, 30000);
    window.addEventListener("online", wake);
    document.addEventListener("visibilitychange", wake);
    wake();
    return () => {
      stopped = true;
      unsubscribe();
      auth();
      clearInterval(timer);
      window.removeEventListener("online", wake);
      document.removeEventListener("visibilitychange", wake);
    };
  }, []);
}
