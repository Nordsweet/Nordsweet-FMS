"use client";

import { useT } from "~/i18n/use-t";

import { Section, fmt, fmtMinutes } from "./fields";
import { usePlan } from "./use-plan";

export function NavLogSection() {
  const t = useT();
  const { navLog, climb, climbIsaDeviationC, flight } = usePlan();
  return (
    <Section title={t("plan.navlog.title")}>
      {!navLog ? (
        <p className="text-muted-foreground text-sm">
          {t("plan.navlog.empty")}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[34rem] text-sm tabular-nums">
            <thead className="text-muted-foreground text-left">
              <tr>
                <th className="py-1 font-medium">{t("plan.navlog.leg")}</th>
                <th className="text-right font-medium">
                  {t("plan.navlog.distance")}
                </th>
                <th className="text-right font-medium">
                  {t("plan.navlog.mc")}
                </th>
                <th className="text-right font-medium">
                  {t("plan.navlog.wind")}
                </th>
                <th className="text-right font-medium">
                  {t("plan.navlog.mh")}
                </th>
                <th className="text-right font-medium">
                  {t("plan.navlog.gs")}
                </th>
                <th className="text-right font-medium">
                  {t("plan.navlog.time")}
                </th>
                <th className="text-right font-medium">
                  {t("plan.navlog.fuel")}
                </th>
              </tr>
            </thead>
            <tbody>
              {navLog.legs.map((leg, i) => (
                <tr key={i} className="border-t">
                  <td className="py-1 font-mono">
                    {leg.from.ident} → {leg.to.ident}
                    {leg.phase !== "cruise" && (
                      <span className="text-muted-foreground font-sans text-xs">
                        {" "}
                        {t(`plan.navlog.phase.${leg.phase}`)}
                      </span>
                    )}
                  </td>
                  <td className="text-right">{fmt(leg.distanceNm, 1)}</td>
                  <td className="text-right">
                    {fmt(leg.magneticCourseDeg).padStart(3, "0")}°
                  </td>
                  <td className="text-right">
                    {fmt(leg.wind.directionDeg).padStart(3, "0")}/
                    {fmt(leg.wind.speedKt)}
                  </td>
                  <td className="text-right">
                    {leg.magneticHeadingDeg === null
                      ? "—"
                      : `${fmt(leg.magneticHeadingDeg).padStart(3, "0")}°`}
                  </td>
                  <td className="text-right">{fmt(leg.groundSpeedKt)}</td>
                  <td className="text-right">{fmtMinutes(leg.minutes)}</td>
                  <td className="text-right">{fmt(leg.fuelL, 1)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="font-medium">
              <tr className="border-t">
                <td className="py-1">{t("plan.navlog.total")}</td>
                <td className="text-right">{fmt(navLog.distanceNm, 1)}</td>
                <td colSpan={4} />
                <td className="text-right">{fmtMinutes(navLog.minutes)}</td>
                <td className="text-right">{fmt(navLog.fuelL, 1)}</td>
              </tr>
            </tfoot>
          </table>
          {navLog.minutes === null && (
            <p className="text-destructive mt-2 text-sm">
              {t("plan.navlog.impossible")}
            </p>
          )}
          {navLog.cruiseNotReached && (
            <p className="text-destructive mt-2 text-sm">
              {t("plan.navlog.cruiseNotReached")}
            </p>
          )}
          <div
            className="text-muted-foreground mt-2 grid gap-1 text-xs"
            data-testid="climb-summary"
          >
            {climb ? (
              <p>
                {t("plan.navlog.climb", {
                  minutes: fmt(climb.minutes),
                  altitude: fmt(climb.reachedFt),
                  tas: fmt(climb.averageTasKt),
                  flow:
                    climb.fuelFlowLph === null
                      ? `${fmt(flight.fuelFlowLph)}*`
                      : fmt(climb.fuelFlowLph),
                })}{" "}
                {climbIsaDeviationC === null
                  ? t("plan.navlog.climbIsa")
                  : t("plan.navlog.climbMetar", {
                      deviation: fmt(climbIsaDeviationC),
                    })}
              </p>
            ) : (
              <p>{t("plan.navlog.noClimbData")}</p>
            )}
            {climb?.warnings.map((w, i) => (
              <p key={i} className="text-destructive">
                ⚠{" "}
                {w.code === "ceiling"
                  ? t("plan.navlog.warning.ceiling", {
                      altitude: fmt(w.altitudeFt),
                    })
                  : w.code === "above-table"
                    ? t("plan.perf.warning.above-table", {
                        axis: t(`plan.perf.axis.${w.axis}`),
                        value: fmt(w.value),
                        max: fmt(w.max),
                      })
                    : w.code === "no-fuel-flow"
                      ? t("plan.navlog.warning.noFuelFlow")
                      : t("plan.perf.warning.draft-data")}
              </p>
            ))}
            <p>{t("plan.navlog.note")}</p>
          </div>
        </div>
      )}
    </Section>
  );
}
