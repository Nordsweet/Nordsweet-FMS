import { describe, expect, it } from "vitest";
import { atisSchema } from "~/api/aviation/schemas";
import { atisHints, atisPadReport, reliableAtis } from "./atis-consensus";
import { atisReducer, emptyAtisPad } from "./atis-pad";

const report = atisSchema.parse({
  kind: "combined",
  letter: "Q",
  received_at: null,
  age_minutes: 1,
  stale: false,
  qnh_hpa: 1013,
  qnh_matches_metar: null,
  text: "EPKK ATIS Q WIND 27010KT QNH 1013",
  source: "community",
  fields: { wind: "270/10KT", qnh: "QNH 1013" },
  observed_at: "2026-10-15T10:00:00Z",
});
describe("community ATIS consensus", () => {
  it("requires two server-confirmed devices, while provider ATIS remains available", () => {
    expect(reliableAtis(report)).toBe(false);
    expect(
      reliableAtis({ ...report, verified: true, confirmation_count: 1 }),
    ).toBe(false);
    expect(
      reliableAtis({ ...report, verified: false, confirmation_count: 2 }),
    ).toBe(false);
    expect(
      reliableAtis({ ...report, verified: true, confirmation_count: 2 }),
    ).toBe(true);
    expect(
      reliableAtis({
        ...report,
        verified: true,
        confirmation_count: 2,
        stale: true,
      }),
    ).toBe(false);
    expect(reliableAtis({ ...report, source: "atis.guru" })).toBe(true);
    expect(
      reliableAtis({
        ...report,
        source: "telephone-atis",
        verified: true,
        confirmation_count: 0,
      }),
    ).toBe(true);
  });
  it("keeps single-device structured data available as editor hints without trusting it", () => {
    expect(atisHints(report, "EPKK")).toMatchObject({
      information: "Q",
      time: "10:00",
      wind: "270/10KT",
      qnh: "QNH 1013",
    });
    expect(reliableAtis(report)).toBe(false);
  });
  it("requires a dated, complete report and handles UTC midnight", () => {
    let pad = emptyAtisPad();
    const now = Date.parse("2026-10-15T00:10:00Z");
    expect(atisPadReport("EPKK", pad, now)).toBeNull();
    for (const [field, value] of Object.entries({
      ...atisHints(report, "EPKK"),
      time: "23:50",
    })) {
      if (value)
        pad = atisReducer(pad, {
          type: "preset",
          field: field as keyof ReturnType<typeof atisHints>,
          value,
        });
    }
    expect(atisPadReport("EPKK", pad, now)).toMatchObject({
      airportIcao: "EPKK",
      information: "Q",
      atisObservedAt: "2026-10-14T23:50:00.000Z",
      fields: { qnh: "QNH 1013", wind: "270/10KT" },
    });
    expect(atisPadReport("EPKK", pad, now + 2 * 3600_000)).toBeNull();
    expect(atisPadReport("POINT", pad, now)).toBeNull();
  });
});
