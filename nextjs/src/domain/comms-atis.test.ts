import { describe, expect, it } from "vitest";
import { atisSchema } from "~/api/aviation/schemas";
import type { Frequency } from "~/data/schemas";
import { commsAtisAirport, commsAtisContext } from "./comms-atis";

const now = Date.parse("2026-10-22T12:00:00Z");
const report = atisSchema.parse({
  kind: "combined",
  letter: "A",
  qnh_hpa: 1013,
  stale: false,
  received_at: "2026-10-22T11:45:00Z",
  age_minutes: 0,
  qnh_matches_metar: null,
  text: "ATIS A QNH 1013",
});

describe("radio handoff ATIS", () => {
  it("selects the latest reliable broadcast and calculates age from its time", () => {
    expect(
      commsAtisContext(
        [
          report,
          {
            ...report,
            letter: "B",
            qnh_hpa: 1020,
            observed_at: "2026-10-22T11:55:00Z",
          },
        ],
        "EPKK",
        now,
      ),
    ).toEqual({ letter: "B", qnh: 1020, minutes: 5 });
  });
  it("accepts exactly one hour, rejects older, future, stale or undated reports", () => {
    expect(
      commsAtisContext(
        [{ ...report, observed_at: "2026-10-22T11:00:00Z" }],
        "EPKK",
        now,
      )?.minutes,
    ).toBe(60);
    for (const patch of [
      { observed_at: "2026-10-22T10:59:59Z" },
      { observed_at: "2026-10-22T12:00:01Z" },
      { received_at: null },
      { stale: true },
      { source: "community", verified: true, confirmation_count: 1 },
      { letter: null },
      { qnh_hpa: null },
    ])
      expect(
        commsAtisContext([{ ...report, ...patch }], "EPKK", now),
      ).toBeNull();
  });
  it("uses structured QNH but never takes missing values from an older broadcast", () => {
    expect(
      commsAtisContext(
        [{ ...report, qnh_hpa: null, fields: { qnh: "QNH 0998" } }],
        "EPKK",
        now,
      )?.qnh,
    ).toBe(998);
    expect(
      commsAtisContext(
        [
          report,
          { ...report, letter: null, observed_at: "2026-10-22T11:59:00Z" },
        ],
        "EPKK",
        now,
      ),
    ).toBeNull();
  });
  it("maps an exact airport service and excludes FIS or ambiguous reused frequencies", () => {
    const row = {
      callsign: "Tatry-Tower",
      frequencyMhz: "120.705",
      sector: null,
    };
    const frequency: Frequency = {
      ...row,
      callsign: "Tatry Tower",
      airport: "LZTT",
      service: "tower",
      notes: null,
      primary: false,
    };
    expect(commsAtisAirport(row, [frequency])).toBe("LZTT");
    expect(
      commsAtisAirport({ ...row, serviceId: "fiss" }, [frequency]),
    ).toBeNull();
    expect(
      commsAtisAirport(row, [frequency, { ...frequency, airport: "XXXX" }]),
    ).toBeNull();
    expect(
      commsAtisAirport({ ...row, callsign: "Other" }, [frequency]),
    ).toBeNull();
  });
});
