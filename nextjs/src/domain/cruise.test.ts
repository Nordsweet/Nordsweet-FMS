import fs from "node:fs";

import { describe, expect, it } from "vitest";

import { datasetSchemas } from "~/data/schemas";

import { cruiseOptions } from "./cruise";

const aircraft = datasetSchemas.aircraft.parse(
  JSON.parse(fs.readFileSync("public/data/aircraft.json", "utf8")),
);
const cruise = (id: string) => aircraft.find((a) => a.id === id)!.cruise!;

describe("cruiseOptions", () => {
  it("returns POH values at a tabulated altitude and ISA", () => {
    const r = cruiseOptions(cruise("R172K"), 2000, 0);
    expect(r.tableAltitudeFt).toBe(2000);
    expect(
      r.options.find((o) => o.setting === "2600 RPM / 24 inHg"),
    ).toMatchObject({ ktas: 126, fuelFlowLph: 43.154 });
    expect(r.outsideIsaRange).toBe(false);
  });

  it("uses the nearest table altitude and interpolates the ISA deviation", () => {
    const r = cruiseOptions(cruise("R172K"), 4600, 10);
    expect(r.tableAltitudeFt).toBe(4000);
    const isa = cruiseOptions(cruise("R172K"), 4000, 0).options.find(
      (o) => o.setting === "2600 RPM / 22 inHg",
    )!;
    const hot = cruiseOptions(cruise("R172K"), 4000, 20).options.find(
      (o) => o.setting === "2600 RPM / 22 inHg",
    )!;
    const mid = r.options.find((o) => o.setting === "2600 RPM / 22 inHg")!;
    expect(mid.fuelFlowLph).toBeCloseTo(
      (isa.fuelFlowLph + hot.fuelFlowLph) / 2,
      6,
    );
  });

  it("sums both engines for the P2006T and orders by fuel flow", () => {
    const r = cruiseOptions(cruise("P2006T"), 0, -30);
    expect(r.options[0]).toMatchObject({
      setting: "2250 RPM / 29.5 inHg",
      ktas: 143,
      fuelFlowLph: 57.2,
    });
    expect(
      r.options.every(
        (o, i) => i === 0 || o.fuelFlowLph <= r.options[i - 1]!.fuelFlowLph,
      ),
    ).toBe(true);
  });

  it("flags temperatures far outside a standard-day-only table", () => {
    expect(cruiseOptions(cruise("FR172H"), 2500, 15).outsideIsaRange).toBe(
      true,
    );
  });
});
