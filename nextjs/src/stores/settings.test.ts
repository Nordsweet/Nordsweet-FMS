import { describe, expect, it } from "vitest";

import { settingsSchema, readLegacySettings } from "./settings";

const storage = (values: Record<string, string>) => ({
  getItem: (key: string) => values[key] ?? null,
});

describe("readLegacySettings", () => {
  it("maps legacy planner keys", () => {
    expect(
      readLegacySettings(
        storage({
          "nordsweet.language.v1": "EN",
          "nordsweet.homeAirport.v1": " epnt ",
          "nordsweet.pilotWeightKg.v1": "82",
          "nordsweet.avwxToken.v1": "abc",
          "nordsweet.notamifyToken.v1": "xyz",
        }),
      ),
    ).toEqual({
      language: "en",
      homeAirportIcao: "EPNT",
      pilotWeightKg: 82,
    });
  });

  it("ignores missing and invalid values", () => {
    expect(
      readLegacySettings(
        storage({
          "nordsweet.language.v1": "de",
          "nordsweet.pilotWeightKg.v1": "abc",
        }),
      ),
    ).toEqual({});
  });
});

it("migrates checklist/ATIS toggles and remembered voice without credentials", () => {
  expect(
    readLegacySettings(
      storage({
        "nordsweet.atisAutoscroll.v1": "0",
        "nordsweet.checklistAutoscroll.v1": "1",
        "nordsweet.checklistVoiceGender.v1": "male",
        "nordsweet.checklistVoiceUri.v1.male.en-us": "David",
      }),
    ),
  ).toEqual({
    atisAutoscroll: false,
    checklistAutoscroll: true,
    checklistVoiceGender: "male",
    checklistVoiceUris: { "male.en-us": "David" },
  });
  expect(
    settingsSchema.partial().safeParse({ language: "invalid" }).success,
  ).toBe(false);
});
