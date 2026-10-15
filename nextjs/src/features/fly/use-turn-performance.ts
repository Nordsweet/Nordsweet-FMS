import { turnPerformance } from "~/domain/fly-by";
import { usePlan } from "~/features/plan/use-plan";
import { type GpsFix } from "./use-gps";
import { useInFlight } from "~/stores/inflight";
import { useEffect, useState } from "react";

/** Shared speed/wind inputs for map geometry, leg sequencing, and navigation readouts. */
export function useTurnPerformance(fix: GpsFix | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(timer);
  }, []);
  const { cruiseSpeedKt, plan } = usePlan();
  const next = useInFlight((s) => s.route[s.activeLeg + 1]?.ident);
  const index = plan?.legs.findIndex((leg) => leg.to.id === next) ?? -1;
  const wind = plan?.legWinds[Math.max(0, index)]?.wind;
  const current = fix && now - Date.parse(fix.time) <= 20000 ? fix : null;
  return turnPerformance(cruiseSpeedKt, wind, current);
}
