"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plane } from "lucide-react";
import { api } from "~/api";
import {
  terrainProfileSections,
  profileAircraftDistance,
  type flightPlanProfile,
} from "~/domain/flight-plan-profile";
import { useT } from "~/i18n/use-t";
import { useTerrainHeight } from "./use-terrain-height";
import type { GpsFix } from "./use-gps";

/** Distance/AMSL chart of the active FPL, not a straight shortcut through its curved legs. */
export function FplVerticalProfile({
  profile,
  fix,
  activeLeg,
}: {
  profile: ReturnType<typeof flightPlanProfile>;
  fix: GpsFix | null;
  activeLeg: number;
}) {
  const t = useT();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(timer);
  }, []);
  const current =
    fix && now - Date.parse(fix.time) <= 20000 && !fix.paused ? fix : null;
  const { mslFt } = useTerrainHeight(current);
  const points = useMemo(
    () => profile.samples.map(({ lat, lon }) => ({ lat, lon })),
    [profile.samples],
  );
  const terrain = useQuery({
    ...api.terrain.profile.queryOptions(points),
    enabled: points.length > 1,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const stations = profile.samples.map((sample, i) => ({
    ...sample,
    terrainFt: terrain.data?.[i] ?? null,
  }));
  const sections = terrainProfileSections(stations);
  const aircraft = current
    ? profileAircraftDistance(profile, current, activeLeg)
    : null;
  const maxFt = Math.max(
    1000,
    Math.ceil(
      (Math.max(
        mslFt ?? 0,
        ...stations.map((p) => Math.max(p.altitudeFt, p.terrainFt ?? 0)),
      ) +
        500) /
        1000,
    ) * 1000,
  );
  const width = 640,
    height = 235,
    left = 53,
    right = 17,
    top = 28,
    bottom = 30;
  const plotWidth = width - left - right,
    plotHeight = height - top - bottom;
  const total = Math.max(0.01, profile.totalNm);
  const x = (distance: number) =>
    left + (Math.max(0, Math.min(total, distance)) / total) * plotWidth;
  const y = (altitude: number) =>
    top + plotHeight - (Math.max(0, altitude) / maxFt) * plotHeight;
  const missing = stations.some((p) => p.terrainFt === null);
  const events = profile.rows.filter((row) => row.event);
  const plannedLine = profile.rows
    .map((p) => `${x(p.distanceNm)},${y(p.altitudeFt)}`)
    .join(" ");
  return (
    <section
      className="bg-background/60 shrink-0 rounded-2xl border p-3"
      data-testid="fpl-vertical-profile"
      aria-label={t("plan.route.verticalProfile")}
    >
      <h3 className="text-primary text-xs font-bold tracking-wide uppercase">
        {t("plan.route.verticalProfile")}
      </h3>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-[clamp(150px,27dvh,235px)] w-full font-mono"
        role="img"
        aria-label={t("plan.route.vp.chart")}
      >
        {[0, 1, 2, 3, 4].map((i) => (
          <g key={i} className="fill-muted-foreground text-[11px]">
            <line
              x1={left}
              x2={width - right}
              y1={y((maxFt * i) / 4)}
              y2={y((maxFt * i) / 4)}
              stroke="currentColor"
              strokeOpacity="0.15"
            />
            <text x={left - 7} y={y((maxFt * i) / 4) + 4} textAnchor="end">
              {Math.round((maxFt * i) / 4)}
            </text>
            <text x={x((total * i) / 4)} y={height - 8} textAnchor="middle">
              {((total * i) / 4).toFixed(1)}
            </text>
          </g>
        ))}
        <text x={left} y={13} className="fill-muted-foreground text-[10px]">
          ft AMSL
        </text>
        <text
          x={width - right}
          y={height - 8}
          className="fill-muted-foreground text-[10px]"
          textAnchor="end"
        >
          NM
        </text>
        {sections.map(
          (section, i) =>
            section.length > 1 && (
              <polygon
                key={i}
                data-terrain-section
                points={`${x(section[0]!.distanceNm)},${y(0)} ${section.map((p) => `${x(p.distanceNm)},${y(p.terrainFt!)}`).join(" ")} ${x(section.at(-1)!.distanceNm)},${y(0)}`}
                fill="#a07949"
                fillOpacity="0.55"
                stroke="#d4a76a"
                strokeWidth="1"
              />
            ),
        )}
        <polyline
          data-profile-flight-path
          points={plannedLine}
          fill="none"
          stroke="#ee55ee"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        {events.map((row, i) => (
          <g
            key={`${row.event}-${i}`}
            className="fill-primary text-[11px] font-bold"
          >
            <circle
              cx={x(row.distanceNm)}
              cy={y(row.altitudeFt)}
              r="3"
              fill="currentColor"
            />
            <text
              x={x(row.distanceNm)}
              y={y(row.altitudeFt) - (row.event === "TOC" ? 9 : -17)}
              textAnchor="middle"
            >
              {row.event}
            </text>
          </g>
        ))}
        {aircraft && (
          <line
            data-profile-aircraft-position
            x1={x(aircraft.distanceNm)}
            x2={x(aircraft.distanceNm)}
            y1={top}
            y2={y(0)}
            stroke="#5ed4ff"
            strokeDasharray="3 4"
            strokeOpacity="0.7"
          />
        )}
        {aircraft && mslFt !== null && (
          <g
            data-profile-aircraft
            data-distance-nm={aircraft.distanceNm.toFixed(3)}
            data-altitude-ft={Math.round(mslFt)}
            transform={`translate(${x(aircraft.distanceNm)},${y(mslFt)})`}
          >
            <title>
              {t("fly.profile.aircraft", { altitude: Math.round(mslFt) })}
            </title>
            <Plane
              x={-10}
              y={-10}
              width={20}
              height={20}
              transform="rotate(45)"
              fill="#5ed4ff"
              stroke="#07111f"
              strokeWidth={1.5}
            />
          </g>
        )}
      </svg>
      <div className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-[11px]">
        <span className="text-fuchsia-300">{t("fly.profile.planned")}</span>
        <span className="text-amber-300">{t("fly.profile.terrain")}</span>
        {aircraft && mslFt !== null && (
          <span className="text-sky-300">
            {t("fly.profile.aircraft", { altitude: Math.round(mslFt) })}
          </span>
        )}
      </div>
      {(!aircraft || mslFt === null) && (
        <p className="text-muted-foreground mt-1 text-[11px]">
          {t("fly.profile.noPosition")}
        </p>
      )}
      {aircraft && aircraft.crossTrackNm > 0.5 && (
        <p className="mt-1 text-[11px] text-amber-300">
          {t("fly.profile.offRoute", {
            distance: aircraft.crossTrackNm.toFixed(1),
          })}
        </p>
      )}
      {(terrain.isFetching || missing) && (
        <p className="text-muted-foreground mt-1 text-[11px]" role="status">
          {t(
            terrain.isFetching ? "fly.profile.loading" : "fly.profile.missing",
          )}
        </p>
      )}
      <p className="text-muted-foreground mt-1 text-[10px]">
        {t("terrain.source")}
      </p>
    </section>
  );
}
