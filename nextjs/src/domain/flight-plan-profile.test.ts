import { expect, it } from "vitest";
import { destinationPoint } from "./geo";
import {
  flightPlanProfile,
  profileAircraftDistance,
  profileAltitudeAtDistance,
} from "./flight-plan-profile";

it("interpolates the planned altitude at the aircraft's along-route projection", () => {
  const start = { ident: "A", lat: 50, lon: 20, altitudeFt: 2000 };
  const end = {
    ident: "B",
    ...destinationPoint(start, 90, 20),
    altitudeFt: 6000,
  };
  const profile = flightPlanProfile([start, end], null, { tasKt: 100 }, 6000);
  const halfway = destinationPoint(start, 90, 10);
  const offTrack = destinationPoint(halfway, 0, 1);
  const distance = profileAircraftDistance(profile, offTrack, 0)!;
  expect(distance.crossTrackNm).toBeCloseTo(1, 1);
  expect(profileAltitudeAtDistance(profile, distance.distanceNm)).toBeCloseTo(
    4000,
    -1,
  );
  expect(profileAltitudeAtDistance(profile, 0)).toBe(2000);
  expect(profileAltitudeAtDistance(profile, profile.totalNm)).toBe(6000);
  expect(profileAltitudeAtDistance(profile, NaN)).toBeNull();
});
