import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { aircraftSchema } from "~/data/aircraft";

import {
  buildAircraft,
  draftFromAircraft,
  emptyDraft,
  withoutUnchangedRaw,
} from "./custom-aircraft";
import { computeDistance } from "./performance";

const minimal = () => ({
  ...emptyDraft(),
  type: "c182",
  icaoType: "c182",
});

describe("buildAircraft", () => {
  it("builds a type with only the required fields; empty sections stay null", () => {
    const result = buildAircraft(minimal(), []);
    expect(result.ok && result.aircraft).toMatchObject({
      id: "custom-C182",
      type: "C182",
      registration: null,
      icaoType: "C182",
      displayName: "C182",
      weightBalance: null,
      takeoff: null,
      landing: null,
      climb: null,
      cruise: null,
      windLimits: null,
    });
  });

  it("nests table rows into grids the performance code can read", () => {
    const draft = minimal();
    draft.takeoff = {
      ...draft.takeoff,
      weightKg: "1100",
      rows: [
        ["2000", "15", "300", "500"],
        ["0", "15", "250", "420"],
        ["0", "-5", "230", "400"],
      ],
    };
    const result = buildAircraft(draft, []);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const config = result.aircraft.takeoff!.configurations[0]!;
    const out = computeDistance(config, {
      weightKg: 1100,
      pressureAltitudeFt: 0,
      temperatureC: 15,
      headwindKt: 0,
      surface: "paved",
    } as Parameters<typeof computeDistance>[1]);
    expect(out.groundRollM).toBe(250);
    expect(out.warnings).toContainEqual({ code: "draft-data" });
  });

  it("rejects half-filled rows, duplicate rows and taken or missing types", () => {
    const half = minimal();
    half.cruise.rows = [["4000", "0", "75%", "", "30"]];
    expect(buildAircraft(half, [])).toMatchObject({
      ok: false,
      error: { code: "incomplete", section: "cruise" },
    });

    const dup = minimal();
    dup.climb.rows = [
      ["0", "15", "700", "75"],
      ["0", "15", "650", "75"],
    ];
    expect(buildAircraft(dup, [])).toMatchObject({
      ok: false,
      error: { code: "duplicate", section: "climb" },
    });

    expect(buildAircraft(minimal(), ["C-182"])).toMatchObject({
      ok: false,
      error: { code: "duplicate", section: "type" },
    });
    expect(buildAircraft({ ...minimal(), type: " " }, [])).toMatchObject({
      ok: false,
      error: { code: "required", section: "type" },
    });
  });

  it("needs the whole W&B section once any of it is filled in", () => {
    const draft = minimal();
    draft.weightBalance.mtowKg = "1100";
    expect(buildAircraft(draft, [])).toMatchObject({
      ok: false,
      error: { code: "incomplete", section: "weightBalance" },
    });
  });
});

describe("built-in aircraft overrides", () => {
  const builtIn = aircraftSchema
    .array()
    .parse(JSON.parse(readFileSync("public/data/aircraft.json", "utf8")));

  it("rebuilds every bundled aircraft unchanged from its own draft", () => {
    for (const a of builtIn) {
      const result = buildAircraft(draftFromAircraft(a), [], a);
      expect(result.ok && result.aircraft, a.id).toEqual(a);
    }
  });

  it("applies edited parameters and keeps the POH tables and checklists", () => {
    const a = builtIn.find((x) => x.id === "R172K")!;
    const draft = draftFromAircraft(a);
    draft.usableFuelL = "200";
    draft.patternSpeedKt = "80";
    draft.weightBalance.emptyWeightKg = "700";
    const result = buildAircraft(draft, [], a);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.aircraft.usableFuelL).toBe(200);
    expect(result.aircraft.patternSpeedKt).toBe(80);
    expect(result.aircraft.weightBalance?.emptyWeightKg).toBe(700);
    expect(result.aircraft.weightBalance?.envelope).toEqual(
      a.weightBalance?.envelope,
    );
    expect(result.aircraft.takeoff).toEqual(a.takeoff);
    expect(result.aircraft.cruise).toEqual(a.cruise);
    expect(result.aircraft.checklists).toEqual(a.checklists);
  });

  it("edits a built-in table as JSON and stores only the changed section", () => {
    const a = builtIn.find((x) => x.id === "SD-4")!;
    const draft = draftFromAircraft(a);
    const cruise = JSON.parse(draft.raw.cruise!) as {
      rows: { ktas: number }[];
    };
    cruise.rows[0]!.ktas = 99;
    draft.raw.cruise = JSON.stringify(cruise);

    const stored = withoutUnchangedRaw(draft, a);
    expect(Object.keys(stored.raw)).toEqual(["cruise"]);
    const result = buildAircraft(stored, [], a);
    expect(result.ok && result.aircraft.cruise?.rows[0]?.ktas).toBe(99);
    expect(result.ok && result.aircraft.takeoff).toEqual(a.takeoff);
  });

  it("rejects broken JSON and values that break the schema", () => {
    const a = builtIn.find((x) => x.id === "SD-4")!;
    const draft = draftFromAircraft(a);
    draft.raw.landing = "{ nope";
    expect(buildAircraft(draft, [], a)).toMatchObject({
      ok: false,
      error: { code: "invalid", section: "landing" },
    });
    draft.raw.landing = draftFromAircraft(a).raw.landing;
    draft.raw.checklists = '[{"id": 1}]';
    expect(buildAircraft(draft, [], a)).toMatchObject({
      ok: false,
      error: { code: "invalid", section: "checklists" },
    });
  });
});
