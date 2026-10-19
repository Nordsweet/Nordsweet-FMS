import { describe, expect, it } from "vitest";

import {
  emptyAircraftState,
  fuelOnBoardL,
  readLegacyAircraftStates,
  selectAircraftState,
  aircraftStateKey,
} from "./aircraft-state";

const storage = (items: Record<string, string>) => ({
  getItem: (key: string) => items[key] ?? null,
});

it("isolates registration readings and never borrows a default or a different airframe", () => {
  const known = { ...emptyAircraftState, mth: "00123.40", fuelRemainingL: 73 };
  const states = { "C172S::DEFAULT": known, "C172S::SPABC": known };
  expect(aircraftStateKey("C172S", " sp-abc ")).toBe("C172S::SPABC");
  expect(selectAircraftState(states, "C172S", "SP-ABC")).toBe(known);
  expect(selectAircraftState(states, "C172S", "SP-XYZ")).toBe(
    emptyAircraftState,
  );
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

describe("fuelOnBoardL", () => {
  it("adds fuel added to the fuel left, capped at the tank capacity", () => {
    const state = { ...emptyAircraftState, fuelRemainingL: 40, fuelAddedL: 60 };
    expect(fuelOnBoardL(state, 92.5)).toBe(92.5);
    expect(fuelOnBoardL(state, null)).toBe(100);
    expect(fuelOnBoardL(emptyAircraftState, 92.5)).toBeNull();
  });
});
