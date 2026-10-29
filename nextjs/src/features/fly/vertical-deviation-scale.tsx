"use client";

import { useEffect, useMemo, useState } from "react";
import { distanceNm } from "~/domain/geo";
import {
  flightPlanProfile,
  profileAircraftDistance,
  profileAltitudeAtDistance,
} from "~/domain/flight-plan-profile";
import type { TurnPerformance } from "~/domain/fly-by";
import type { NavPoint } from "~/domain/progress";
import type { RoutePlan } from "~/domain/route-plan";
import { useT } from "~/i18n/use-t";
import type { GpsFix } from "./use-gps";
import { useTerrainHeight } from "./use-terrain-height";

/** Aircraft height relative to the planned FPL line, in the same AMSL datum. */
export function VerticalDeviationScale({
  route,
  plan,
  performance,
  cruiseAltitudeFt,
  activeLeg,
  fix,
  holding,
}: {
  route: NavPoint[];
  plan: RoutePlan | null;
  performance: TurnPerformance;
  cruiseAltitudeFt: number;
  activeLeg: number;
  fix: GpsFix | null;
  holding: boolean;
}) {
  const t = useT();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const age = fix ? now - Date.parse(fix.time) : Infinity;
  const current =
    fix && !fix.paused && age >= -5000 && age <= 20000 ? fix : null;
  const { mslFt } = useTerrainHeight(current);
  const profile = useMemo(
    () =>
      plan
        ? flightPlanProfile(route, plan, performance, cruiseAltitudeFt)
        : null,
    [route, plan, performance, cruiseAltitudeFt],
  );
  const matches = (point: NavPoint | undefined) =>
    point &&
    plan?.points.some((p) => !p.isProfilePoint && distanceNm(p, point) < 0.3);
  const projection =
    profile &&
    current &&
    !holding &&
    matches(route[activeLeg]) &&
    matches(route[activeLeg + 1])
      ? profileAircraftDistance(profile, current, activeLeg)
      : null;
  const planned =
    projection && profile
      ? profileAltitudeAtDistance(profile, projection.distanceNm)
      : null;
  const deviation =
    planned !== null && mslFt !== null && Number.isFinite(mslFt)
      ? mslFt - planned
      : null;
  const y =
    deviation === null
      ? 90
      : 90 - Math.max(-1000, Math.min(1000, deviation)) * 0.07;
  const label =
    deviation === null
      ? t("fly.deviation.unavailable")
      : t("fly.deviation.value", {
          deviation: Math.round(deviation),
          altitude: Math.round(planned!),
        });
  return (
    <div
      data-testid="vertical-deviation"
      data-deviation-ft={deviation === null ? "" : Math.round(deviation)}
      role="img"
      aria-label={label}
      title={label}
      className="pointer-events-none absolute top-1/2 right-[5.25rem] z-20 -translate-y-1/2 rounded-lg bg-slate-950/75 px-1 py-2 shadow-sm"
    >
      <svg viewBox="0 0 70 180" className="h-44 w-[4.25rem]" aria-hidden="true">
        <path
          d="M 36 20 V 160 M 12 20 H 36 M 22 55 H 36 M 12 90 H 36 M 22 125 H 36 M 12 160 H 36"
          fill="none"
          stroke="white"
          strokeWidth="3"
        />
        {deviation !== null && (
          <path
            data-deviation-pointer
            d={`M 36 ${y} l 13 -8 l 13 8 l -13 8 Z`}
            fill="#081222"
            stroke="#ef45d6"
            strokeWidth="3"
          />
        )}
      </svg>
    </div>
  );
}
