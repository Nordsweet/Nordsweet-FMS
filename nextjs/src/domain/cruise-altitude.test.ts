import { describe, expect, it } from "vitest";
import { newFlight } from "~/data/flight";
import {
  emptyCruiseAltitudeMonitor as empty,
  observeCruiseAltitude as observe,
  roundedCruiseAltitude,
  changedCruiseAltitude,
  type CruiseAltitudeMonitor,
} from "./cruise-altitude";
const input = (
  at: number,
  altitudeFt = 6000,
  verticalSpeedFpm: number | undefined = 0,
) => ({
  session: "flight",
  plannedFt: 5000,
  phase: "cruise" as const,
  source: "connector",
  sample: { at, altitudeFt, verticalSpeedFpm },
});
const hold = (
  state: CruiseAltitudeMonitor = empty,
  start = 0,
  end = 120000,
  altitude = 6000,
) => {
  for (let at = start; at <= end; at += 5000)
    state = observe(state, input(at, altitude));
  return state;
};
describe("cruise altitude level-off", () => {
  it("prefers thousands within 100 ft, otherwise full hundreds", () => {
    expect([5899, 5900, 6099, 6101, 6559].map(roundedCruiseAltitude)).toEqual([
      5900, 6000, 6000, 6100, 6600,
    ]);
  });
  it("requires a full two minutes and pins the candidate through tolerated fluctuations", () => {
    let state = hold(empty, 0, 115000, 5980);
    expect(state.offeredFt).toBeNull();
    state = observe(state, input(120000, 6090));
    expect(state.offeredFt).toBe(6000);
  });
  it("does not follow a continuing climb or treat one reused observation as two minutes", () => {
    let state = empty;
    for (let at = 0; at <= 180000; at += 5000)
      state = observe(state, input(at, 5200 + at / 120, 500));
    expect(state.offeredFt).toBeNull();
    state = empty;
    for (let at = 0; at <= 120000; at += 5000)
      state = observe(state, input(at, 5920 + at / 750, 80));
    expect(state.offeredFt).toBeNull();
    state = empty;
    for (let at = 0; at <= 120000; at += 5000)
      state = observe(state, {
        ...input(at),
        sample: { at, altitudeFt: 5920 + at / 750 },
      });
    expect(state.offeredFt).toBeNull();
    state = hold(empty, 0, 115000);
    expect(observe(state, input(115000)).offeredFt).toBeNull();
  });
  it("resets for a gap, invalid data, out-of-band altitude, pause/blocked phase or source change", () => {
    const almost = hold(empty, 0, 115000);
    for (const next of [
      input(140001),
      input(120000, 6300),
      { ...input(120000), sample: null },
      { ...input(120000), blocked: true },
      { ...input(120000), phase: "descent" as const },
      { ...input(120000), source: "gps" },
    ])
      expect(observe(almost, next).offeredFt).toBeNull();
    expect(
      hold(observe(almost, { ...input(120000), sample: null }), 125000, 240000)
        .offeredFt,
    ).toBeNull();
    expect(hold(empty, 0, 180000, 5050).offeredFt).toBeNull();
  });
  it("NO is remembered for this level, but another level or a new flight can be offered", () => {
    const declined = { ...hold(), offeredFt: null, declined: [6000] };
    expect(hold(declined, 125000, 300000).offeredFt).toBeNull();
    expect(hold(declined, 305000, 425000, 6500).offeredFt).toBe(6500);
    expect(
      observe(declined, { ...input(125000), session: "new" }).declined,
    ).toEqual([]);
  });
  it("recalculates only future cruise-based levels, preserving manual/published constraints and the circuit", () => {
    const flight = {
      ...newFlight(),
      cruiseAltitudeFt: 5000,
      waypointAltitudes: {
        PAST: 5000,
        FREE: 5000,
        LIMIT: 5000,
        PUBLISHED: 5000,
        LOW: 3000,
      },
      pointRestrictions: {
        LIMIT: { altitudeFt: 5000, speedKt: null, altitudeMode: "at" as const },
      },
    };
    const points = ["PAST", "FREE", "LIMIT", "PUBLISHED", "LOW", "TP1"].map(
      (ident) => ({
        ident,
        lat: 50,
        lon: 19,
        altitudeFt: ident === "LOW" ? 3000 : 5000,
        ...(ident === "TP1" ? { patternId: "circuit" } : {}),
      }),
    );
    const change = changedCruiseAltitude(flight, 6000, points, 0, [
      "PUBLISHED",
    ]);
    expect(change.patch.waypointAltitudes).toEqual({
      PAST: 5000,
      FREE: 6000,
      LIMIT: 5000,
      PUBLISHED: 5000,
      LOW: 3000,
    });
    expect(change.route.map((p) => p.altitudeFt)).toEqual([
      5000, 6000, 5000, 5000, 3000, 5000,
    ]);
    expect(flight.cruiseAltitudeFt).toBe(5000);
  });
});
