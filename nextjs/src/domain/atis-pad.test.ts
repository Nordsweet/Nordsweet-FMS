import { describe, expect, it } from "vitest";

import {
  type AtisAction,
  atisFields,
  atisReady,
  atisReducer,
  atisValue,
  emptyAtisPad,
  metarHints,
} from "./atis-pad";

const run = (...actions: AtisAction[]) =>
  actions.reduce(atisReducer, emptyAtisPad());

describe("ATIS pad (legacy formats)", () => {
  it("uses the Polish field order for EP airports", () => {
    expect(atisFields("EPKK")).toContain("arrival");
    expect(atisFields("EPKK")).not.toContain("weather");
    expect(atisFields("EDDB")).toContain("remarks");
  });

  it("builds time from digit taps and caps the hour at 23", () => {
    const pad = run(
      { type: "time", part: "hourTens", value: "2" },
      { type: "time", part: "hourOnes", value: "5" }, // ignored: 25
      { type: "time", part: "hourOnes", value: "3" },
      { type: "time", part: "minuteTens", value: "5" },
    );
    expect(atisValue(pad, "time")).toBe("23:50");
    expect(atisReady(pad, "time")).toBe(true);
  });

  it("builds wind with gusts and a varying sector, and CALM / VRB", () => {
    const pad = run(
      { type: "wind", part: "directionHundreds", value: "2" },
      { type: "wind", part: "directionTens", value: "5" },
      { type: "wind", part: "speedOnes", value: "8" },
      { type: "wind", part: "gustTens", value: "1" },
      { type: "wind", part: "gustOnes", value: "8" },
      { type: "wind", part: "varyingFromHundreds", value: "2" },
      { type: "wind", part: "varyingFromTens", value: "2" },
      { type: "wind", part: "varyingToHundreds", value: "2" },
      { type: "wind", part: "varyingToTens", value: "8" },
    );
    expect(atisValue(pad, "wind")).toBe("250/08G18KT 220V280");
    expect(atisValue(run({ type: "windMode", value: "calm" }), "wind")).toBe(
      "CALM",
    );
    expect(
      atisValue(
        run(
          { type: "windMode", value: "vrb" },
          { type: "wind", part: "speedOnes", value: "3" },
        ),
        "wind",
      ),
    ).toBe("VRB/03KT");
    // 360 is the maximum: tens above 6 are refused with 300.
    const max = run(
      { type: "wind", part: "directionHundreds", value: "3" },
      { type: "wind", part: "directionTens", value: "7" },
    );
    expect(max.wind.directionTens).toBe("");
  });

  it("composes visibility with RVR, runway with RCR, clouds, temperatures, QNH and TL", () => {
    const pad = run(
      { type: "visibility", part: "thousands", value: "6" },
      { type: "rvrToggle" },
      { type: "set", field: "runway", value: "RWY 25" },
      { type: "rcr", index: 1, value: "5" },
      { type: "cloud", layer: "FEW", part: "thousands", value: "1" },
      { type: "cloud", layer: "FEW", part: "hundreds", value: "2" },
      { type: "cloud", layer: "BKN", part: "thousands", value: "4" },
      { type: "sign", field: "dew" },
      { type: "temp", field: "temp", part: "ones", value: "7" },
      { type: "temp", field: "dew", part: "ones", value: "2" },
      { type: "qnh", part: "base", value: "1000" },
      { type: "qnh", part: "tens", value: "1" },
      { type: "qnh", part: "ones", value: "3" },
      { type: "transition", part: "addHundred" },
      { type: "transition", part: "five" },
    );
    expect(atisValue(pad, "visibility")).toBe("6000 | RVR 1500/1500/1500");
    expect(atisValue(pad, "runway")).toBe("RWY 25 | RCR 656");
    expect(atisValue(pad, "clouds")).toBe("FEW012 BKN040");
    expect(atisValue(pad, "temperature")).toBe("07");
    expect(atisValue(pad, "dewPoint")).toBe("M02");
    expect(atisValue(pad, "qnh")).toBe("QNH 1013");
    expect(atisValue(pad, "transition")).toBe("TL 105");
  });

  it("offers METAR suggestions that fill the fields", () => {
    const hints = metarHints(
      "EPKK 131030Z 25008G18KT 220V280 6000 -RA FEW012 BKN040 07/M02 Q1013 NOSIG",
    );
    expect(hints).toMatchObject({
      time: "10:30",
      wind: "250/08G18KT",
      visibility: "6000",
      weather: "-RA",
      clouds: "FEW012 BKN040",
      temperature: "07",
      dewPoint: "M02",
      qnh: "QNH 1013",
    });
    let pad = emptyAtisPad();
    for (const [field, value] of Object.entries(hints))
      pad = atisReducer(pad, {
        type: "preset",
        field: field as never,
        value: value,
      });
    expect(atisValue(pad, "wind")).toBe("250/08G18KT");
    expect(atisValue(pad, "clouds")).toBe("FEW012 BKN040");
    expect(atisValue(pad, "dewPoint")).toBe("M02");
    expect(atisValue(pad, "qnh")).toBe("QNH 1013");
    // Tapping the matching chip again clears the field.
    pad = atisReducer(pad, { type: "preset", field: "qnh", value: "QNH 1013" });
    expect(atisValue(pad, "qnh")).toBe("");
  });
});
