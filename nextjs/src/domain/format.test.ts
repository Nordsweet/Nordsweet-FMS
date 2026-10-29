import { expect, it } from "vitest";

import { formatClock, formatClockHms, formatHeading } from "./format";

it("formats clocks and headings with leading zeros", () => {
  expect(formatClock(65)).toBe("01:05");
  expect(formatClock(0)).toBe("00:00");
  expect(formatClockHms(3725)).toBe("01:02:05");
  expect(formatHeading(7.4)).toBe("007");
  expect(formatHeading(359.6)).toBe("360");
});
