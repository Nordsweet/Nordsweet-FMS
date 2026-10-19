"use client";

import { useId } from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  fuelUnit,
  formatFuel,
  parseFuel,
  fuelFromLitres,
  type FuelUnit,
} from "~/domain/fuel-units";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { normalizeRegistration } from "~/domain/aircraft";
import {
  CONTINGENCY_HOLD_MINUTES,
  type EditableFuelRow,
  type FuelRowValue,
  formatHhMm,
  parseHhMm,
} from "~/domain/fuel-planning";
import { type MessageKey } from "~/i18n/messages";
import { useT } from "~/i18n/use-t";
import { cn } from "~/lib/utils";
import {
  aircraftStateKey,
  fuelOnBoardL,
  selectAircraftState,
  useAircraftState,
} from "~/stores/aircraft-state";
import { useFlight } from "~/stores/flight";

import { OverrideCell, Section, num } from "./fields";

import { usePlan } from "./use-plan";

const ROW_LABELS: Record<EditableFuelRow, MessageKey> = {
  plannedTrip: "plan.fuel.row.plannedTrip",
  startTaxi: "plan.fuel.row.startTaxi",
  climb: "plan.fuel.row.climb",
  departureArrival: "plan.fuel.row.departureArrival",
  alternate: "plan.fuel.row.alternate",
};

export function FuelSection() {
  const t = useT();
  const fuelAddedId = useId();
  const {
    flight,
    aircraft,
    fuelPlanning: plan,
    fuelConditionsSource,
  } = usePlan();
  const update = useFlight((s) => s.update);
  const states = useAircraftState((s) => s.states);
  const record = useAircraftState((s) => s.record);
  const registration = normalizeRegistration(flight.registration);

  if (!aircraft)
    return (
      <Section title={t("plan.fuel.title")}>
        <p className="text-muted-foreground text-sm">
          {t("plan.aircraft.placeholder")}
        </p>
      </Section>
    );

  const unit = fuelUnit(aircraft.type, flight.fuelDisplayUnit);
  const shownFuel = (value: number) => formatFuel(value, unit);
  const readFuel = (text: string) => parseFuel(text, unit);
  const capacityL = aircraft.fuelTankCapacityL ?? aircraft.usableFuelL;
  const lastState = selectAircraftState(states, aircraft.type, registration);
  const onBoardL = fuelOnBoardL(lastState, capacityL);
  const overrides = flight.fuelOverrides;
  const setOverride = (
    row: EditableFuelRow,
    patch: { minutes?: number | null; fuelL?: number | null },
  ) =>
    update({
      fuelOverrides: { ...overrides, [row]: { ...overrides[row], ...patch } },
    });

  const editableRow = (row: EditableFuelRow, value: FuelRowValue) => {
    const label = t(ROW_LABELS[row]);
    return (
      <tr key={row} className="border-border border-t">
        <td className="px-2 py-1 font-semibold">{label}</td>
        {row === "startTaxi" ? (
          <NotApplicable />
        ) : (
          <OverrideCell
            label={t("plan.fuel.timeOf", { row: label })}
            value={value.minutes}
            suggested={value.suggested.minutes}
            format={formatHhMm}
            parse={parseHhMm}
            placeholder="hh:mm"
            onCommit={(minutes) => setOverride(row, { minutes })}
          />
        )}
        <OverrideCell
          label={t(
            unit === "L" ? "plan.fuel.fuelOf" : "plan.fuel.fuelOfGallons",
            { row: label },
          )}
          value={value.fuelL}
          suggested={value.suggested.fuelL}
          key={unit}
          format={shownFuel}
          parse={readFuel}
          onCommit={(fuelL) => setOverride(row, { fuelL })}
        />
      </tr>
    );
  };
  const calculatedRow = (
    key: string,
    label: string,
    time: string,
    fuelL: number,
    testId?: string,
  ) => (
    <tr key={key} className="border-border border-t bg-[rgba(16,30,52,0.5)]">
      <td className="px-2 py-2 font-semibold">{label}</td>
      <td className="px-2 text-center font-semibold">{time}</td>
      <td className="px-2 text-center font-semibold" data-testid={testId}>
        {shownFuel(fuelL)}
      </td>
    </tr>
  );

  const outOfRange = plan && capacityL !== null && plan.minimumL > capacityL;
  const marginL = plan ? -plan.shortfallL : 0;

  return (
    <Section title={t("plan.fuel.title")}>
      <div className="grid gap-2 rounded-[14px] border border-[rgba(122,243,211,0.2)] bg-[rgba(7,17,31,0.48)] p-3">
        <div className="grid items-center gap-2 sm:grid-cols-[1fr_minmax(160px,220px)]">
          <span className="text-xs font-bold tracking-[0.06em] uppercase">
            {t("plan.fuel.onBoard")}
          </span>
          <output
            className="bg-input/40 rounded-xl px-3 py-2 text-center text-sm"
            data-testid="fuel-on-board"
          >
            {onBoardL === null ? "--" : `${shownFuel(onBoardL)} ${unit}`}
          </output>
          <Label
            htmlFor={fuelAddedId}
            className="text-foreground text-xs font-bold"
          >
            {t("plan.fuel.added", { unit })}
          </Label>
          <Input
            id={fuelAddedId}
            type="number"
            inputMode="decimal"
            min={0}
            max={
              capacityL == null ? undefined : fuelFromLitres(capacityL, unit)
            }
            step={1}
            className="h-9 rounded-xl text-center"
            defaultValue={
              lastState.fuelAddedL == null
                ? ""
                : shownFuel(lastState.fuelAddedL)
            }
            key={`${aircraft.type}|${registration}|${lastState.fuelAddedL}|${unit}`}
            onBlur={(e) => {
              const text = e.target.value.trim();
              if (
                text ===
                (lastState.fuelAddedL == null
                  ? ""
                  : shownFuel(lastState.fuelAddedL))
              )
                return;
              const fuelAddedL = readFuel(text);
              if (text !== "" && fuelAddedL === null) return;
              const key = aircraftStateKey(aircraft.type, registration);
              record(key, { fuelAddedL });
              // Fuel added also sets the block fuel (and so the W&B usable fuel).
              const onBoard = fuelOnBoardL(
                { ...lastState, fuelAddedL },
                capacityL,
              );
              if (onBoard !== null) update({ fuel: { blockL: onBoard } });
            }}
          />
        </div>
        <p className="text-muted-foreground text-xs">
          {t("plan.fuel.addedNote")}
        </p>
      </div>

      {!plan ? (
        <p className="text-muted-foreground text-sm">
          {t("plan.navlog.empty")}
        </p>
      ) : (
        <>
          <div className="overflow-x-auto rounded-[14px] border">
            <table className="w-full text-sm tabular-nums sm:min-w-[36rem]">
              <thead className="bg-[rgba(16,30,52,0.92)] text-xs tracking-[0.06em] uppercase">
                <tr>
                  <th className="px-2 py-2">{t("plan.fuel.calculation")}</th>
                  <th className="px-2 py-2">{t("plan.fuel.flightTime")}</th>
                  <th className="px-2 py-2">
                    <div className="flex items-center justify-center gap-2">
                      <span>{t("plan.fuel.column")}</span>
                      <Select
                        value={unit}
                        onValueChange={(value) =>
                          update({ fuelDisplayUnit: value as FuelUnit })
                        }
                      >
                        <SelectTrigger
                          aria-label={t("plan.fuel.unit")}
                          className="w-28"
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="L">L</SelectItem>
                          <SelectItem value="US gal">US gal</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {editableRow("plannedTrip", plan.rows.plannedTrip)}
                {calculatedRow(
                  "contingency",
                  t("plan.fuel.row.contingency"),
                  t("plan.fuel.minHold", { minutes: CONTINGENCY_HOLD_MINUTES }),
                  plan.contingency.fuelL,
                )}
                {editableRow("startTaxi", plan.rows.startTaxi)}
                {editableRow("climb", plan.rows.climb)}
                {editableRow("departureArrival", plan.rows.departureArrival)}
                {editableRow("alternate", plan.rows.alternate)}
                {calculatedRow(
                  "reserve",
                  t("plan.fuel.row.reserve"),
                  t("plan.fuel.minHold", { minutes: plan.reserve.minutes }),
                  plan.reserve.fuelL,
                )}
                {calculatedRow(
                  "minimum",
                  t("plan.fuel.minimum"),
                  "",
                  plan.minimumL,
                  "fuel-minimum",
                )}
                <tr className="border-border border-t">
                  <td className="px-2 py-1 font-semibold">
                    {t("plan.fuel.block")}
                  </td>
                  <NotApplicable />
                  <OverrideCell
                    label={t(
                      unit === "L"
                        ? "plan.fuel.fuelOf"
                        : "plan.fuel.fuelOfGallons",
                      { row: t("plan.fuel.block") },
                    )}
                    value={plan.blockFuelL}
                    suggested={false}
                    key={unit}
                    format={shownFuel}
                    parse={readFuel}
                    max={capacityL ?? undefined}
                    onCommit={(blockL) =>
                      update({ fuel: { blockL: blockL ?? 0 } })
                    }
                  />
                </tr>
              </tbody>
            </table>
          </div>
          <p
            data-testid="fuel-margin"
            className={cn(
              "rounded-2xl border px-3.5 py-3 text-sm",
              outOfRange
                ? "border-destructive/40 text-destructive"
                : marginL >= 0
                  ? "border-ok/40 text-ok"
                  : "border-warn/40 text-warn",
            )}
          >
            {outOfRange
              ? t("plan.fuel.outOfRange")
              : marginL >= 0
                ? t("plan.fuel.margin", { litres: shownFuel(marginL), unit })
                : t("plan.fuel.below", { litres: shownFuel(-marginL), unit })}
          </p>
          <div className="text-muted-foreground grid gap-1 text-xs">
            <p>
              {t("plan.fuel.note.contingency", {
                unit,
                basis: t(
                  plan.contingency.basis === "trip"
                    ? "plan.fuel.note.contingency.trip"
                    : "plan.fuel.note.contingency.hold",
                ),
                trip: shownFuel(plan.contingency.fivePercentL),
                hold: shownFuel(plan.contingency.fiveMinuteHoldL),
                base: shownFuel(plan.contingency.holdBaseLph),
                buffered: shownFuel(plan.contingency.holdLph),
                source: plan.contingency.fromTable
                  ? t("plan.fuel.note.contingency.table")
                  : t("plan.fuel.note.contingency.fallback", {
                      flow: shownFuel(30),
                      unit,
                    }),
              })}
            </p>
            <p>
              {plan.alternateDetails.kind === "airport"
                ? t("plan.fuel.note.alternate", {
                    from: flight.destination?.ident ?? "",
                    to: plan.alternateDetails.to,
                    climb: num(plan.alternateDetails.climbFt, 0),
                    rate: plan.alternateDetails.fallbackRate
                      ? t("plan.fuel.note.alternate.fallbackRate")
                      : t("plan.fuel.note.alternate.tableRate", {
                          rate: num(plan.alternateDetails.climbRateFpm, 0),
                        }),
                    distance: num(plan.alternateDetails.distanceNm),
                    gs: num(plan.cruise.groundSpeedKt),
                  })
                : t(
                    aircraft.powerplant === "reciprocating"
                      ? "plan.fuel.note.noAlternate"
                      : "plan.fuel.note.noAlternateTurbine",
                    {
                      unit,
                      cruise: num(plan.alternateDetails.cruiseMinutes),
                      addition: num(plan.alternateDetails.additionMinutes),
                      flow: shownFuel(plan.cruise.fuelFlowLph),
                      total: shownFuel(plan.alternateDetails.totalL),
                      reserve: shownFuel(plan.reserve.fuelL),
                    },
                  )}
            </p>
            <p>
              {t("plan.fuel.note.reserve", {
                unit,
                powerplant: t(
                  `plan.aircraft.powerplant.${aircraft.powerplant}`,
                ),
                minutes: plan.reserve.minutes,
                surface: num(plan.reserve.surfaceTempC),
                source: fuelConditionsSource
                  ? t("plan.fuel.note.reserve.metar", {
                      icao: fuelConditionsSource,
                    })
                  : t("plan.fuel.note.reserve.standard"),
                airport: plan.reserve.airport,
                holding: num(plan.reserve.holdingTempC),
                flow: shownFuel(plan.reserve.fuelFlowLph),
              })}
            </p>
            <p>{t("plan.fuel.note.sync")}</p>
          </div>
        </>
      )}
    </Section>
  );
}

function NotApplicable() {
  return (
    <td
      aria-label="—"
      className="bg-[repeating-linear-gradient(135deg,transparent_0_8px,rgba(141,190,255,0.08)_8px_10px)]"
    />
  );
}
