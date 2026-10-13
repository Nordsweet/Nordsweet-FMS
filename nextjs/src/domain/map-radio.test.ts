import { expect, test } from "vitest";
import { zoneRadioRows } from "./map-radio";
test("legacy name frequencies normalize and explicit service rows take precedence", () => {
  expect(
    zoneRadioRows({
      name: "FIS TEST 119,5 MHz / 123.450",
      frequencies: [],
    }).map((f) => f.frequencyMhz),
  ).toEqual(["119.500", "123.450"]);
  const row = {
    frequencyMhz: "123.450",
    callsign: "TEST",
    sector: null,
    serviceId: "radio",
  };
  expect(zoneRadioRows({ name: "FIS 119.5", frequencies: [row, row] })).toEqual(
    [row],
  );
});
