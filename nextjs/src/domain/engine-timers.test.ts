import { describe, expect, it } from "vitest";
import {
  emptyEngineTimers,
  engineTimerSeconds,
  observeEngineTimers,
} from "./engine-timers";

const input = (now: number, speed: number | null = 0) => ({
  session: "flight-1",
  phase: "taxiin" as const,
  now,
  sample: { at: now, groundSpeedKt: speed, onGround: true },
});

describe("engine assistants", () => {
  it("counts one minute of continuously observed stationary taxi-in", () => {
    let state = observeEngineTimers(emptyEngineTimers, input(1000));
    expect(engineTimerSeconds(state.coolStartedAt, 1000)).toBe(60);
    for (let now = 11000; now <= 61000; now += 10000)
      state = observeEngineTimers(state, input(now));
    expect(state.coolStartedAt).toBe(1000);
    expect(engineTimerSeconds(state.coolStartedAt, 61000)).toBe(0);
    expect(engineTimerSeconds(state.coolStartedAt, 100000)).toBe(0);
  });
  it("resets immediately on movement and starts a fresh minute on the next stop", () => {
    const stopped = observeEngineTimers(emptyEngineTimers, input(1000));
    const moving = observeEngineTimers(stopped, input(21000, 2));
    expect(moving.coolStartedAt).toBeNull();
    const stoppedAgain = observeEngineTimers(moving, input(31000));
    expect(engineTimerSeconds(stoppedAgain.coolStartedAt, 31000)).toBe(60);
  });
  it("does not infer cooling across stale, missing, paused or airborne telemetry", () => {
    const state = observeEngineTimers(emptyEngineTimers, input(1000));
    for (const sample of [
      null,
      { ...input(2000).sample, groundSpeedKt: null },
      { ...input(2000).sample, groundSpeedKt: NaN },
      { ...input(2000).sample, onGround: false },
      { ...input(2000).sample, paused: true },
      { ...input(2000).sample, at: -20000 },
    ])
      expect(
        observeEngineTimers(state, { ...input(2000), sample }).coolStartedAt,
      ).toBeNull();
    expect(observeEngineTimers(state, input(31000)).coolStartedAt).toBe(31000);
  });
  it("gates cooling to an active taxi-in and resets timers for a different flight", () => {
    const state = {
      ...emptyEngineTimers,
      session: "flight-1",
      warmStartedAt: 1000,
    };
    expect(
      observeEngineTimers(state, { ...input(2000), phase: "taxiout" })
        .coolStartedAt,
    ).toBeNull();
    expect(
      observeEngineTimers(state, { ...input(2000), session: null })
        .warmStartedAt,
    ).toBeNull();
    expect(
      observeEngineTimers(state, { ...input(2000), session: "flight-2" })
        .warmStartedAt,
    ).toBeNull();
    expect(observeEngineTimers(state, input(2000)).warmStartedAt).toBe(1000);
  });
  it("counts warm-up down to zero and never displays a negative or extended minute", () => {
    expect(engineTimerSeconds(null, 1000)).toBe(60);
    expect(engineTimerSeconds(1000, 18000)).toBe(43);
    expect(engineTimerSeconds(1000, 61000)).toBe(0);
    expect(engineTimerSeconds(1000, 100000)).toBe(0);
    expect(engineTimerSeconds(1000, 0)).toBe(60);
  });
});
