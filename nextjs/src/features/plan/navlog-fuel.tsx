"use client";

import { useT } from "~/i18n/use-t";
import { cn } from "~/lib/utils";
import { useFlight } from "~/stores/flight";

import { NumberField, Section, fmt, fmtMinutes } from "./fields";
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

export function FuelSection() {
  const t = useT();
  const flight = useFlight((s) => s.flight);
  const update = useFlight((s) => s.update);
  const { fuelPlan, aircraft } = usePlan();
  const fuel = flight.fuel;
  const rows = fuelPlan
    ? ([
        ["trip", fuelPlan.tripL],
        ["contingency", fuelPlan.contingencyL],
        ["taxi", fuelPlan.taxiL],
        ["climbExtra", fuelPlan.climbExtraL],
        ["departureArrival", fuelPlan.departureArrivalL],
        ["alternate", fuelPlan.alternateL],
        ["finalReserve", fuelPlan.finalReserveL],
      ] as const)
    : [];
  const overCapacity =
    aircraft?.usableFuelL !== null &&
    aircraft?.usableFuelL !== undefined &&
    fuel.blockL > aircraft.usableFuelL;

  return (
    <Section title={t("plan.fuel.title")}>
      <div className="grid gap-4 sm:grid-cols-3">
        <NumberField
          label={t("plan.fuel.block")}
          unit="L"
          min={0}
          value={fuel.blockL}
          onChange={(blockL) => update({ fuel: { ...fuel, blockL } })}
        />
        <NumberField
          label={t("plan.fuel.taxi")}
          unit="L"
          min={0}
          value={fuel.taxiL}
          onChange={(taxiL) => update({ fuel: { ...fuel, taxiL } })}
        />
        <NumberField
          label={t("plan.fuel.climbExtra")}
          unit="L"
          min={0}
          value={fuel.climbExtraL}
          onChange={(climbExtraL) => update({ fuel: { ...fuel, climbExtraL } })}
        />
      </div>
      {overCapacity && (
        <p className="text-destructive text-sm">
          {t("plan.fuel.overCapacity")}
        </p>
      )}
      {fuelPlan && (
        <table className="w-full text-sm tabular-nums">
          <tbody>
            {rows.map(([key, litres]) => (
              <tr key={key} className="border-t">
                <td className="py-1">{t(`plan.fuel.row.${key}`)}</td>
                <td className="text-right">{litres} L</td>
              </tr>
            ))}
            <tr className="border-t font-medium">
              <td className="py-1">{t("plan.fuel.minimum")}</td>
              <td className="text-right">{fuelPlan.minimumL} L</td>
            </tr>
            <tr
              className={cn(
                "font-medium",
                fuelPlan.extraL < 0 ? "text-destructive" : "text-ok",
              )}
            >
              <td className="py-1">
                {fuelPlan.extraL < 0
                  ? t("plan.fuel.short")
                  : t("plan.fuel.extra")}
              </td>
              <td className="text-right" data-testid="fuel-extra">
                {fuelPlan.extraL} L
              </td>
            </tr>
          </tbody>
        </table>
      )}
    </Section>
  );
}
