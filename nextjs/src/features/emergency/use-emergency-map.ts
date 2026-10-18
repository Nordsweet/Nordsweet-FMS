"use client";
import { useMemo } from "react";
import { type Airport } from "~/data/schemas";
import { type GpsFix } from "~/features/fly/use-gps";
import { useEmergency, emergencyScope } from "~/stores/emergency";
import { useFlight } from "~/stores/flight";
import { useInFlight } from "~/stores/inflight";
import { usePlan } from "~/features/plan/use-plan";
import { emergencyApproach, emergencyCandidates } from "~/domain/emergency";
import { distanceNm } from "~/domain/geo";
import { useGlideReach } from "./use-glide-reach";
import { glideApproachClear } from "~/domain/glide-reach";

/** Live overlays are recomputed from fresh inputs; persisted targets never reactivate stale guidance. */
export function useEmergencyMap(
  airports: readonly Airport[],
  fix: GpsFix | null,
  error: unknown,
  now: number,
) {
  const { session, measurements } = useEmergency();
  const flight = useFlight((s) => s.flight);
  const startedAt = useInFlight((s) => s.startedAt);
  const { aircraft } = usePlan();
  const active =
    session?.scope ===
      emergencyScope(
        flight.id,
        aircraft?.id ?? flight.aircraftId,
        startedAt,
        flight.registration,
      ) &&
    session.family === "failure" &&
    session.routeRequested &&
    session.endedAt === null;
  now = Math.max(now, fix?.receivedAt ?? now);
  const fresh =
    !!fix &&
    !error &&
    // The one-second UI clock may trail a just-received browser fix.
    now - Date.parse(fix.time) >= -1000 &&
    now - Date.parse(fix.time) <= 20_000;
  const target = active ? session.target : null;
  const approach = useMemo(
    () =>
      target && fix ? emergencyApproach(fix, target, fix.groundSpeedKt) : null,
    [fix, target],
  );
  const glide = useGlideReach(
    active && fresh,
    active ? session.id : null,
    fix,
    measurements,
    now,
  );
  const reachable = useMemo(() => {
    if (!active || !fix || !fresh || !glide.reach || !glide.input) return [];
    const nearby = airports.filter((a) =>
      a.runways.some(
        (r) =>
          r.threshold &&
          distanceNm(fix, r.threshold) * 1852 <= glide.input!.radiusM,
      ),
    );
    return emergencyCandidates(nearby, fix, glide.input.tasKt)
      .filter((candidate) =>
        glideApproachClear(
          glide.reach!,
          glide.input!,
          candidate.approach.points,
          candidate.target.threshold,
        ),
      )
      .map((candidate) =>
        airports.find((a) => a.ident === candidate.target.airport)!,
      )
      .filter((a, i, all) => all.findIndex((b) => b.ident === a.ident) === i);
  }, [active, airports, fix, fresh, glide.reach, glide.input]);
  return {
    active,
    target,
    path: active && fresh && approach ? approach.points : [],
    preview:
      !!session?.previewOnly ||
      !approach ||
      !target ||
      !glide.reach ||
      !glide.input ||
      !glideApproachClear(
        glide.reach,
        glide.input,
        approach.points,
        target.threshold,
      ),
    footprint: glide.reach?.polygons ?? [],
    boundary: glide.reach?.paths ?? [],
    glide,
    reachable: active && fresh ? reachable : [],
  };
}
