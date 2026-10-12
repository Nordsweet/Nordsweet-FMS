"use client";

import { type LoadingResult } from "~/domain/weight-balance";
import { useT } from "~/i18n/use-t";
import { cn } from "~/lib/utils";
import { useFlight } from "~/stores/flight";

import { NumberField, Section, fmt } from "./fields";
import { usePlan } from "./use-plan";

function Status({
  label,
  fuelL,
  result,
  mtowKg,
}: {
  label: string;
  fuelL: number;
  result: LoadingResult;
  mtowKg: number;
}) {
  const t = useT();
  const ok = result.withinEnvelope && !result.overMtow;
  return (
    <div
      className={cn(
        "rounded-lg border p-3 text-sm",
        ok ? "border-ok/50" : "border-destructive",
      )}
      data-testid={`wb-${label}`}
    >
      <div className="font-medium">
        {t(`plan.wb.${label}` as "plan.wb.takeoff")}
      </div>
      <div className="tabular-nums">
        {fmt(result.totalKg)} / {fmt(mtowKg)} kg · CG {fmt(result.cgM, 3)} m ·{" "}
        {t("plan.wb.fuel")} {fmt(fuelL)} L
      </div>
      <div className={ok ? "text-ok" : "text-destructive"}>
        {result.overMtow
          ? t("plan.wb.overMtow")
          : result.withinEnvelope
            ? t("plan.wb.ok")
            : t("plan.wb.outsideEnvelope")}
      </div>
    </div>
  );
}

export function WeightBalanceSection() {
  const t = useT();
  const flight = useFlight((s) => s.flight);
  const update = useFlight((s) => s.update);
  const { aircraft, loading } = usePlan();
  const wb = aircraft?.weightBalance;

  return (
    <Section title={t("plan.wb.title")}>
      {!wb || !loading ? (
        <p className="text-muted-foreground text-sm">
          {aircraft ? t("plan.wb.noData") : t("plan.aircraft.placeholder")}
        </p>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            {wb.stations.map((station) => (
              <NumberField
                key={station.id}
                label={t(`plan.wb.station.${station.id}`)}
                unit="kg"
                min={0}
                value={flight.stationsKg[station.id] ?? 0}
                onChange={(kg) =>
                  update({
                    stationsKg: { ...flight.stationsKg, [station.id]: kg },
                  })
                }
              />
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Status
              label="takeoff"
              fuelL={loading.takeoffFuelL}
              result={loading.takeoff}
              mtowKg={wb.mtowKg}
            />
            <Status
              label="landing"
              fuelL={loading.landingFuelL}
              result={loading.landing}
              mtowKg={wb.mtowKg}
            />
          </div>
          <p className="text-muted-foreground text-xs">
            {t("plan.wb.empty")}: {fmt(wb.emptyWeightKg)} kg @{" "}
            {fmt(wb.emptyArmM, 3)} m
          </p>
        </>
      )}
    </Section>
  );
}
