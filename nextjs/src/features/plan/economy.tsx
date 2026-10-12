"use client";

import { Button } from "~/components/ui/button";
import { cruiseOptions } from "~/domain/cruise";
import { computeNavLog } from "~/domain/navlog";
import { useT } from "~/i18n/use-t";
import { cn } from "~/lib/utils";
import { useFlight } from "~/stores/flight";

import { fmt, fmtMinutes } from "./fields";
import { usePlan } from "./use-plan";

/** Route economy: each POH power setting's time and fuel on this route with its winds. */
export function CruiseEconomy() {
  const t = useT();
  const update = useFlight((s) => s.update);
  const {
    flight,
    aircraft,
    route,
    legWinds,
    climbSegment,
    descentSegment,
    climbIsaDeviationC,
  } = usePlan();
  if (!aircraft?.cruise) return null;
  const isaDeviation = climbIsaDeviationC ?? 0;
  const { tableAltitudeFt, options, outsideIsaRange } = cruiseOptions(
    aircraft.cruise,
    flight.cruiseAltitudeFt,
    isaDeviation,
  );
  const rows = options.map((o) => {
    const log =
      route.length >= 2
        ? computeNavLog(route, {
            tasKt: o.ktas,
            fuelFlowLph: o.fuelFlowLph,
            wind: flight.wind,
            legWinds: legWinds?.winds,
            climb: climbSegment,
            descent: descentSegment,
          })
        : null;
    return { ...o, minutes: log?.minutes ?? null, fuelL: log?.fuelL ?? null };
  });
  const leastFuel = Math.min(...rows.map((r) => r.fuelL ?? Infinity));
  const fastest = Math.min(...rows.map((r) => r.minutes ?? Infinity));

  return (
    <div className="grid gap-2" data-testid="cruise-economy">
      <h3 className="text-sm font-medium">
        {t("plan.economy.title", {
          altitude: fmt(tableAltitudeFt),
          deviation: fmt(isaDeviation),
        })}
      </h3>
      <div className="max-h-72 overflow-auto">
        <table className="w-full min-w-[34rem] text-sm tabular-nums">
          <thead className="text-muted-foreground text-left">
            <tr>
              <th className="py-1 font-medium">{t("plan.economy.setting")}</th>
              <th className="text-right font-medium">%</th>
              <th className="text-right font-medium">KTAS</th>
              <th className="text-right font-medium">L/h</th>
              <th className="text-right font-medium">
                {t("plan.navlog.time")}
              </th>
              <th className="text-right font-medium">
                {t("plan.navlog.fuel")}
              </th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.setting} className="border-t">
                <td className="py-1">{r.setting}</td>
                <td className="text-right">{fmt(r.powerPct)}</td>
                <td className="text-right">{fmt(r.ktas)}</td>
                <td className="text-right">{fmt(r.fuelFlowLph, 1)}</td>
                <td
                  className={cn(
                    "text-right",
                    r.minutes === fastest && "text-primary font-semibold",
                  )}
                >
                  {fmtMinutes(r.minutes)}
                </td>
                <td
                  className={cn(
                    "text-right",
                    r.fuelL === leastFuel && "text-ok font-semibold",
                  )}
                >
                  {fmt(r.fuelL, 1)}
                </td>
                <td className="text-right">
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={t("plan.economy.use", { setting: r.setting })}
                    onClick={() =>
                      update({
                        cruiseTasKt: Math.round(r.ktas),
                        fuelFlowLph: Math.round(r.fuelFlowLph * 10) / 10,
                      })
                    }
                  >
                    {t("plan.economy.useShort")}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-muted-foreground text-xs">
        {t("plan.economy.note")}
        {outsideIsaRange && (
          <span className="text-destructive">
            {" "}
            {t("plan.economy.outsideIsa")}
          </span>
        )}
        {aircraft.cruise.draft && (
          <span className="text-destructive">
            {" "}
            {t("plan.perf.warning.draft-data")}
          </span>
        )}
      </p>
    </div>
  );
}
