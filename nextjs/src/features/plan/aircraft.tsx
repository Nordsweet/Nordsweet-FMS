"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "~/api";
import Link from "next/link";
import { useState, useCallback, useEffect } from "react";

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
  aircraftForRegistration,
  aircraftTypes,
  formatMth,
  normalizeRegistration,
  performanceStatus,
  resolveAircraft,
} from "~/domain/aircraft";
import { type MessageKey } from "~/i18n/messages";
import { useLocale, useT } from "~/i18n/use-t";
import {
  aircraftStateKey,
  selectAircraftState,
  useAircraftState,
} from "~/stores/aircraft-state";
import { useFlight } from "~/stores/flight";
import { useSettings } from "~/stores/settings";

import { Section } from "./fields";
import { usePlan } from "./use-plan";
import { RegistrationField } from "./registration-field";

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

const updatedFormat = {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
} satisfies Intl.DateTimeFormatOptions;

export function AircraftSection() {
  const t = useT();
  const { flight, aircraft, aircraftList } = usePlan();
  const queryClient = useQueryClient();
  const update = useFlight((s) => s.update);
  const homeAirport = useSettings((s) => s.homeAirportIcao);
  const home = useQuery(
    api.airports.get.queryOptions({
      code: homeAirport.trim() === "" ? "EPKK" : homeAirport,
    }),
  );
  const pilotWeightKg = useSettings((s) => s.pilotWeightKg);
  const registration = normalizeRegistration(flight.registration);
  const type = aircraft?.type ?? null;
  const stateKey = type ? aircraftStateKey(type, registration) : "";
  const states = useAircraftState((s) => s.states);
  const models = useAircraftState((s) => s.models);
  const rememberModel = useAircraftState((s) => s.rememberModel);
  const setFuelIndicationMode = useAircraftState(
    (s) => s.setFuelIndicationMode,
  );
  const record = useAircraftState((s) => s.record);
  const lastState = type
    ? selectAircraftState(states, type, registration)
    : null;

  const matchRegistration = useCallback(
    (
      value: string,
      identity?: { icaoType: string | null; model?: string | null } | null,
    ) => {
      const reg = normalizeRegistration(value);
      const remembered = Object.entries(states)
        .filter(([key]) => key.split("::")[1] === reg)
        .sort((a, b) => (b[1].updatedAt ?? 0) - (a[1].updatedAt ?? 0))
        .map(([key]) => key.split("::")[0]!);
      return aircraftForRegistration(
        aircraftList,
        reg,
        models[reg] ? [models[reg], ...remembered] : remembered,
        identity,
      );
    },
    [aircraftList, states, models],
  );

  // Reference data and persisted airframe readings may finish loading after registration entry.
  useEffect(() => {
    const matched = matchRegistration(registration);
    const current = useFlight.getState().flight;
    if (
      !matched ||
      normalizeRegistration(current.registration) !== registration ||
      current.aircraftId === matched.id
    )
      return;
    update({
      ...profileDefaults(matched, current, pilotWeightKg),
      fuelDisplayUnit: null,
    });
  }, [matchRegistration, registration, pilotWeightKg, update]);

  const select = (nextType: string, nextRegistration: string) => {
    const next = resolveAircraft(aircraftList, nextType, nextRegistration);
    const point = home.data
      ? { ident: home.data.ident, lat: home.data.lat, lon: home.data.lon }
      : null;
    update({
      ...(point && !flight.departure ? { departure: point } : {}),
      ...(point && !flight.destination ? { destination: point } : {}),
      registration: nextRegistration,
      ...(next?.type !== type ? { fuelDisplayUnit: null } : {}),
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
            onValueChange={(next) => {
              rememberModel(flight.registration, next);
              select(next, flight.registration);
            }}
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
        <RegistrationField
          value={flight.registration}
          options={[
            ...new Set([
              ...aircraftList.flatMap((a) =>
                a.registration ? [a.registration] : [],
              ),
              ...Object.keys(models),
              ...Object.keys(states)
                .map((key) => key.split("::")[1] ?? "")
                .filter((reg) => reg && reg !== "DEFAULT"),
            ]),
          ].sort()}
          onChange={(value) => {
            const matched = matchRegistration(value);
            const nextType = matched?.type ?? type;
            if (nextType) select(nextType, value);
            else update({ registration: value });
          }}
          onBlur={async () => {
            if (registration.length < 3 || matchRegistration(registration))
              return;
            try {
              const identity = await queryClient.fetchQuery({
                ...api.traffic.aircraftIdentity.queryOptions({
                  registration: flight.registration,
                }),
                staleTime: 86400000,
              });
              const current = useFlight.getState().flight;
              if (
                normalizeRegistration(current.registration) !== registration ||
                current.aircraftId !== flight.aircraftId
              )
                return;
              const matched = matchRegistration(registration, identity);
              if (matched) {
                rememberModel(current.registration, matched.type);
                select(matched.type, current.registration);
              }
            } catch {
              /* Manual selection remains available offline or for an unknown airframe. */
            }
          }}
        />
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
      <Link
        href="/aircraft"
        className="text-accent-2 w-fit text-[0.82rem] underline-offset-4 hover:underline"
      >
        {t("aircraft.manage")}
      </Link>
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
          {aircraft.referenceData && (
            <details
              className="rounded-xl border p-3 text-sm"
              data-testid="aircraft-reference"
            >
              <summary>{t("aircraft.reference.title")}</summary>
              {aircraft.referenceData.simulationOnly && (
                <p className="my-2 text-amber-400">
                  {t("aircraft.reference.simulation")}
                </p>
              )}
              <dl className="grid gap-2 py-2 sm:grid-cols-2" lang="en">
                {aircraft.referenceData.values.map((row) => (
                  <div key={row.label}>
                    <dt className="text-muted-foreground">{row.label}</dt>
                    <dd>{row.value}</dd>
                  </div>
                ))}
              </dl>
              <p>{t("aircraft.reference.missing")}</p>
              <ul className="mt-2 text-xs" lang="en">
                {aircraft.referenceData.sources.map((source) => (
                  <li key={source}>{source}</li>
                ))}
              </ul>
            </details>
          )}
          <LastKnownState
            key={stateKey}
            registration={registration}
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
  registration,
  mth,
  updatedAt,
  onMth,
}: {
  registration: string;
  mth: string;
  updatedAt: number | null;
  onMth: (mth: string) => void;
}) {
  const t = useT();
  const locale = useLocale();
  // Remounted per airframe (key), so the draft starts from that airframe's value.
  const [draft, setDraft] = useState(mth);

  return (
    <div className="grid items-end gap-3 rounded-[14px] border border-dashed border-[rgba(122,243,211,0.28)] bg-[rgba(7,17,31,0.48)] p-3.5 sm:grid-cols-[minmax(0,1fr)_minmax(160px,0.42fr)]">
      <div className="text-muted-foreground grid gap-1 text-[0.82rem]">
        <strong className="text-accent-2 tracking-[0.07em] uppercase">
          {t("plan.aircraft.lastState")}
          {registration && ` · ${registration}`}
        </strong>
        <span>
          {updatedAt
            ? t("plan.aircraft.lastState.updated", {
                at: new Intl.DateTimeFormat(locale, updatedFormat).format(updatedAt),
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
