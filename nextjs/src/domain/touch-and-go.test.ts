import { expect, test } from "vitest";
import {
  newTimers,
  stepTimers,
  toggleTimer,
  type Timers,
} from "./flight-timers";
import { inFlightSnapshotSchema } from "~/data/flight-session";
import { logbookFromDebrief } from "./logbook";
import { useInFlight } from "~/stores/inflight";

const ctx = {
  phase: "landing" as const,
  departureElevationFt: 800,
  groundElevationFt: 800,
  cruiseAltitudeFt: 3000,
};
function sample(
  t: Timers,
  at: number,
  agl: number,
  speed: number,
  onGround?: boolean,
) {
  return stepTimers(
    t,
    {
      at,
      lat: 50,
      lon: 20,
      altitudeFt: 800 + agl,
      altitudeAglFt: agl,
      speedKt: speed,
      headingDeg: 90,
      onGround,
    },
    ctx,
  );
}
function airborne() {
  return sample(toggleTimer(newTimers(), "airTime", 0), 1000, 200, 75).timers;
}
function contact(drop = 5, agl = 10) {
  let t = sample(airborne(), 2000, agl, 70).timers;
  t = sample(t, 3000, agl, 70 - drop).timers;
  return sample(t, 4000, agl, 72).timers;
}
test("10 ft / 5 kt contact confirms at +100 ft, backdated to minimum speed, once per circuit", () => {
  let t = contact();
  expect(t.events.filter((e) => e.name === "Landing")).toHaveLength(0);
  t = sample(t, 5000, 99, 80).timers;
  expect(t.events.some((e) => e.touchAndGoNumber)).toBe(false);
  const confirmed = sample(t, 6000, 100, 80);
  expect(confirmed.phase).toBe("climb");
  t = confirmed.timers;
  expect(t.events.at(-1)).toMatchObject({
    name: "#1 Touch and go",
    at: 3000,
    notedAt: 6000,
    touchAndGoNumber: 1,
  });
  t = sample(t, 7000, 250, 80).timers;
  t = sample(t, 8000, 0, 70).timers;
  t = sample(t, 9000, 0, 64).timers;
  t = sample(t, 10000, 100, 80).timers;
  expect(t.events.at(-1)).toMatchObject({ name: "#2 Touch and go", at: 9000 });
  expect(t.events.filter((e) => e.name === "Landing")).toHaveLength(2);
  expect(t.events.filter((e) => e.name === "Take-off")).toHaveLength(3);
  expect(t.airTime).toMatchObject({ startedAt: 0, stoppedAt: null });
});
test.each([
  [4.99, 0],
  [5, 10.01],
])("rejects insufficient drop or contact height %s / %s", (drop, agl) => {
  expect(
    sample(contact(drop, agl), 5000, 110, 80).timers.events.some(
      (e) => e.touchAndGoNumber,
    ),
  ).toBe(false);
});
test("acceleration, simulator low pass and taxi before first take-off do not count", () => {
  let t = sample(airborne(), 2000, 0, 60).timers;
  t = sample(t, 3000, 0, 70).timers;
  expect(
    sample(t, 4000, 100, 80).timers.events.some((e) => e.touchAndGoNumber),
  ).toBe(false);
  t = sample(airborne(), 2000, 0, 70, false).timers;
  t = sample(t, 3000, 0, 60, false).timers;
  expect(
    sample(t, 4000, 100, 80, false).timers.events.some(
      (e) => e.touchAndGoNumber,
    ),
  ).toBe(false);
  t = sample(newTimers(), 1000, 0, 20).timers;
  t = sample(t, 2000, 0, 10).timers;
  expect(
    sample(t, 3000, 100, 80).timers.events.some((e) => e.touchAndGoNumber),
  ).toBe(false);
});
test("GPS gaps and old samples cannot confirm an old contact", () => {
  const t = contact();
  expect(sample(t, 3000, 200, 80).timers).toEqual(t);
  expect(
    sample(t, 30000, 200, 80).timers.events.some((e) => e.touchAndGoNumber),
  ).toBe(false);
});
test("slow contact is counted once when reclassified as touch and go", () => {
  let t = sample(airborne(), 2000, 0, 29).timers;
  for (let at = 3000; at <= 13000; at += 1000) t = sample(t, at, 0, 20).timers;
  expect(t.airTime.stoppedAt).not.toBeNull();
  t = sample(t, 14000, 100, 60).timers;
  expect(t.events.filter((e) => e.name === "Landing")).toHaveLength(1);
  expect(t.events.at(-1)?.touchAndGoNumber).toBe(1);
  expect(t.airTime.stoppedAt).toBeNull();
  expect(t.pendingPhase).toBeNull();
});
test("contact candidate survives a server snapshot and old snapshots still parse", () => {
  const state = useInFlight.getState();
  const snapshot = inFlightSnapshotSchema.parse({
    ...state,
    timers: contact(),
  });
  expect(
    sample(snapshot.timers, 5000, 100, 80).timers.events.at(-1)
      ?.touchAndGoNumber,
  ).toBe(1);
  expect(
    inFlightSnapshotSchema.safeParse({
      ...state,
      timers: { ...newTimers(), touchAndGo: undefined },
    }).success,
  ).toBe(true);
});
test("another full-stop take-off resumes the same flight without inventing a touch and go", () => {
  let t = airborne();
  for (let at = 2000; at <= 13000; at += 1000) t = sample(t, at, 0, 20).timers;
  expect(t.airTime.stoppedAt).not.toBeNull();
  // A gap discards contact evidence but not recorded landings.
  t = sample(t, 40000, 150, 80).timers;
  expect(t.airTime).toMatchObject({ startedAt: 0, stoppedAt: null });
  expect(t.events.filter((e) => e.name === "Take-off")).toHaveLength(2);
  expect(t.events.some((e) => e.touchAndGoNumber)).toBe(false);
  for (let at = 41000; at <= 52000; at += 1000) t = sample(t, at, 0, 20).timers;
  expect(t.events.filter((e) => e.name === "Landing")).toHaveLength(2);
});
test("final landing is additional and its count freezes in the debrief and logbook", () => {
  let t = sample(contact(), 5000, 100, 80).timers;
  for (let at = 6000; at <= 17000; at += 1000) t = sample(t, at, 0, 20).timers;
  expect(t.events.filter((e) => e.name === "Landing")).toHaveLength(2);
  useInFlight.getState().start([
    { ident: "A", lat: 50, lon: 20 },
    { ident: "B", lat: 50, lon: 21 },
  ]);
  useInFlight.setState({ timers: t });
  useInFlight.getState().end();
  expect(
    logbookFromDebrief(useInFlight.getState().debrief!, {
      id: "flight",
      startedAt: new Date().toISOString(),
      departure: "A",
      arrival: "B",
      pic: "Pilot",
    }).landingCount,
  ).toBe(2);
});
