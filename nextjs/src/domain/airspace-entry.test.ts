import { describe, expect, it } from "vitest";
import type { AirspaceFeature } from "~/api/aviation/schemas";
import {
  airspaceEntryObservations,
  emptyEntryMonitor,
  observeEntryMonitor,
  requiresEntryClearance,
} from "./airspace-entry";

const zone = (name = "TEST C", cls = "C"): AirspaceFeature => ({
  type: "Feature",
  bbox: [20.03, 49.99, 20.08, 50.01],
  geometry: {
    type: "Polygon",
    coordinates: [
      [
        [20.03, 49.99],
        [20.08, 49.99],
        [20.08, 50.01],
        [20.03, 50.01],
        [20.03, 49.99],
      ],
    ],
  },
  properties: {
    name,
    class: cls,
    lower: "GND",
    upper: "FL095",
    active_now: true,
    activations: [],
    frequencies: [],
  },
});
const position = {
  lat: 50,
  lon: 19.99,
  altitudeFt: 5000,
  altitudeAglFt: 4000,
  groundSpeedKt: 120,
  trackDeg: 90,
  verticalSpeedFpm: 0,
};

describe("airspace entry alerts", () => {
  it("includes C, CTR/TMA and TR but not unrelated uncontrolled zones", () => {
    for (const [name, cls] of [
      ["TEST", "C"],
      ["CTR TEST", "CTR"],
      ["TMA TEST", "TMA"],
      ["TR 165", "TR"],
      ["EPTR165", "R"],
    ])
      expect(requiresEntryClearance(zone(name, cls))).toBe(true);
    expect(requiresEntryClearance(zone("ATZ TEST", "G"))).toBe(false);
  });
  it("predicts entry within two minutes from measured track rather than mere proximity", () => {
    const observation = airspaceEntryObservations([zone()], position)[0]!;
    expect(observation.seconds).toBeGreaterThan(40);
    expect(observation.seconds).toBeLessThan(55);
    expect(observation.inside).toBe(false);
    expect(
      airspaceEntryObservations([zone()], { ...position, trackDeg: 270 })[0]!
        .seconds,
    ).toBeNull();
    expect(
      airspaceEntryObservations([zone()], {
        ...position,
        groundSpeedKt: 10,
      })[0]!.seconds,
    ).toBeNull();
    expect(
      airspaceEntryObservations([zone()], { ...position, lon: 20.04 })[0]!
        .seconds,
    ).toBe(0);
  });
  it("ignores inactive zones and vertically separated flight, but anticipates a climb into a shelf", () => {
    const volume = zone();
    volume.properties.lower = "6000 FT AMSL";
    expect(
      airspaceEntryObservations([volume], position)[0]!.seconds,
    ).toBeNull();
    const climbing = airspaceEntryObservations([volume], {
      ...position,
      verticalSpeedFpm: 1000,
    })[0]!;
    expect(climbing.seconds).toBeCloseTo(60, 2);
    expect(
      airspaceEntryObservations([volume], {
        ...position,
        altitudeFt: 11000,
      })[0]!.seconds,
    ).toBeNull();
    volume.properties.active_now = false;
    expect(airspaceEntryObservations([volume], position)).toEqual([]);
  });
  it("respects holes and deduplicates overlapping source copies of the same zone", () => {
    expect(airspaceEntryObservations([zone(), zone()], position)).toHaveLength(
      1,
    );
    const withHole = zone();
    withHole.geometry.coordinates.push([
      [20.04, 49.995],
      [20.07, 49.995],
      [20.07, 50.005],
      [20.04, 50.005],
      [20.04, 49.995],
    ]);
    expect(
      airspaceEntryObservations([withHole], {
        ...position,
        lon: 20.05,
        groundSpeedKt: 0,
      })[0]!.inside,
    ).toBe(false);
    expect(
      airspaceEntryObservations([withHole], {
        ...position,
        lon: 20.05,
        groundSpeedKt: 0,
      })[0]!.seconds,
    ).toBeNull();
  });
  it("keeps clearance for the approach/entry, re-arms after exit and isolates different zones/flights", () => {
    const observations = airspaceEntryObservations(
      [zone(), zone("TR 165", "TR")],
      position,
    );
    let state = observeEntryMonitor(
      emptyEntryMonitor,
      "flight-1",
      observations,
    );
    expect(state.visits).toHaveLength(2);
    const firstVisit = state.visits[0]!.visit;
    state.visits[0]!.cleared = true;
    state = observeEntryMonitor(
      state,
      "flight-1",
      airspaceEntryObservations([zone(), zone("TR 165", "TR")], {
        ...position,
        lon: 20.04,
      }),
    );
    expect(state.visits[0]!.cleared).toBe(true);
    expect(state.visits[1]!.cleared).toBe(false);
    state = observeEntryMonitor(
      state,
      "flight-1",
      airspaceEntryObservations([zone()], { ...position, lon: 20.12 }),
    );
    expect(state.visits).toHaveLength(0);
    state = observeEntryMonitor(state, "flight-1", observations);
    expect(state.visits[0]!.cleared).toBe(false);
    expect(state.visits[0]!.visit).toBeGreaterThan(firstVisit);
    state.visits[0]!.cleared = true;
    state = observeEntryMonitor(state, "flight-2", observations);
    expect(state.visits[0]!.cleared).toBe(false);
  });
});
