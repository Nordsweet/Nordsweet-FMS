import { describe, expect, it } from "vitest";

import { type Aircraft } from "~/data/aircraft";

import {
  aircraftTypes,
  aircraftForRegistration,
  defaultFuelIndicationMode,
  formatMth,
  resolveAircraft,
} from "./aircraft";

const profile = (
  id: string,
  type: string,
  registration: string | null,
  order: number,
) => ({ id, type, registration, order }) as Aircraft;
const list = [
  profile("FR172H-SPANT", "FR172H", "SPANT", 7),
  profile("FR172H", "FR172H", null, 7),
  profile("P2006T", "P2006T", null, 1),
];

describe("aircraft", () => {
  it("matches airframes and remembered models; ambiguous C172 subtypes remain manual", () => {
    expect(aircraftForRegistration(list, "sp-ant")?.type).toBe("FR172H");
    expect(aircraftForRegistration(list, "SP-ABC", ["P2006T"])?.type).toBe(
      "P2006T",
    );
    const cessnas = [
      { ...profile("C172S", "C172S", null, 1), icaoType: "C172" },
      { ...profile("C172M", "C172M", null, 2), icaoType: "C172" },
    ];
    expect(
      aircraftForRegistration(cessnas, "SP-ABC", [], { icaoType: "C172" }),
    ).toBeNull();
    expect(
      aircraftForRegistration(cessnas, "SP-ABC", [], {
        icaoType: "C172",
        model: "Cessna 172S Skyhawk",
      })?.type,
    ).toBe("C172S");
  });
  it("lists one entry per type in the legacy order", () => {
    expect(aircraftTypes(list).map((a) => a.id)).toEqual(["P2006T", "FR172H"]);
  });

  it("uses a registration's own profile, else the type's", () => {
    expect(resolveAircraft(list, "FR172H", "sp-ant")?.id).toBe("FR172H-SPANT");
    expect(resolveAircraft(list, "FR172H", "SP-XYZ")?.id).toBe("FR172H");
    expect(resolveAircraft(list, "P2006T", "SP-ANT")?.id).toBe("P2006T");
  });

  it("defaults the fuel indication as the legacy planner did", () => {
    expect(defaultFuelIndicationMode("P2006T", "")).toBe("exact");
    expect(defaultFuelIndicationMode("R172K", "OE-KMT")).toBe("exact");
    expect(defaultFuelIndicationMode("R172K", "SP-ABC")).toBe("estimated");
  });

  it("formats engine hours", () => {
    expect(formatMth("1234,5")).toBe("01234.50");
    expect(formatMth("123456")).toBe("99999.99");
    expect(formatMth("abc")).toBeNull();
    expect(formatMth("")).toBeNull();
  });
});
