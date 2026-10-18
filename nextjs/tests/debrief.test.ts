import { beforeEach, describe, expect, it } from "vitest";
import { newFlight } from "~/data/flight";
import { debriefStatistics, validateDebrief } from "~/domain/debrief";
import { useInFlight } from "~/stores/inflight";
import { useFlight } from "~/stores/flight";
import { useAircraftState, aircraftStateKey } from "~/stores/aircraft-state";
import { newTimers } from "~/domain/flight-timers";

beforeEach(() => {
  useInFlight.setState(useInFlight.getInitialState(), true);
  useAircraftState.setState({ states: {} });
  useFlight.getState().load({
    ...newFlight(),
    name: "Recorded flight",
    registration: "sp-abc",
    fuel: { blockL: 100 },
  });
  useAircraftState.getState().record(aircraftStateKey("C172S", "SPABC"), {
    mth: "00123.40",
    fuelAddedL: 20,
  });
});
const start = () => useInFlight.getState().start([], null, null, "C172S");

describe("postflight actual readings", () => {
  it("freezes departure readings, accepts deltas and saves only the captured airframe", () => {
    start();
    useFlight
      .getState()
      .update({ registration: "SP-OTHER", fuel: { blockL: 200 } });
    useAircraftState.getState().record("C172S::SPABC", { mth: "00500.00" });
    useInFlight.getState().end();
    expect(useInFlight.getState().acceptDebrief("123,70", "72.5")).toBeNull();
    const record = useInFlight.getState().debrief!;
    expect(debriefStatistics(record)).toMatchObject({
      mthUsed: 0.3,
      fuelUsedL: 27.5,
    });
    expect(useAircraftState.getState().states["C172S::SPABC"]).toMatchObject({
      mth: "00123.70",
      fuelRemainingL: 72.5,
      fuelUsedL: 27.5,
      fuelAddedL: 0,
    });
    expect(
      useAircraftState.getState().states["C172S::SPOTHER"],
    ).toBeUndefined();
    useInFlight.getState().end();
    expect(useInFlight.getState().debrief).toBe(record);
    start();
    expect(useInFlight.getState().debrief?.accepted).toBeNull();
    expect(useInFlight.getState().debrief?.endedAt).toBeNull();
  });
  it("rejects missing, negative, decreasing or refuelled readings without writing state", () => {
    start();
    useInFlight.getState().end();
    const record = useInFlight.getState().debrief!;
    for (const [mth, fuel, error] of [
      ["", "50", "mthRequired"],
      ["123.50", "-1", "fuelRequired"],
      ["123.39", "50", "mthBefore"],
      ["124", "101", "fuelBefore"],
      ["1e3", "50", "mthRequired"],
      ["100000", "50", "mthRequired"],
    ]) {
      expect(validateDebrief(record, mth!, fuel!)).toEqual({
        ok: false,
        error,
      });
    }
    expect(useInFlight.getState().acceptDebrief("123", "50")).toBe("mthBefore");
    expect(useInFlight.getState().debrief?.accepted).toBeNull();
    expect(useAircraftState.getState().states["C172S::SPABC"]?.mth).toBe(
      "00123.40",
    );
  });
  it("preserves zero readings and unknown baselines without estimating engine hours from air time", () => {
    useFlight.getState().update({ fuel: { blockL: 0 } });
    start();
    const unknown = { ...useInFlight.getState().debrief!, mthBefore: null };
    const result = validateDebrief(unknown, "0", "0");
    expect(result).toMatchObject({ ok: true, mthAfter: 0, fuelAfterL: 0 });
    expect(
      debriefStatistics({
        ...unknown,
        accepted: { mthAfter: 0, fuelAfterL: 0, at: 0 },
      }),
    ).toMatchObject({ mthUsed: null, fuelUsedL: null });
    const known = {
      ...unknown,
      mthBefore: 0,
      fuelBeforeL: 0,
      accepted: { mthAfter: 0, fuelAfterL: 0, at: 0 },
    };
    expect(debriefStatistics(known)).toMatchObject({
      mthUsed: 0,
      fuelUsedL: 0,
    });
  });
  it("uses stopped operational timers across midnight and leaves missing events unavailable", () => {
    start();
    const timers = newTimers();
    const before = Date.parse("2026-10-18T23:40:00Z");
    timers.offBlock = {
      ...timers.offBlock,
      startedAt: before,
      stoppedAt: before + 90 * 60000,
    };
    timers.airTime = {
      ...timers.airTime,
      startedAt: before + 10 * 60000,
      stoppedAt: before + 80 * 60000,
    };
    useInFlight.setState({ timers });
    useInFlight.getState().end();
    expect(debriefStatistics(useInFlight.getState().debrief!)).toMatchObject({
      blockMs: 5400000,
      airMs: 4200000,
    });
    expect(
      debriefStatistics({
        ...useInFlight.getState().debrief!,
        times: {
          offBlockAt: before,
          onBlockAt: null,
          takeoffAt: null,
          landingAt: null,
        },
      }),
    ).toMatchObject({ blockMs: null, airMs: null });
  });
});
