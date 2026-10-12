import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { type FuelIndicationMode, formatMth } from "~/domain/aircraft";

/** What is known about one airframe between flights. */
export type AircraftState = {
  /** Null: use the aircraft's default (see defaultFuelIndicationMode). */
  fuelIndicationMode: FuelIndicationMode | null;
  mth: string;
  fuelRemainingL: number | null;
  fuelAddedL: number | null;
  fuelUsedL: number | null;
  /** Epoch ms of the last recorded change. */
  updatedAt: number | null;
};

export const emptyAircraftState: AircraftState = {
  fuelIndicationMode: null,
  mth: "",
  fuelRemainingL: null,
  fuelAddedL: null,
  fuelUsedL: null,
  updatedAt: null,
};

/** "TYPE::REG", or "TYPE::DEFAULT" without a registration (the legacy keys). */
export const aircraftStateKey = (type: string, registration: string) =>
  `${type}::${registration || "DEFAULT"}`;

type Store = {
  states: Record<string, AircraftState>;
  /** Mode only: choosing it is a setting, not a recorded state. */
  setFuelIndicationMode: (key: string, mode: FuelIndicationMode | null) => void;
  record: (
    key: string,
    patch: Partial<Omit<AircraftState, "updatedAt">>,
  ) => void;
};

/** The registration's state, else the type's. */
export function selectAircraftState(
  states: Record<string, AircraftState>,
  type: string,
  registration: string,
): AircraftState {
  return (
    states[aircraftStateKey(type, registration)] ??
    states[aircraftStateKey(type, "")] ??
    emptyAircraftState
  );
}

/** Fuel left after the last flight plus fuel added, capped at the tank capacity; null if neither is known. */
export function fuelOnBoardL(state: AircraftState, capacityL: number | null) {
  if (state.fuelRemainingL === null && state.fuelAddedL === null) return null;
  const total = (state.fuelRemainingL ?? 0) + (state.fuelAddedL ?? 0);
  return capacityL ? Math.min(total, capacityL) : total;
}

const litres = (value: unknown) => {
  const n = Number(value);
  return value !== "" && value !== null && Number.isFinite(n)
    ? Math.max(0, n)
    : null;
};

/** Last states and FREDA indication modes saved by the legacy planner. */
export function readLegacyAircraftStates(
  storage: Pick<Storage, "getItem">,
): Record<string, AircraftState> {
  const json = (key: string): Record<string, unknown> => {
    try {
      const value: unknown = JSON.parse(storage.getItem(key) ?? "{}");
      return value && typeof value === "object"
        ? (value as Record<string, unknown>)
        : {};
    } catch {
      return {};
    }
  };
  const states: Record<string, AircraftState> = {};
  for (const [key, raw] of Object.entries(
    json("nordsweet.aircraftLastState.v1"),
  )) {
    const r = (raw ?? {}) as Record<string, unknown>;
    const updatedAt = Number(r.updatedAt);
    states[key] = {
      ...emptyAircraftState,
      mth:
        formatMth(
          typeof r.mth === "string" || typeof r.mth === "number"
            ? String(r.mth)
            : "",
        ) ?? "",
      fuelRemainingL: litres(r.fuelRemainingLiters),
      fuelAddedL: litres(r.fuelAddedLiters),
      fuelUsedL: litres(r.fuelUsedLiters),
      updatedAt: updatedAt > 0 ? updatedAt : null,
    };
  }
  for (const [key, mode] of Object.entries(
    json("nordsweet.fuelIndicationModes.v1"),
  )) {
    if (mode !== "exact" && mode !== "estimated") continue;
    states[key] = {
      ...(states[key] ?? emptyAircraftState),
      fuelIndicationMode: mode,
    };
  }
  return states;
}

/** Per-airframe state (engine hours, fuel left after the last flight); kept on this device. */
export const useAircraftState = create<Store>()(
  persist(
    (set) => ({
      states: {},
      setFuelIndicationMode: (key, mode) =>
        set((s) => ({
          states: {
            ...s.states,
            [key]: {
              ...(s.states[key] ?? emptyAircraftState),
              fuelIndicationMode: mode,
            },
          },
        })),
      record: (key, patch) =>
        set((s) => ({
          states: {
            ...s.states,
            [key]: {
              ...(s.states[key] ?? emptyAircraftState),
              ...patch,
              updatedAt: Date.now(),
            },
          },
        })),
    }),
    {
      name: "nordsweet.aircraftState.v2",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: ({ states }) => ({ states }),
      merge: (persisted, current) => ({
        ...current,
        states:
          (persisted as { states?: Record<string, AircraftState> } | undefined)
            ?.states ?? readLegacyAircraftStates(localStorage),
      }),
    },
  ),
);
