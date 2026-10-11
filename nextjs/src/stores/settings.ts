import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type Language = "pl" | "en";

export type Settings = {
  language: Language;
  homeAirportIcao: string;
  pilotWeightKg: number | null;
};

type SettingsStore = Settings & {
  update: (patch: Partial<Settings>) => void;
};

const defaults: Settings = {
  language: "pl",
  homeAirportIcao: "",
  pilotWeightKg: null,
};

/**
 * Settings saved by the legacy planner (raw strings under `nordsweet.*.v1`). Its AVWX and
 * Notamify tokens are not migrated: the Aviation API holds those server-side.
 */
export function readLegacySettings(
  storage: Pick<Storage, "getItem">,
): Partial<Settings> {
  const read = (key: string) => storage.getItem(key)?.trim() ?? "";
  const legacy: Partial<Settings> = {};
  const language = read("nordsweet.language.v1").toLowerCase();
  if (language === "en" || language === "pl") legacy.language = language;
  const home = read("nordsweet.homeAirport.v1").toUpperCase();
  if (home) legacy.homeAirportIcao = home;
  const weight = Number(read("nordsweet.pilotWeightKg.v1"));
  if (
    read("nordsweet.pilotWeightKg.v1") &&
    Number.isFinite(weight) &&
    weight > 0
  ) {
    legacy.pilotWeightKg = weight;
  }
  return legacy;
}

export const useSettings = create<SettingsStore>()(
  persist(
    (set) => ({
      ...defaults,
      update: (patch) => set(patch),
    }),
    {
      name: "nordsweet.settings.v2",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: ({ update: _update, ...settings }) => settings,
      // First run of the new app: start from whatever the legacy planner stored.
      merge: (persisted, current) =>
        persisted
          ? { ...current, ...(persisted as Partial<Settings>) }
          : { ...current, ...readLegacySettings(localStorage) },
    },
  ),
);
