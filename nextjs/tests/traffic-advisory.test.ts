import { expect, it } from "vitest";
import { trafficAdvisory } from "../src/domain/traffic-advisory";
import { destinationPoint } from "../src/domain/geo";
import { type TrafficAircraft } from "../src/api/aviation/schemas";
const now = Date.parse("2026-10-18T12:00:00Z");
const own = {
  lat: 50,
  lon: 19,
  altitudeFt: 6000,
  groundSpeedKt: 150,
  trackDeg: 0,
  time: new Date(now).toISOString(),
};
const target = (rangeNm: number, vertical: number): TrafficAircraft => ({
  ...destinationPoint(own, 0, rangeNm),
  hex: "abc123",
  callsign: "TEST123",
  registration: "SP-TEST",
  type: "C172",
  altitude_ft: own.altitudeFt + vertical,
  on_ground: false,
  ground_speed_kt: 150,
  track_deg: 180,
  vertical_rate_fpm: 0,
  squawk: null,
  position_time: own.time,
  sources: [],
});
it("uses the diagram's 300kt closure, 40/25 seconds and 850/600ft vertical bands", () => {
  expect(trafficAdvisory(own, target(3.3, 700), now)?.level).toBe("ta");
  expect(trafficAdvisory(own, target(2.1, 500), now)?.level).toBe("close");
  expect(trafficAdvisory(own, target(2.1, 700), now)?.level).toBe("ta");
  expect(trafficAdvisory(own, target(2.1, 900), now)).toBeNull();
});
it("rejects receding and parallel tracks that do not enter the protected volume", () => {
  expect(
    trafficAdvisory(
      own,
      { ...target(3, 0), track_deg: 0, ground_speed_kt: 300 },
      now,
    ),
  ).toBeNull();
  expect(
    trafficAdvisory(own, { ...target(3, 0), track_deg: 0 }, now),
  ).toBeNull();
  expect(
    trafficAdvisory(
      own,
      { ...target(2, 0), ...destinationPoint(own, 45, 4) },
      now,
    ),
  ).toBeNull();
});
it("keeps close slow-closure traffic visible and accounts for vertical convergence", () => {
  expect(
    trafficAdvisory(own, { ...target(0.4, 500), track_deg: 0 }, now)?.level,
  ).toBe("close");
  expect(
    trafficAdvisory(own, { ...target(2, 1500), vertical_rate_fpm: -3000 }, now)
      ?.level,
  ).toBe("close");
});
it("rejects stale, missing, ground and own-aircraft reports", () => {
  expect(trafficAdvisory(own, target(2, 0), now + 21000)).toBeNull();
  expect(
    trafficAdvisory(own, { ...target(2, 0), altitude_ft: null }, now),
  ).toBeNull();
  expect(
    trafficAdvisory(own, { ...target(2, 0), on_ground: true }, now),
  ).toBeNull();
  expect(
    trafficAdvisory({ ...own, paused: true }, target(2, 0), now),
  ).toBeNull();
  expect(
    trafficAdvisory(own, target(2, 0), now, {
      hex: "abc123",
      registration: "",
    }),
  ).toBeNull();
});
