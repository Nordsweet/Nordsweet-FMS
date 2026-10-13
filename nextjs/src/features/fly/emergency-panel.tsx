"use client";

import {
  type FlightPhase,
  emergencyAltitude,
  emergencyClimb,
  phaseAirport,
} from "~/domain/flight-phase";
import { usePlan } from "~/features/plan/use-plan";
import { useT } from "~/i18n/use-t";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <strong className="text-right">{value}</strong>
    </div>
  );
}

function Group({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-1 rounded-2xl border p-3">
      <h3 className="text-destructive text-xs font-semibold tracking-[0.08em] uppercase">
        {title}
      </h3>
      {children}
    </div>
  );
}

/** The POH's ISA column reads "ISA (x C)", as in legacy. */
const tableTemperature = ({
  pressureAltitudeFt,
  temperatureC,
}: {
  pressureAltitudeFt: number;
  temperatureC: number;
}) =>
  temperatureC === 15 - (2 * pressureAltitudeFt) / 1000
    ? `ISA (${temperatureC} C)`
    : `${temperatureC} C`;

/** Legacy EMER: one engine inoperative climb at the active phase's altitude and OAT. */
export function EmergencyPanel({ phase }: { phase: FlightPhase }) {
  const t = useT();
  const {
    aircraft,
    flight,
    departureAirport,
    destinationAirport,
    takeoffWeightKg,
    surfaceTempC,
    qnhHpa,
    fuelConditionsSource,
  } = usePlan();
  const context = emergencyAltitude(
    phase,
    phaseAirport(phase, departureAirport, destinationAirport),
    {
      qnhHpa,
      surfaceTempC,
      cruiseAltitudeFt: flight.cruiseAltitudeFt,
      cruiseOatC: flight.cruiseOatC,
    },
  );
  const ft = Math.round(context.altitudeFt);
  const altitudeLabel =
    context.kind === "cruise"
      ? t("fly.emer.cruiseAltitude", {
          altitude: ft === 0 ? "S.L." : `${ft} ft`,
        })
      : t(
          context.kind === "elevation"
            ? "fly.emer.elevation"
            : "fly.emer.pressureAltitude",
          { altitude: ft },
        );
  const source =
    context.kind === "cruise"
      ? t("fly.emer.cruiseOat")
      : fuelConditionsSource
        ? `METAR ${fuelConditionsSource}`
        : t("fly.emer.manual");
  const tables = aircraft?.emergencyClimb;
  const pair = (label: string, iasKt: number, rateFpm: number) =>
    `${label} ${Math.round(iasKt)} KIAS / ROC ${Math.round(rateFpm)} ft/min`;

  return (
    <>
      <p className="text-muted-foreground -mt-2 text-sm">
        {t("fly.emer.subtitle")}
      </p>
      <Group title={t("fly.emer.checklist")}>
        <p className="text-muted-foreground text-sm">
          {t("fly.emer.checklistNote")}
        </p>
      </Group>
      <Group title={t("fly.emer.basis")}>
        <Row label={t("fly.emer.phase")} value={t(`fly.phase.${phase}`)} />
        <Row label={t("fly.emer.altitude")} value={altitudeLabel} />
        <Row
          label="OAT"
          value={`${Math.round(context.temperatureC)} C (${source})`}
        />
      </Group>
      <Group title={t("fly.emer.configuration")}>
        <Row
          label={t("fly.emer.engines")}
          value={t("fly.emer.oneEngineInop")}
        />
        <Row
          label={t("fly.emer.flaps")}
          value={tables?.vyse.flaps ?? t("fly.emer.up")}
        />
        <Row
          label={t("fly.emer.gear")}
          value={tables?.vyse.landingGear ?? t("fly.emer.up")}
        />
        <Row
          label={t("fly.emer.power")}
          value={tables?.vyse.powerSetting ?? t("fly.emer.mcp")}
        />
      </Group>
      {(["vyse", "vxse"] as const).map((key) => {
        const table = tables?.[key];
        const climb = table
          ? emergencyClimb(
              table,
              takeoffWeightKg,
              context.altitudeFt,
              context.temperatureC,
            )
          : null;
        const label = table?.speedLabel ?? (key === "vyse" ? "Vyse" : "Vxse");
        return (
          <Group key={key} title={key === "vyse" ? "VySE" : "VxSE"}>
            <Row
              label={t("fly.emer.interpolated")}
              value={
                climb
                  ? pair(
                      label,
                      climb.interpolated.iasKt,
                      climb.interpolated.rateFpm,
                    )
                  : "n/a"
              }
            />
            <Row
              label={t("fly.emer.conservative")}
              value={
                climb
                  ? pair(
                      label,
                      climb.conservative.iasKt,
                      climb.conservative.rateFpm,
                    )
                  : "n/a"
              }
            />
            <Row
              label={t("fly.emer.forTable")}
              value={
                climb
                  ? `${climb.basis.weightKg} kg / ${climb.basis.pressureAltitudeFt} ft / ${tableTemperature(climb.basis)}`
                  : "n/a"
              }
            />
          </Group>
        );
      })}
    </>
  );
}
