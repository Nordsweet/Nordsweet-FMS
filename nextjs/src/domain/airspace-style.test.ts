import { expect, test } from "vitest";
import { airspaceFeatureSchema } from "~/api/aviation/schemas";
import { airspaceStyle } from "./airspace-style";

const zone = (
  name: string,
  active_now: boolean | null = true,
  remarks: string | null = null,
) =>
  airspaceFeatureSchema.shape.properties.parse({
    name,
    class: "G",
    lower: "GND",
    upper: "FL95",
    active_now,
    activations: [
      {
        designator: name,
        country: "PL",
        lower: "GND",
        upper: "FL95",
        starts_at: "2026-10-15T12:00:00Z",
        ends_at: "2026-10-15T18:00:00Z",
        unit: null,
        remarks,
        source: "pansa.uup",
      },
    ],
  });

test.each([
  ["ATZ EPNT", "#126cac"],
  ["CTR EPKK", "#b35a00"],
  ["TMA EPKK A", "#b35a00"],
  ["EP P23", "#bb2e42"],
  ["EP R11", "#bb2e42"],
])(
  "%s keeps its class color for active, inactive and unknown status",
  (name, color) => {
    for (const status of [true, false, null])
      expect(airspaceStyle(zone(name, status)).stroke).toBe(color);
  },
);

test.each(["ATZ EPNT", "CTR EPKK", "TMA EPKK A"])(
  "%s halves only confirmed inactive fill",
  (name) => {
    const active = airspaceStyle(zone(name, true));
    const inactive = airspaceStyle(zone(name, false));
    const unknown = airspaceStyle(zone(name, null));
    expect(inactive.fill).toBe(active.fill);
    expect(inactive.stroke).toBe(active.stroke);
    expect(inactive.fillOpacity).toBe(active.fillOpacity / 2);
    expect(unknown.fillOpacity).toBe(active.fillOpacity);
  },
);

test("PJE is a case-insensitive remarks token on an ATZ, independent of activation status", () => {
  expect(airspaceStyle(zone("ATZ EPNT", true, "PJE")).parachuting).toBe(true);
  expect(
    airspaceStyle(zone("ATZ EPKR", false, "GLD / pje / VFR")).parachuting,
  ).toBe(true);
  expect(airspaceStyle(zone("ATZ EPNT", null, null)).parachuting).toBe(false);
  expect(airspaceStyle(zone("ATZ EPNT", true, "XPJEX")).parachuting).toBe(
    false,
  );
  expect(airspaceStyle(zone("CTR EPKK", true, "PJE")).parachuting).toBe(false);
});

test("other airspace types retain their existing active emphasis", () => {
  expect(airspaceStyle(zone("EPTR165", true)).stroke).toBe("#d92947");
  expect(airspaceStyle(zone("EPTR165", false)).fillOpacity).toBe(1);
});
