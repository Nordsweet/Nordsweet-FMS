import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { aircraftSchema } from "~/data/aircraft";
import { resolveAircraft } from "~/domain/aircraft";
import { cruisePerformance } from "~/domain/cruise-performance";

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
const profile = aircraft.find((a) => a.id === "CT182T")!;

describe("Carenado CT182T supplied manuals", () => {
  it("resolves as its own aircraft and does not invent unavailable performance", () => {
    expect(resolveAircraft(aircraft, "CT182T", "TEST")).toBe(profile);
    expect(profile.icaoType).toBe("C82S");
    expect(profile.referenceData?.simulationOnly).toBe(true);
    for (const value of [
      profile.takeoff,
      profile.landing,
      profile.climb,
      profile.weightBalance,
      profile.usableFuelL,
      profile.windLimits,
    ])
      expect(value).toBeNull();
  });
  it("imports the eleven cruise sheets, skips dashed cells and converts US gallons", () => {
    const rows = profile.cruise!.rows;
    expect(rows).toHaveLength(893);
    expect(
      new Set(
        rows.map((r) => `${r.pressureAltitudeFt}/${r.setting}/${r.isaDeltaC}`),
      ).size,
    ).toBe(893);
    expect([...new Set(rows.map((r) => r.pressureAltitudeFt))]).toEqual(
      Array.from({ length: 11 }, (_, i) => i * 2000),
    );
    const row = rows.find(
      (r) =>
        r.pressureAltitudeFt === 0 &&
        r.setting === "2400 RPM / 28 inHg" &&
        r.isaDeltaC === 0,
    )!;
    expect(row.ktas).toBe(139);
    expect(row.powerPct).toBe(83);
    expect(row.fuelFlowLph).toBeCloseTo(16.8 * 3.785411784, 5);
    expect(
      rows.some(
        (r) =>
          r.pressureAltitudeFt === 2000 &&
          r.setting === "2400 RPM / 28 inHg" &&
          r.isaDeltaC === -20,
      ),
    ).toBe(false);
    expect(
      rows.find(
        (r) =>
          r.pressureAltitudeFt === 14000 &&
          r.setting === "2100 RPM / 26 inHg" &&
          r.isaDeltaC === -20,
      )?.fuelFlowLph,
    ).toBeCloseTo(13.8 * 3.785411784, 5);
  });
  it("preserves normal and emergency procedure ordering and climb settings", () => {
    expect(profile.checklists).toHaveLength(17);
    expect(profile.checklists[0]?.sections).toHaveLength(8);
    expect(profile.emergencyProcedures).toHaveLength(16);
    expect(
      profile.checklists.find((c) => c.name === "Normal Climb")?.sections[0]
        ?.items[3]?.expected,
    ).toBe("16 GPH");
    expect(
      profile.emergencyProcedures.find(
        (p) => p.title === "Engine Failure During Takeoff Roll",
      )?.items,
    ).toHaveLength(7);
    expect(
      profile.emergencyProcedures.every((p) => p.status === "reference"),
    ).toBe(true);
  });
  it("feeds the planner's manual cruise calculation at sea level and 20000 ft", () => {
    const low = cruisePerformance(profile.cruise!, 0, 15, 0, {
      rpm: 2400,
      mapInHg: 28,
    })!;
    expect(low.ktas).toBe(139);
    expect(low.fuelFlowLph).toBeCloseTo(16.8 * 3.785411784, 5);
    const high = cruisePerformance(profile.cruise!, 20000, -25, 0, {
      rpm: 2400,
      mapInHg: 26,
    })!;
    expect(high.ktas).toBe(162);
    expect(high.fuelFlowLph).toBeCloseTo(15.4 * 3.785411784, 5);
  });
});
