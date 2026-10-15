import { expect, test } from "vitest";
import aircraft from "../../public/data/aircraft.json";
import { patternPlanningPerformance } from "./pattern-performance";

test("bundled P2006T profiles use 100 KIAS for the circuit", () => {
  const profiles = aircraft.filter((a) => a.type === "P2006T");
  expect(profiles.length).toBeGreaterThan(0);
  for (const a of profiles)
    expect("patternSpeedKt" in a && a.patternSpeedKt).toBe(100);
});

test("circuit IAS converts to TAS using altitude and available METAR", () => {
  expect(patternPlanningPerformance(100, 0, 0, null).tasKt).toBeCloseTo(100, 5);
  const isa = patternPlanningPerformance(100, 2000, 1000, null);
  expect(isa.tasKt).toBeGreaterThan(104);
  expect(isa.tasKt).toBeLessThan(106);
  const warm = patternPlanningPerformance(
    100,
    2000,
    1000,
    "EPNT 161200Z 12010KT 9999 SKC 25/10 Q1000",
  );
  expect(warm.tasKt).toBeGreaterThan(isa.tasKt);
  expect(warm.windDirectionDeg).toBe(120);
  expect(warm.windSpeedKt).toBe(10);
});
