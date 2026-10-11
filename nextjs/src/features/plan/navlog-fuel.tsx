"use client";

import { useT } from "~/i18n/use-t";
import { cn } from "~/lib/utils";
import { useFlight } from "~/stores/flight";

import { NumberField, Section, fmt, fmtMinutes } from "./fields";
import { usePlan } from "./use-plan";

export function NavLogSection() {
  const t = useT();
  const { navLog } = usePlan();
  return (
    <Section title={t("plan.navlog.title")}>
      {!navLog ? (
        <p className="text-muted-foreground text-sm">
          {t("plan.navlog.empty")}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm tabular-nums">
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
          <p className="text-muted-foreground mt-2 text-xs">
            {t("plan.navlog.note")}
          </p>
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
                fuelPlan.extraL < 0 ? "text-destructive" : "text-emerald-500",
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
