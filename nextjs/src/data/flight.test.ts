import { describe, expect, it } from "vitest";

import { flightSchema, newFlight } from "./flight";

describe("flightSchema", () => {
  it("loads flights saved before the legacy route fields existed", () => {
    const {
      routeText: _r,
      approach: _a,
      waypointAltitudes: _w,
      waypointWx: _x,
      schedule: _s,
      ...old
    } = newFlight();
    const flight = flightSchema.parse({ ...old, fuelFlowLph: 35 });
    expect(flight.routeText).toBe("");
    expect(flight.approach).toBeNull();
    expect(flight.schedule).toEqual({ departure: "", destination: "" });
  });
});
