import { describe, expect, it } from "vitest";

import { type FlightPhase } from "./flight-phase";
import {
  type Sample,
  type Timers,
  duePhase,
  newTimers,
  stepTimers,
  timerElapsed,
  toggleTimer,
  utilityCountdown,
  utilityDone,
  utilityMain,
  utilityValue,
} from "./flight-timers";

/** Fly one sample per second; returns the timers and every phase the logic switched to. */
function fly(
  samples: Omit<Sample, "lat" | "lon">[],
  start: Timers = newTimers(),
  startPhase: FlightPhase = "taxiout",
) {
  let timers = start;
  let phase = startPhase;
  const phases: FlightPhase[] = [];
  for (const s of samples) {
    const due = duePhase(timers, s.at);
    if (due) {
      timers = due.timers;
      if (due.phase) phases.push((phase = due.phase));
    }
    const step = stepTimers(
      timers,
      { ...s, lat: 50, lon: 20 },
      {
        phase,
        departureElevationFt: 800,
        cruiseAltitudeFt: 3000,
        groundElevationFt: 800,
      },
    );
    timers = step.timers;
    if (step.phase) phases.push((phase = step.phase));
  }
  return { timers, phases, phase };
}

const seq = (
  from: number,
  n: number,
  f: (i: number) => Omit<Sample, "lat" | "lon" | "at">,
) => Array.from({ length: n }, (_, i) => ({ at: (from + i) * 1000, ...f(i) }));

describe("stepTimers", () => {
  it("detects off-block, take-off, top of climb/descent, landing and on-block like legacy", () => {
    const samples = [
      // Taxi at 10 kt: off-block after 5 s.
      ...seq(0, 20, () => ({ altitudeFt: 800, speedKt: 10, headingDeg: 90 })),
      // Take-off roll on 250°, accelerating; lift-off and through +50 ft after 12 s.
      ...seq(20, 12, (i) => ({
        altitudeFt: 800,
        speedKt: 20 + i * 4,
        headingDeg: 250,
      })),
      ...seq(32, 3, (i) => ({
        altitudeFt: 830 + i * 20,
        speedKt: 70,
        headingDeg: 250,
      })),
      // Climb to 3000 ft.
      ...seq(35, 140, (i) => ({
        altitudeFt: Math.min(3000, 870 + i * 16),
        speedKt: 90,
        headingDeg: 250,
      })),
      // Cruise, then descend at 600 ft/min.
      ...seq(175, 30, () => ({
        altitudeFt: 3000,
        speedKt: 110,
        headingDeg: 250,
      })),
      ...seq(205, 200, (i) => ({
        altitudeFt: Math.max(800, 3000 - i * 10),
        speedKt: Math.max(25, 100 - i),
        headingDeg: 70,
      })),
      // Rolled out and stopped.
      ...seq(405, 40, () => ({ altitudeFt: 800, speedKt: 0, headingDeg: 70 })),
    ];
    const { timers, phases } = fly(samples);
    expect(timers.events.map((e) => e.name)).toEqual([
      "Off-block",
      "Take-off",
      "Top of Climb",
      "Top of Descent",
      "Landing",
      "On-block",
    ]);
    expect(timers.offBlock.startedAt).toBe(0);
    expect(timers.airTime.startedAt).toBe(33_000); // the sample that crossed 850 ft
    expect(phases).toEqual(["climb", "cruise", "descent", "taxiin"]);
  });

  it("does not take off on a turning run", () => {
    const { timers } = fly(
      seq(0, 30, (i) => ({
        altitudeFt: i > 20 ? 900 : 800,
        speedKt: 20 + i * 3,
        headingDeg: (250 + i * 3) % 360,
      })),
    );
    expect(timers.airTime.startedAt).toBeNull();
  });

  it("manual start disarms GPS and shows HH:MM:SS", () => {
    const t = toggleTimer(newTimers(), "offBlock", 1000);
    expect(t.offBlock).toMatchObject({
      startedAt: 1000,
      source: "manual",
      autoArmed: false,
    });
    expect(timerElapsed(t.offBlock, 1000 + 3_725_000)).toBe("01:02:05");
    expect(timerElapsed(newTimers().airTime, 0)).toBe("--:--:--");
  });
});

describe("utility timers", () => {
  it("cycles stopwatch → stopped → reset and counts a countdown down", () => {
    const idle = newTimers().utility[0];
    const running = utilityMain(idle, 0);
    expect(utilityValue(running, 65_000)).toBe("01:05");
    const stopped = utilityMain(running, 70_000);
    expect(stopped.mode).toBe("stopped");
    expect(utilityMain(stopped, 80_000)).toEqual(idle);
    const countdown = utilityCountdown(2, 0);
    expect(utilityValue(countdown, 500)).toBe("02:00");
    expect(utilityValue(countdown, 61_000)).toBe("00:59");
    expect(utilityDone(countdown, 119_999)).toBe(false);
    expect(utilityDone(countdown, 120_000)).toBe(true);
  });
});
