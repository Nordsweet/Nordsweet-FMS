import { describe, expect, it } from "vitest";

import { type AirspaceFeature } from "~/api/aviation/schemas";
import { mapLabelVisibility } from "~/domain/map-labels";
import {
  coordinatePaths,
  toPaths,
  toPoints,
  zoneDatum,
} from "~/features/map/deck/data";
import { minuteLabels, trafficLabels } from "~/features/map/deck/labels";

const zone = (kind: string, active: boolean | null): AirspaceFeature => ({
  type: "Feature",
  bbox: [0, 0, 1, 1],
  geometry: {
    type: "Polygon",
    coordinates: [
      [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 0],
      ],
    ],
  },
  properties: {
    name: kind,
    class: "G",
    lower: "GND",
    upper: "FL95",
    activations: [],
    active_now: active,
    frequencies: [],
  },
});

describe("map data for deck.gl", () => {
  it("points keep [lon, lat] order and default to the IFR symbol", () => {
    expect(
      toPoints([
        { ident: "A", name: "A", kind: "ifr-waypoint", lat: 50, lon: 19 },
      ]),
    ).toEqual([
      {
        position: [19, 50],
        ident: "A",
        name: "A",
        kind: "ifr-waypoint",
        symbol: "ifr",
        heading: 0,
      },
    ]);
  });

  it("paths need two points and are drawn as [lon, lat]", () => {
    expect(
      toPaths([
        [{ lat: 1, lon: 2 }],
        [
          { lat: 1, lon: 2 },
          { lat: 3, lon: 4 },
        ],
      ]),
    ).toEqual([
      {
        path: [
          [2, 1],
          [4, 3],
        ],
      },
    ]);
    expect(
      coordinatePaths([
        [
          [5, 6],
          [7, 8],
        ],
      ]),
    ).toEqual([
      {
        path: [
          [5, 6],
          [7, 8],
        ],
      },
    ]);
  });

  it("an active zone is red and thick; a dark map lightens its outline only", () => {
    const active = zoneDatum(zone("R 1", true), "light");
    expect(active.lineWidth).toBe(2.2);
    const normal = zoneDatum(zone("TMZ", null), "light");
    const night = zoneDatum(zone("TMZ", null), "dark");
    expect(night.fill).toEqual(normal.fill);
    expect(night.stroke[0]).toBeGreaterThan(normal.stroke[0]);
  });

  it("traffic labels fade with the aircraft and fall back to dashes", () => {
    const aircraft = {
      hex: "48abcd",
      callsign: null,
      registration: "SP-GUN",
      type: null,
      lat: 50,
      lon: 20,
      altitude_ft: 3050.4,
      on_ground: false,
      ground_speed_kt: 90.2,
      track_deg: 7,
      vertical_rate_fpm: null,
      squawk: null,
      position_time: "2026-10-15T10:00:00Z",
      sources: [],
    };
    const full = trafficLabels(aircraft, [20, 50], 1, "light");
    expect(full.callsign.text).toBe("SP-GUN");
    expect(full.details.text).toBe("007 deg / 3050 ft / 90 kt");
    const faded = trafficLabels(
      {
        ...aircraft,
        track_deg: null,
        altitude_ft: null,
        ground_speed_kt: null,
      },
      [20, 50],
      0.5,
      "light",
    );
    expect(faded.details.text).toBe("TRK -- / ALT -- / SPD --");
    expect(faded.callsign.color[3]).toBe(
      Math.round(full.callsign.color[3] * 0.5),
    );
  });

  it("minute numbers sit along the track and only for a moving aircraft", () => {
    const fix = { lat: 50, lon: 20, trackDeg: 90, groundSpeedKt: 120 };
    const labels = minuteLabels(fix, "light");
    expect(labels.map((l) => l.text)).toEqual(["1", "2", "3", "4", "5"]);
    expect(labels[0]!.position[0]).toBeGreaterThan(20); // east
    expect(minuteLabels({ ...fix, groundSpeedKt: 0.4 }, "light")).toEqual([]);
    expect(minuteLabels({ ...fix, trackDeg: null }, "light")).toEqual([]);
  });

  it("label stages follow the map zoom, not the theme", () => {
    expect(mapLabelVisibility(7, true).pointNames).toBe(false);
    expect(mapLabelVisibility(8, true).pointNames).toBe(true);
    expect(mapLabelVisibility(9, false).airspaceNames).toBe(false);
  });
});
