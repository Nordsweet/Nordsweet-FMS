import { describe, expect, it } from "vitest";

import { formatHhMm, parseHhMm } from "./fuel-planning";

describe("fuel table times", () => {
  it("formats minutes as legacy hh:mm, rounding up", () => {
    expect(formatHhMm(0)).toBe("00:00");
    expect(formatHhMm(178.2)).toBe("02:59");
  });
  it("reads hh:mm or plain minutes", () => {
    expect(parseHhMm("1:05")).toBe(65);
    expect(parseHhMm("01:05")).toBe(65);
    expect(parseHhMm("65")).toBe(65);
    expect(parseHhMm("abc")).toBeNull();
  });
});
