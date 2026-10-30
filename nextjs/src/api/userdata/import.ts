import { type Flight } from "~/data/flight";
import { type AircraftDraft } from "~/domain/custom-aircraft";
import { type AircraftState } from "~/stores/aircraft-state";
import { type Settings } from "~/stores/settings";

import { type UserDataApi } from "./client";
import { type ImportResult, type SettingsBody } from "./schemas";

/** Largest batch per call (docs/API.md, "One-time import"); more is a 422. */
const LIMITS = {
  flights: 500,
  custom_aircraft: 200,
  airframe_states: 500,
  favorites: 1000,
} as const;
const SCHEMA_VERSION = 1;

type Item = {
  id: string;
  document: Record<string, unknown>;
  schema_version: number;
};
export type AirframeStateItem = {
  type: string;
  registration: string;
  fuel_indication_mode: "exact" | "estimated" | null;
  mth: number | null;
  fuel_remaining_l: number | null;
  fuel_added_l: number | null;
  fuel_used_l: number | null;
  updated_at?: string;
};
export type ImportBody = {
  flights?: Item[];
  custom_aircraft?: Item[];
  airframe_states?: AirframeStateItem[];
  settings?: SettingsBody;
  favorites?: string[];
};

export const flightItems = (flights: Flight[]): Item[] =>
  flights.map((flight) => ({
    id: flight.id,
    document: flight,
    schema_version: SCHEMA_VERSION,
  }));

/** Drafts carry the id the app minted for them (`api/aircraft.ts`); one without cannot be matched on the server. */
export const aircraftItems = (drafts: AircraftDraft[]): Item[] =>
  drafts.flatMap((draft) =>
    draft.id
      ? [
          {
            id: draft.id,
            document: draft,
            schema_version: SCHEMA_VERSION,
          },
        ]
      : [],
  );

/** "TYPE::REG" (or "TYPE::DEFAULT") → the server's `type` and `registration` ("" for the default airframe). */
export function parseStateKey(key: string) {
  const at = key.indexOf("::");
  if (at <= 0) return null;
  const registration = key.slice(at + 2);
  return {
    type: key.slice(0, at),
    registration: registration === "DEFAULT" ? "" : registration,
  };
}

/** The client keeps MTH as text ("1234.5"); the server wants a number, `null` when unknown. */
export const mthNumber = (mth: string) => {
  const value = mth.trim() === "" ? NaN : Number(mth);
  return Number.isFinite(value) ? value : null;
};

export const airframeStateItems = (
  states: Record<string, AircraftState>,
): AirframeStateItem[] =>
  Object.entries(states).flatMap(([key, state]) => {
    const parsed = parseStateKey(key);
    if (!parsed) return [];
    return [
      {
        ...parsed,
        fuel_indication_mode: state.fuelIndicationMode,
        mth: mthNumber(state.mth),
        fuel_remaining_l: state.fuelRemainingL,
        fuel_added_l: state.fuelAddedL,
        fuel_used_l: state.fuelUsedL,
        ...(state.updatedAt
          ? { updated_at: new Date(state.updatedAt).toISOString() }
          : {}),
      },
    ];
  });

/** The server only knows 4-letter ICAO codes for the home airport; anything else stays on this device. */
export const homeAirport = (value: string) => {
  const code = value.trim();
  return /^[A-Za-z]{4}$/.test(code) ? code.toUpperCase() : null;
};

/** Device voices (`checklistVoiceUris`) and `pilotSurname` (not in the contract) are left out. */
export const settingsBody = (settings: Settings): SettingsBody => ({
  language: settings.language,
  home_airport_icao: homeAirport(settings.homeAirportIcao),
  pilot_weight_kg: settings.pilotWeightKg,
  atis_autoscroll: settings.atisAutoscroll,
  checklist_autoscroll: settings.checklistAutoscroll,
  checklist_voice_gender: settings.checklistVoiceGender,
});

const chunks = <T>(items: T[], size: number) =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, i) =>
    items.slice(i * size, (i + 1) * size),
  );

/** Splits what the device holds into calls within the batch limits; settings go with the first. */
export function importBatches(local: Required<ImportBody>): ImportBody[] {
  const parts = {
    flights: chunks(local.flights, LIMITS.flights),
    custom_aircraft: chunks(local.custom_aircraft, LIMITS.custom_aircraft),
    airframe_states: chunks(local.airframe_states, LIMITS.airframe_states),
    favorites: chunks(local.favorites, LIMITS.favorites),
  };
  const count = Math.max(1, ...Object.values(parts).map((p) => p.length));
  return Array.from({ length: count }, (_, i) => ({
    ...(i === 0 ? { settings: local.settings } : {}),
    ...(parts.flights[i] ? { flights: parts.flights[i] } : {}),
    ...(parts.custom_aircraft[i]
      ? { custom_aircraft: parts.custom_aircraft[i] }
      : {}),
    ...(parts.airframe_states[i]
      ? { airframe_states: parts.airframe_states[i] }
      : {}),
    ...(parts.favorites[i] ? { favorites: parts.favorites[i] } : {}),
  }));
}

const text = (error: unknown) =>
  typeof error === "string" ? error : JSON.stringify(error);

/** One line per refused item, for the pilot to read; nothing is retried on their behalf. */
export function rejectedLines(result: ImportResult) {
  const lines: string[] = [];
  for (const [part, value] of Object.entries(result)) {
    if (Array.isArray(value))
      lines.push(...value.map((e) => `${part}: ${text(e)}`));
    else if (value && typeof value === "object")
      for (const r of value.rejected)
        lines.push(
          `${[part, r.id].filter((x) => x != null).join(" ")}: ${text(r.error)}`,
        );
  }
  return lines;
}

const flagKey = (username: string) =>
  `nordsweet.userDataImported.${username}.v1`;
export const wasImported = (
  username: string,
  storage: Pick<Storage, "getItem"> = localStorage,
) => storage.getItem(flagKey(username)) !== null;

/**
 * Uploads what this browser holds, once per user and device. The server never overwrites, so a
 * repeated or second-device import only adds what is missing. The flag is set only after every
 * batch was answered: a dropped connection repeats the (idempotent) import at the next start.
 */
export async function importLocalData({
  api,
  username,
  local,
  storage = localStorage,
}: {
  api: Pick<UserDataApi, "importData">;
  username: string;
  local: Required<ImportBody>;
  storage?: Pick<Storage, "getItem" | "setItem">;
}) {
  if (wasImported(username, storage)) return null;
  const rejected: string[] = [];
  for (const batch of importBatches(local))
    rejected.push(...rejectedLines(await api.importData(batch)));
  storage.setItem(flagKey(username), new Date().toISOString());
  return rejected;
}
