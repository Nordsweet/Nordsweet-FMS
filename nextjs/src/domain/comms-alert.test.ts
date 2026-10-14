import { describe, expect, it } from "vitest";
import { estimateComms, type CommsEstimate, type RadioRow } from "./comms";
import { commsChangeSuggestion } from "./comms-alert";
const current: RadioRow = {
  frequencyMhz: "125.275",
  callsign: "Poznań Informacja",
  sector: null,
};
const next: RadioRow = {
  frequencyMhz: "119.275",
  callsign: "Kraków Informacja",
  sector: null,
  serviceId: "fiss",
};
const estimate = (seconds: number | null): CommsEstimate => ({
  current: [current],
  next: [next],
  seconds,
  distanceNm: 4,
  speedKt: 120,
  speedSource: "gps",
  notes: ["sectors", "approximate"],
});
describe("two-minute radio hand-off suggestion", () => {
  it("waits until 120 seconds and stays available until the boundary", () => {
    expect(
      commsChangeSuggestion("cruise", estimate(120.001), new Set()),
    ).toBeNull();
    expect(
      commsChangeSuggestion("cruise", estimate(120), new Set())?.rows,
    ).toEqual([next]);
    expect(
      commsChangeSuggestion("cruise", estimate(1), new Set())?.rows,
    ).toEqual([next]);
    for (const time of [0, -1, null, Infinity, NaN])
      expect(
        commsChangeSuggestion("cruise", estimate(time), new Set()),
      ).toBeNull();
  });
  it("does not reappear after dismissal, but allows a different hand-off", () => {
    const suggestion = commsChangeSuggestion(
      "cruise",
      estimate(120),
      new Set(),
    )!;
    const dismissed = new Set([suggestion.key]);
    expect(commsChangeSuggestion("cruise", estimate(90), dismissed)).toBeNull();
    const changed = {
      ...estimate(100),
      next: [{ ...next, frequencyMhz: "119.650" }],
    };
    expect(commsChangeSuggestion("cruise", changed, dismissed)?.rows).toEqual(
      changed.next,
    );
  });
  it("is silent outside cruise, without a next channel, or for unchanged channels", () => {
    expect(
      commsChangeSuggestion("takeoff", estimate(100), new Set()),
    ).toBeNull();
    expect(
      commsChangeSuggestion(
        "cruise",
        { ...estimate(100), next: [] },
        new Set(),
      ),
    ).toBeNull();
    expect(
      commsChangeSuggestion(
        "cruise",
        { ...estimate(100), current: [next] },
        new Set(),
      ),
    ).toBeNull();
  });
  it("uses the predicted sector boundary and remains silent without a fresh GPS fix", () => {
    const route = [
      { lat: 50, lon: 20 },
      { lat: 52, lon: 20 },
    ];
    const radio = {
      dep: () => [],
      arr: () => [],
      at: (p: { lat: number }) => (p.lat < 51 ? [current] : [next]),
    };
    const input = {
      phase: "cruise" as const,
      position: { lat: 50.96, lon: 20 },
      gpsSpeedKt: 120,
      plannedSpeedKt: 100,
      route,
    };
    expect(
      commsChangeSuggestion("cruise", estimateComms(input, radio), new Set())
        ?.rows,
    ).toEqual([next]);
    expect(
      commsChangeSuggestion(
        "cruise",
        estimateComms({ ...input, position: { lat: 50.9, lon: 20 } }, radio),
        new Set(),
      ),
    ).toBeNull();
    expect(
      commsChangeSuggestion(
        "cruise",
        estimateComms({ ...input, position: null }, radio),
        new Set(),
      ),
    ).toBeNull();
  });
});
