import { describe, expect, it } from "vitest";

import { readLegacyAircraftStates } from "./aircraft-state";

const storage = (items: Record<string, string>) => ({
  getItem: (key: string) => items[key] ?? null,
});

describe("readLegacyAircraftStates", () => {
  it("migrates last states and fuel indication modes", () => {
    const states = readLegacyAircraftStates(
      storage({
        "nordsweet.aircraftLastState.v1": JSON.stringify({
          "P2006T::SPABC": {
            mth: "123.4",
            fuelRemainingLiters: "40.0",
            fuelAddedLiters: "",
            updatedAt: 1700000000000,
          },
        }),
        "nordsweet.fuelIndicationModes.v1": JSON.stringify({
          "P2006T::SPABC": "estimated",
          "C152::DEFAULT": "bogus",
        }),
      }),
    );
    expect(states).toEqual({
      "P2006T::SPABC": {
        fuelIndicationMode: "estimated",
        mth: "00123.40",
        fuelRemainingL: 40,
        fuelAddedL: null,
        fuelUsedL: null,
        updatedAt: 1700000000000,
      },
    });
  });

  it("ignores unreadable data", () => {
    expect(
      readLegacyAircraftStates(
        storage({ "nordsweet.aircraftLastState.v1": "{not json" }),
      ),
    ).toEqual({});
  });
});
