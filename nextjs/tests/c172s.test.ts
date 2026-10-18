import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { aircraftSchema } from "~/data/aircraft";
import { operationalProcedure } from "~/data/emergency";
import { resolveAircraft } from "~/domain/aircraft";
import {
  cruisePerformance,
  cruiseTableRead,
  fuelFlowAtPower,
} from "~/domain/cruise-performance";

const aircraft = aircraftSchema
  .array()
  .parse(
    JSON.parse(
      fs.readFileSync(
        new URL("../public/data/aircraft.json", import.meta.url),
        "utf8",
      ),
    ),
  );
const profile = aircraft.find((a) => a.id === "C172S")!;
const cruise = profile.cruise!;

describe("C172S supplied Carenado reference", () => {
  it("resolves separately from Reims/C152 and leaves unsupplied data unavailable", () => {
    expect(resolveAircraft(aircraft, "C172S", "SP-TEST")).toBe(profile);
    expect(profile.icaoType).toBe("C172");
    expect(profile.weightBalance).toBeNull();
    expect(profile.takeoff).toBeNull();
    expect(profile.landing).toBeNull();
    expect(profile.climb).toBeNull();
    expect(profile.usableFuelL).toBeNull();
    expect(profile.fuelTankCapacityL).toBeNull();
    expect(profile.referenceData?.simulationOnly).toBe(true);
    expect(profile.windLimits?.maxCrosswindKt).toBe(15);
  });

  it("preserves both cruise sheets and converts US gallons exactly once", () => {
    expect(cruise.rows).toHaveLength(111);
    expect(
      new Set(
        cruise.rows.map(
          (r) => `${r.pressureAltitudeFt}/${r.setting}/${r.isaDeltaC}`,
        ),
      ).size,
    ).toBe(111);
    for (const [alt, rpm, isa, power, ktas, gph] of [
      [2000, 2550, -20, 83, 117, 11.1],
      [2000, 2400, 0, 64, 110, 9],
      [6000, 2600, 20, 68, 118, 9.4],
      [8000, 2700, 0, 77, 124, 10.4],
      [10000, 2700, 0, 72, 123, 9.8],
      [12000, 2300, 20, 41, 92, 6.3],
    ]) {
      const row = cruise.rows.find(
        (r) =>
          r.pressureAltitudeFt === alt &&
          r.setting === `${rpm} RPM` &&
          r.isaDeltaC === isa,
      )!;
      expect(row.powerPct).toBe(power);
      expect(row.ktas).toBe(ktas);
      expect(row.fuelFlowLph).toBeCloseTo(gph! * 3.785411784, 8);
    }
  });

  it("supports fixed-pitch RPM without using lean interpolation rows above 75% as operating data", () => {
    const result = cruisePerformance(cruise, 2000, 11, 0, {
      rpm: 2400,
      mapInHg: 23,
    })!;
    expect(result.setting).toBe("2400 RPM");
    expect(result.ktas).toBe(110);
    expect(result.fuelFlowLph).toBeCloseTo(9 * 3.785411784, 8);
    const boundary = cruisePerformance(cruise, 2000, 11, 0, {
      rpm: 2525,
      mapInHg: 23,
    })!;
    expect(boundary.powerPct).toBe(75);
    expect(boundary.ktas).toBe(116.5);
    expect(boundary.fuelFlowLph).toBeCloseTo(10.2 * 3.785411784, 8);
    expect(fuelFlowAtPower(cruise, 2000, 11, 75)).toBeCloseTo(
      10.2 * 3.785411784,
      8,
    );
    expect(
      cruisePerformance(cruise, 2000, 11, 0, { rpm: 2550, mapInHg: 23 }),
    ).toBeNull();
    expect(fuelFlowAtPower(cruise, 2000, 11, 95)).toBeNull();
    expect(
      cruiseTableRead(cruise, 2000, 11, 0, { rpm: 2550, mapInHg: 23 }),
    ).toBeNull();
    expect(
      cruisePerformance(cruise, 2000, 11, 0, { rpm: 2350, mapInHg: 10 })?.ktas,
    ).toBe(107);
  });

  it("imports phase checklists and keeps emergency procedures as source-labelled references", () => {
    expect(profile.checklists).toHaveLength(20);
    expect(new Set(profile.checklists.map((c) => c.phase)).size).toBe(7);
    expect(
      profile.checklists
        .find((c) => c.id === "c172s-takeoff")
        ?.sections[0]?.items.find((r) => r.action === "Elevator")?.expected,
    ).toContain("55 KIAS");
    expect(profile.emergencyProcedures).toHaveLength(26);
    expect(
      profile.emergencyProcedures.every(
        (p) =>
          p.aircraftType === "C172S" &&
          p.status === "reference" &&
          !operationalProcedure(p),
      ),
    ).toBe(true);
    expect(
      new Set(
        profile.emergencyProcedures.flatMap((p) => p.items.map((i) => i.id)),
      ).size,
    ).toBe(profile.emergencyProcedures.reduce((s, p) => s + p.items.length, 0));
    for (const p of profile.emergencyProcedures) {
      if (p.branchKey)
        expect(
          profile.emergencyProcedures.some((b) => b.key === p.branchKey),
        ).toBe(true);
    }
    expect(
      profile.emergencyProcedures.find((p) => p.key === "c172s-fire-flight")
        ?.items[5]?.text,
    ).toContain("100 KIAS");
    expect(
      profile.emergencyProcedures.find((p) => p.key === "c172s-static")?.items,
    ).toHaveLength(4);
  });
});
