import { describe, expect, it } from "vitest";
import { type TrafficAircraft } from "~/api/aviation/schemas";
import { MAX_TRACKED_AIRCRAFT, observeTraffic } from "./traffic-session";

const NOW = Date.parse("2026-10-30T12:00:00Z");
const plane = (hex: string, ageMs: number, lat = 50): TrafficAircraft =>
  ({
    hex,
    lat,
    lon: 20,
    callsign: "LOT 1",
    position_time: new Date(NOW - ageMs).toISOString(),
  }) as TrafficAircraft;

describe("traffic session history", () => {
  it("appends samples per aircraft and normalises the callsign", () => {
    const first = observeTraffic(new Map(), [plane("a", 10_000)], NOW);
    const next = observeTraffic(first, [plane("a", 0, 50.5)], NOW);
    expect(next.get("a")).toHaveLength(2);
    expect(next.get("a")![0]!.callsign).toBe("LOT1");
  });

  it("drops aircraft not seen for 6 hours", () => {
    const histories = observeTraffic(
      new Map(),
      [plane("old", 7 * 3600_000), plane("new", 0)],
      NOW,
    );
    expect([...histories.keys()]).toEqual(["new"]);
  });

  it("keeps at most MAX_TRACKED_AIRCRAFT, the longest unseen going first", () => {
    const crowd = Array.from({ length: MAX_TRACKED_AIRCRAFT + 20 }, (_, i) =>
      plane(`h${i}`, (MAX_TRACKED_AIRCRAFT + 20 - i) * 1000),
    );
    const histories = observeTraffic(new Map(), crowd, NOW);
    expect(histories.size).toBe(MAX_TRACKED_AIRCRAFT);
    expect(histories.has("h0")).toBe(false);
    expect(histories.has(`h${MAX_TRACKED_AIRCRAFT + 19}`)).toBe(true);
  });

  it("does not change the map it was given", () => {
    const before = observeTraffic(new Map(), [plane("a", 0)], NOW);
    observeTraffic(before, [plane("b", 0)], NOW);
    expect([...before.keys()]).toEqual(["a"]);
  });
});
