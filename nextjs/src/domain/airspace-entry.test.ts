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

function sector(name: string, cls: string, west: number, east: number) {
  const result = zone(name, cls);
  result.bbox = [west, 49.99, east, 50.01];
  result.geometry.coordinates = [
    [
      [west, 49.99],
      [east, 49.99],
      [east, 50.01],
      [west, 50.01],
      [west, 49.99],
    ],
  ];
  return result;
}

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
  it("treats adjacent shelves of the same TMA as one clearance visit", () => {
    const zones = [
      sector("TMA EPKK A", "C", 20, 20.04),
      sector("TMA EPKK B", "C", 20.04, 20.08),
    ];
    let state = observeEntryMonitor(
      emptyEntryMonitor,
      "flight",
      airspaceEntryObservations(zones, position),
    );
    expect(state.visits).toHaveLength(1);
    state.visits[0]!.cleared = true;
    const visit = state.visits[0]!.visit;
    state = observeEntryMonitor(
      state,
      "flight",
      airspaceEntryObservations(zones, { ...position, lon: 20.02 }),
    );
    expect(state.visits).toHaveLength(1);
    state = observeEntryMonitor(
      state,
      "flight",
      airspaceEntryObservations(zones, { ...position, lon: 20.06 }),
    );
    expect(state.visits).toHaveLength(1);
    expect(state.visits[0]).toMatchObject({
      visit,
      cleared: true,
      inside: true,
    });
    state = observeEntryMonitor(
      state,
      "flight",
      airspaceEntryObservations(zones, { ...position, lon: 20.2 }),
    );
    expect(state.visits).toHaveLength(0);
    state = observeEntryMonitor(
      state,
      "flight",
      airspaceEntryObservations(zones, position),
    );
    expect(state.visits[0]!.cleared).toBe(false);
    expect(state.visits[0]!.visit).toBeGreaterThan(visit);
  });
  it("makes a different controlled area and FIR boundary informational without treating TR as controlled", () => {
    const zones = [
      sector("TMA EPKK A", "C", 20, 20.04),
      sector("CTR EPKT", "C", 20.04, 20.08),
      sector("FIR BRATISLAVA", "G", 20.04, 20.2),
      sector("TR 165", "TR", 20.04, 20.08),
    ];
    const observations = airspaceEntryObservations(zones, {
      ...position,
      lon: 20.02,
    });
    expect(observations.find((o) => o.name === "CTR EPKT")).toMatchObject({
      inside: false,
      informationOnly: true,
    });
    expect(observations.find((o) => o.name === "FIR BRATISLAVA")).toMatchObject(
      { inside: false, informationOnly: true },
    );
    expect(observations.find((o) => o.name === "TR 165")).toMatchObject({
      informationOnly: false,
    });
    let state = observeEntryMonitor(emptyEntryMonitor, "flight", observations);
    state = observeEntryMonitor(
      state,
      "flight",
      airspaceEntryObservations(zones, { ...position, lon: 20.05 }),
    );
    expect(
      state.visits.find((o) => o.name === "CTR EPKT")?.informationOnly,
    ).toBe(true);
    expect(
      state.visits.find((o) => o.name === "FIR BRATISLAVA")?.informationOnly,
    ).toBe(true);
  });
});
