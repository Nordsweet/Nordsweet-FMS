import { describe, expect, it } from "vitest";

import { parseMetar } from "./metar";

describe("parseMetar", () => {
  it("reads wind, temperature and QNH", () => {
    expect(
      parseMetar("EPKK 111130Z 27011KT 230V310 9999 FEW040 15/05 Q1010"),
    ).toEqual({
      windDirectionDeg: 270,
      windSpeedKt: 11,
      gustKt: null,
      temperatureC: 15,
      qnhHpa: 1010,
    });
  });

  it("handles gusts, negative temperatures and inHg", () => {
    expect(
      parseMetar("KJFK 111151Z 31015G25KT 10SM FEW250 M02/M10 A2992 RMK AO2"),
    ).toEqual({
      windDirectionDeg: 310,
      windSpeedKt: 15,
      gustKt: 25,
      temperatureC: -2,
      qnhHpa: 1013,
    });
  });

  it("treats VRB and calm as no direction, converts MPS", () => {
    expect(
      parseMetar("UUEE 111200Z VRB02KT CAVOK 10/03 Q1020").windDirectionDeg,
    ).toBeNull();
    expect(parseMetar("EPNT 111200Z 00000KT CAVOK 10/03 Q1020")).toMatchObject({
      windDirectionDeg: null,
      windSpeedKt: 0,
    });
    expect(
      parseMetar("UUEE 111200Z 18005MPS CAVOK 10/03 Q1020").windSpeedKt,
    ).toBeCloseTo(9.7, 1);
  });

  it("does not confuse the date/time or visibility groups with temperature", () => {
    expect(
      parseMetar("EPWA 111730Z 20004KT 9999 CAVOK 10/07 Q1009 NOSIG")
        .temperatureC,
    ).toBe(10);
    expect(parseMetar("EPWA 111730Z 20004KT 0800 FG").temperatureC).toBeNull();
  });
});
