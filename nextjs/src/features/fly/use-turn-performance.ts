import { turnPerformance } from "~/domain/fly-by";
import { usePlan } from "~/features/plan/use-plan";
import { type GpsFix } from "./use-gps";
import { useInFlight } from "~/stores/inflight";
import { useEffect, useState } from "react";
import { routeSpeedProfile } from "~/domain/route-speed-profile";

/** Shared speed/wind inputs for map geometry, leg sequencing, and navigation readouts. */
export function useTurnPerformance(fix: GpsFix | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(timer);
  }, []);
  const { cruiseSpeedKt, plan, aircraft } = usePlan();
  const phase = useInFlight((s) => s.phase);
  const next = useInFlight((s) => s.route[s.activeLeg + 1]?.ident);
  const index = plan?.legs.findIndex((leg) => leg.to.id === next) ?? -1;
  const wind = plan?.legWinds[Math.max(0, index)]?.wind;
  const current = fix && now - Date.parse(fix.time) <= 20000 ? fix : null;
  const profile = routeSpeedProfile(
    plan,
    aircraft,
    cruiseSpeedKt,
    current?.altitudeFt ?? plan?.altitudeFt ?? 0,
  );
  const planned = profile.phases[phase] || cruiseSpeedKt;
  const climbing = phase === "climb" || phase === "takeoff";
  const result = turnPerformance(planned, wind, climbing ? null : current);
  return {
    ...result,
    departureTasKt:
      climbing && aircraft?.type.toUpperCase() === "C172S"
        ? planned
        : undefined,
  };
}
