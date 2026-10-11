import { describe, expect, it } from "vitest";

import { readLegacySettings } from "./settings";

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
      avwxToken: "abc",
      notamifyToken: "xyz",
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
