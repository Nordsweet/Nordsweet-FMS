import { describe, expect, it } from "vitest";

import { flightSchema, newFlight } from "./flight";

describe("flightSchema", () => {
  it("loads flights saved before leg winds existed", () => {
    const { legWinds: _legWinds, ...old } = newFlight();
    expect(flightSchema.parse(old).legWinds).toBeNull();
  });
});
