import { z } from "zod";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type Language = "pl" | "en";

export const settingsSchema = z.object({
  language: z.enum(["pl", "en"]),
  homeAirportIcao: z.string(),
  pilotWeightKg: z.number().nonnegative().nullable(),
  atisAutoscroll: z.boolean().default(true),
  checklistAutoscroll: z.boolean().default(true),
  checklistVoiceGender: z.enum(["female", "male"]).default("female"),
  checklistVoiceUris: z.record(z.string(), z.string()).default({}),
});
export type Settings = z.infer<typeof settingsSchema>;

type SettingsStore = Settings & {
  update: (patch: Partial<Settings>) => void;
};

const defaults: Settings = {
  language: "pl",
  homeAirportIcao: "",
  pilotWeightKg: null,
  atisAutoscroll: true,
  checklistAutoscroll: true,
  checklistVoiceGender: "female",
  checklistVoiceUris: {},
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
  for (const field of ["atisAutoscroll", "checklistAutoscroll"] as const) {
    const value = read(`nordsweet.${field}.v1`);
    if (value === "0" || value === "1") legacy[field] = value === "1";
  }
  const gender = read("nordsweet.checklistVoiceGender.v1");
  if (gender === "male" || gender === "female")
    legacy.checklistVoiceGender = gender;
  const uris: Record<string, string> = {};
  for (const g of ["male", "female"])
    for (const language of ["pl-pl", "en-us"]) {
      const uri = read(`nordsweet.checklistVoiceUri.v1.${g}.${language}`);
      if (uri) uris[`${g}.${language}`] = uri;
    }
  if (Object.keys(uris).length) legacy.checklistVoiceUris = uris;
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
      merge: (persisted, current) => {
        const legacy = readLegacySettings(localStorage);
        const parsed = settingsSchema.partial().safeParse(persisted);
        return {
          ...current,
          ...legacy,
          ...(parsed.success && persisted && typeof persisted === "object"
            ? Object.fromEntries(
                Object.entries(parsed.data).filter(([key]) =>
                  Object.hasOwn(persisted, key),
                ),
              )
            : {}),
        };
      },
    },
  ),
);
