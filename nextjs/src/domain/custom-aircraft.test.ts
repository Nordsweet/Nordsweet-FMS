import { describe, expect, it } from "vitest";

import { buildAircraft, emptyDraft } from "./custom-aircraft";
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
