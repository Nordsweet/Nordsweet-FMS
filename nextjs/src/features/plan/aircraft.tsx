"use client";

import { useState } from "react";

import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { type Aircraft } from "~/data/aircraft";
import { type Flight } from "~/data/flight";
import {
  aircraftLabel,
  aircraftTypes,
  formatMth,
  normalizeRegistration,
  performanceStatus,
  resolveAircraft,
} from "~/domain/aircraft";
import { type MessageKey } from "~/i18n/messages";
import { useT } from "~/i18n/use-t";
import {
  aircraftStateKey,
  selectAircraftState,
  useAircraftState,
} from "~/stores/aircraft-state";
import { useFlight } from "~/stores/flight";
import { useSettings } from "~/stores/settings";

import { Section } from "./fields";
import { usePlan } from "./use-plan";

/** A new profile starts from its POH/W&B defaults, with the pilot weight from settings. */
function profileDefaults(
  aircraft: Aircraft | null,
  flight: Flight,
  pilotWeightKg: number | null,
): Partial<Flight> {
  const wb = aircraft?.weightBalance;
  return {
    aircraftId: aircraft?.id ?? null,
    stationsKg: Object.fromEntries(
      (wb?.stations ?? []).map((s) => [
        s.id,
        // Legacy: the pilot weight setting, else the profile's, else 85 kg.
        s.id === "pilot" ? (pilotWeightKg ?? (s.defaultKg || 85)) : s.defaultKg,
      ]),
    ),
    fuel: { ...flight.fuel, blockL: wb?.fuel.defaultL ?? flight.fuel.blockL },
  };
}

const updatedFormat = new Intl.DateTimeFormat(undefined, {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export function AircraftSection() {
  const t = useT();
  const { flight, aircraft, aircraftList } = usePlan();
  const update = useFlight((s) => s.update);
  const pilotWeightKg = useSettings((s) => s.pilotWeightKg);
  const registration = normalizeRegistration(flight.registration);
  const type = aircraft?.type ?? null;
  const stateKey = type ? aircraftStateKey(type, registration) : "";
  const states = useAircraftState((s) => s.states);
  const setFuelIndicationMode = useAircraftState(
    (s) => s.setFuelIndicationMode,
  );
  const record = useAircraftState((s) => s.record);
  const lastState = type
    ? selectAircraftState(states, type, registration)
    : null;

  const select = (nextType: string, nextRegistration: string) => {
    const next = resolveAircraft(aircraftList, nextType, nextRegistration);
    update({
      registration: nextRegistration,
      ...(next?.id !== flight.aircraftId &&
        profileDefaults(next, flight, pilotWeightKg)),
    });
  };

  return (
    <Section>
      <div className="grid gap-4 sm:grid-cols-[minmax(220px,1fr)_minmax(180px,0.7fr)]">
        <div className="grid gap-1.5">
          <Label htmlFor="aircraft-type">{t("plan.aircraft.type")}</Label>
          <Select
            value={type ?? ""}
            onValueChange={(next) => select(next, flight.registration)}
          >
            <SelectTrigger id="aircraft-type" className="w-full">
              <SelectValue placeholder={t("plan.aircraft.placeholder")} />
            </SelectTrigger>
            <SelectContent>
              {aircraftTypes(aircraftList).map((a) => (
                <SelectItem key={a.id} value={a.type}>
                  {aircraftLabel(a)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="aircraft-registration">
            {t("plan.aircraft.registration")}
          </Label>
          <Input
            id="aircraft-registration"
            placeholder={t("plan.aircraft.registrationPlaceholder")}
            autoComplete="off"
            spellCheck={false}
            value={flight.registration}
            onChange={(e) =>
              type
                ? select(type, e.target.value)
                : update({ registration: e.target.value })
            }
          />
        </div>
        {type && (
          <div className="grid gap-1.5">
            <Label htmlFor="fuel-indication">
              {t("plan.aircraft.fuelIndication")}
            </Label>
            <Select
              value={lastState?.fuelIndicationMode ?? "auto"}
              onValueChange={(mode) =>
                setFuelIndicationMode(
                  stateKey,
                  mode === "exact" || mode === "estimated" ? mode : null,
                )
              }
            >
              <SelectTrigger id="fuel-indication" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">
                  {t("plan.aircraft.fuelIndication.auto")}
                </SelectItem>
                <SelectItem value="exact">
                  {t("plan.aircraft.fuelIndication.exact")}
                </SelectItem>
                <SelectItem value="estimated">
                  {t("plan.aircraft.fuelIndication.estimated")}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
      {aircraft && (
        <>
          <p className="text-muted-foreground text-[0.82rem] leading-snug">
            <strong className="text-foreground">
              {aircraftLabel(aircraft)}
              {registration && ` / ${registration}`}
            </strong>
            {" - "}
            {dataStatus(aircraft, registration, t)}{" "}
            {t("plan.aircraft.powerplant", {
              powerplant: t(`plan.aircraft.powerplant.${aircraft.powerplant}`),
            })}
          </p>
          <LastKnownState
            key={stateKey}
            mth={lastState?.mth ?? ""}
            updatedAt={lastState?.updatedAt ?? null}
            onMth={(mth) => record(stateKey, { mth })}
          />
        </>
      )}
    </Section>
  );
}

function dataStatus(
  aircraft: Aircraft,
  registration: string,
  t: ReturnType<typeof useT>,
) {
  const parts: string[] = [];
  if (aircraft.registration) parts.push(t("plan.aircraft.data.registration"));
  else {
    if (registration)
      parts.push(t("plan.aircraft.data.noRegistration", { registration }));
    const status = performanceStatus(aircraft);
    parts.push(t(`plan.aircraft.data.${status}` as MessageKey));
  }
  return parts.join(" ");
}

function LastKnownState({
  mth,
  updatedAt,
  onMth,
}: {
  mth: string;
  updatedAt: number | null;
  onMth: (mth: string) => void;
}) {
  const t = useT();
  // Remounted per airframe (key), so the draft starts from that airframe's value.
  const [draft, setDraft] = useState(mth);

  return (
    <div className="grid items-end gap-3 rounded-[14px] border border-dashed border-[rgba(122,243,211,0.28)] bg-[rgba(7,17,31,0.48)] p-3.5 sm:grid-cols-[minmax(0,1fr)_minmax(160px,0.42fr)]">
      <div className="text-muted-foreground grid gap-1 text-[0.82rem]">
        <strong className="text-accent-2 tracking-[0.07em] uppercase">
          {t("plan.aircraft.lastState")}
        </strong>
        <span>
          {updatedAt
            ? t("plan.aircraft.lastState.updated", {
                at: updatedFormat.format(updatedAt),
              })
            : t("plan.aircraft.lastState.none")}
        </span>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="aircraft-mth">MTH</Label>
        <Input
          id="aircraft-mth"
          inputMode="decimal"
          placeholder="00000.00"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            const formatted = formatMth(draft);
            if (formatted === null) return setDraft(mth);
            setDraft(formatted);
            if (formatted !== mth) onMth(formatted);
          }}
        />
      </div>
    </div>
  );
}
