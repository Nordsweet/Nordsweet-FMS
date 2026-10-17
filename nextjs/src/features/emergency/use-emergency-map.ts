"use client";
import { useMemo } from "react";
import { type Airport } from "~/data/schemas";
import { type GpsFix } from "~/features/fly/use-gps";
import { useEmergency, emergencyScope } from "~/stores/emergency";
import { useFlight } from "~/stores/flight";
import { useInFlight } from "~/stores/inflight";
import { usePlan } from "~/features/plan/use-plan";
import {
  emergencyApproach,
  emergencyCandidates,
  emergencyRange,
} from "~/domain/emergency";
import { destinationPoint, distanceNm } from "~/domain/geo";

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
  const range =
    active && fresh
      ? emergencyRange(measurements, target?.threshold.elevationFt ?? null, now)
      : null;
  const reachable = useMemo(() => {
    if (!active || !fix || !fresh) return [];
    // A straight-line lower bound avoids solving curves for obviously unreachable distant airports.
    const nearby = airports.filter((a) =>
      a.runways.some((r) => {
        const candidateRange = emergencyRange(
          measurements,
          r.threshold?.elevationFt ?? null,
          now,
        );
        return (
          r.threshold &&
          candidateRange &&
          candidateRange.heightFt > 0 &&
          distanceNm(fix, r.threshold) <= candidateRange.radiusNm
        );
      }),
    );
    return emergencyCandidates(nearby, fix, fix.groundSpeedKt)
      .filter((c) => {
        const candidateRange = emergencyRange(
          measurements,
          c.target.threshold.elevationFt,
          now,
        );
        return (
          candidateRange &&
          candidateRange.heightFt > 0 &&
          c.approach.distanceNm <= candidateRange.radiusNm
        );
      })
      .map((c) => airports.find((a) => a.ident === c.target.airport)!)
      .filter((a, i, all) => all.findIndex((b) => b.ident === a.ident) === i);
  }, [active, airports, fix, fresh, measurements, now]);
  return {
    active,
    target,
    range,
    path: active && fresh && approach ? approach.points : [],
    preview: !!session?.previewOnly,
    circle:
      range && fix
        ? Array.from({ length: 97 }, (_, i) =>
            destinationPoint(fix, (i * 360) / 96, range.radiusNm),
          )
        : [],
    reachable: active && fresh ? reachable : [],
  };
}
