import { afterEach, expect, test } from "vitest";
import { type Holding } from "~/data/holding";
import { flightSchema, newFlight } from "~/data/flight";
import { parseNordFile, toNordFile } from "~/data/nord";
import { useInFlight } from "~/stores/inflight";
import {
  armHolding,
  holdingEntry,
  holdingGeometry,
  holdingLegSeconds,
  navigationProgress,
  observeHolding,
  type HoldFix,
  type HoldingRuntime,
} from "./holding";
import { destinationPoint, distanceNm, initialBearingDeg } from "./geo";
import { angleDiffDeg } from "./angles";

const config: Holding = {
  fix: { ident: "KELEL", lat: 50, lon: 20 },
  levelFt: 5000,
  inboundTrueDeg: 0,
  direction: "right",
  legSeconds: 60,
  tasKt: 100,
  approachTrueDeg: 0,
};
const origin = Date.parse("2026-10-16T12:00:00Z");
const sample = (
  p: { lat: number; lon: number },
  second: number,
  trackDeg: number | null = null,
): HoldFix => ({
  ...p,
  time: new Date(origin + second * 1000).toISOString(),
  trackDeg,
  groundSpeedKt: 100,
});
const advance = (s: HoldingRuntime, p: HoldFix, next = true) =>
  observeHolding(s, p, next, Date.parse(p.time));
const initialStore = useInFlight.getState();
afterEach(() => useInFlight.setState(initialStore, true));

function turnChanges(path: { lat: number; lon: number }[]) {
  const points = path.filter(
    (p, i) => i === 0 || distanceNm(path[i - 1]!, p) > 0.000001,
  );
  return points
    .slice(1, -1)
    .map((p, i) =>
      angleDiffDeg(
        initialBearingDeg(points[i]!, p),
        initialBearingDeg(p, points[i + 2]!),
      ),
    )
    .filter((delta) => Math.abs(delta) > 0.05);
}

test("parallel entry and its timed reversal oppose the hold; inbound capture and later laps follow it", () => {
  for (const direction of ["right", "left"] as const) {
    const sign = direction === "right" ? 1 : -1;
    for (const course of [0, 75, 280])
      for (const legSeconds of [15, 60, 90]) {
        const c = {
          ...config,
          direction,
          inboundTrueDeg: course,
          approachTrueDeg: course + sign * 240,
          legSeconds,
        };
        const g = holdingGeometry(c);
        expect(g.entry).toBe("parallel");
        expect(
          turnChanges(g.turn).every((delta) => Math.sign(delta) === -sign),
        ).toBe(true);
        const changes = turnChanges(g.return);
        expect(Math.sign(changes[0]!)).toBe(-sign);
        expect(Math.sign(changes.at(-1)!)).toBe(sign);
        const capture = changes.findIndex((delta) => Math.sign(delta) === sign);
        expect(capture).toBeGreaterThan(0);
        expect(
          changes.slice(capture).every((delta) => Math.sign(delta) === sign),
        ).toBe(true);
        expect(distanceNm(g.return[0]!, g.outbound[1]!)).toBeLessThan(0.000001);
        expect(distanceNm(g.return.at(-1)!, c.fix)).toBeLessThan(0.000001);
        expect(
          turnChanges(g.entryPath).every((delta) => Math.abs(delta) < 3.2),
        ).toBe(true);
        expect(
          turnChanges(g.racetrack).every((delta) => Math.sign(delta) === sign),
        ).toBe(true);
        const nextLap = holdingGeometry(
          { ...c, approachTrueDeg: course },
          "direct",
        );
        expect(
          turnChanges(nextLap.turn).every((delta) => Math.sign(delta) === sign),
        ).toBe(true);
        expect(
          turnChanges(nextLap.return).every(
            (delta) => Math.sign(delta) === sign,
          ),
        ).toBe(true);
      }
  }
});

test("direct and teardrop use only the selected holding direction, including inbound capture", () => {
  for (const direction of ["right", "left"] as const) {
    const sign = direction === "right" ? 1 : -1;
    for (const approach of [0, 45, 90, 120, 150, 175, 300, 350]) {
      const g = holdingGeometry({
        ...config,
        direction,
        approachTrueDeg: sign * approach,
      });
      expect(g.entry).not.toBe("parallel");
      expect(
        turnChanges(g.turn).every((delta) => Math.sign(delta) === sign),
      ).toBe(true);
      expect(
        turnChanges(g.return).every((delta) => Math.sign(delta) === sign),
      ).toBe(true);
    }
  }
});

test("entry sectors follow FAA diagram and mirror across inbound for left turns", () => {
  for (const [approach, expected] of [
    [0, "direct"],
    [90, "direct"],
    [110, "direct"],
    [111, "teardrop"],
    [150, "teardrop"],
    [179, "teardrop"],
    [180, "parallel"],
    [240, "parallel"],
    [289, "parallel"],
    [290, "direct"],
    [350, "direct"],
  ] as const) {
    expect(holdingEntry(0, approach, "right")).toBe(expected);
    expect(holdingEntry(0, 360 - approach, "left")).toBe(expected);
    expect(holdingEntry(270, approach + 270, "right")).toBe(expected);
  }
});

test("time boundary and legacy flight/.nord compatibility", () => {
  expect(holdingLegSeconds(13999)).toBe(60);
  expect(holdingLegSeconds(14000)).toBe(60);
  expect(holdingLegSeconds(14001)).toBe(90);
  const { holding: _holding, ...old } = newFlight();
  expect(flightSchema.parse(old).holding).toBeNull();
  const flight = { ...newFlight(), holding: config };
  expect(parseNordFile(toNordFile(flight, null), []).flight.holding).toEqual(
    config,
  );
});

test("rate-one racetrack closes at fly-over fix; entry connectors have tangent joins", () => {
  for (const direction of ["left", "right"] as const)
    for (const approach of [0, 90, 150, 240, 350]) {
      const c = { ...config, direction, approachTrueDeg: approach };
      const g = holdingGeometry(c);
      expect(g.radiusNm).toBeCloseTo(100 / (60 * Math.PI), 9);
      expect(distanceNm(g.racetrack[0]!, c.fix)).toBeLessThan(0.000001);
      expect(distanceNm(g.racetrack.at(-1)!, c.fix)).toBeLessThan(0.000001);
      expect(distanceNm(g.entryPath.at(-1)!, c.fix)).toBeLessThan(0.000001);
      expect(distanceNm(g.outbound[0]!, g.outbound[1]!)).toBeCloseTo(
        100 / 60,
        3,
      );
      const path = g.entryPath.filter(
        (p, i, list) => !i || distanceNm(list[i - 1]!, p) > 0.000001,
      );
      for (let i = 1; i < path.length - 1; i++) {
        const before = initialBearingDeg(path[i - 1]!, path[i]!);
        const after = initialBearingDeg(path[i]!, path[i + 1]!);
        expect(Math.abs(angleDiffDeg(before, after))).toBeLessThan(3.2);
      }
    }
});

test("future hold cannot activate or skip intervening fixes", () => {
  const before = { ident: "BEFORE", ...destinationPoint(config.fix, 180, 5) };
  const route = [
    { ident: "DEP", ...destinationPoint(config.fix, 180, 10) },
    before,
    config.fix,
    { ident: "DEST", ...destinationPoint(config.fix, 90, 10) },
  ];
  let state = armHolding(config);
  state = advance(state, sample(destinationPoint(config.fix, 180, 0.2), 0));
  state = advance(state, sample(config.fix, 5), false);
  expect(state.phase).toBe("armed");
  const guidance = navigationProgress(
    route,
    destinationPoint(before, 180, 1),
    0,
    { tasKt: 100 },
    state,
  )!;
  expect(guidance.next.ident).toBe("BEFORE");
  const atFix = navigationProgress(
    route,
    config.fix,
    1,
    { tasKt: 100 },
    state,
  )!;
  expect(atFix.activeLeg).toBe(1);
  expect(atFix.next.ident).toBe("KELEL");
});

test("fix passage selects actual entry; timer waits for outbound wings-level AND abeam", () => {
  let state = armHolding(config);
  state = advance(state, sample(destinationPoint(config.fix, 180, 0.2), 0));
  state = advance(state, sample(config.fix, 8, 0));
  expect(state.phase).toBe("turn");
  expect(state.timerStartedAt).toBeNull();
  const g = holdingGeometry(config);
  state = advance(state, sample(g.turn[30]!, 38, 90));
  expect(state.timerStartedAt).toBeNull();
  // Outbound heading reported before abeam must not trigger it.
  state = advance(state, sample(g.turn[55]!, 63, 180));
  expect(state.timerStartedAt).toBeNull();
  state = advance(state, sample(g.turn.at(-1)!, 68, 180));
  expect(state.phase).toBe("outbound");
  expect(state.timerStartedAt).toBe(origin + 68000);
  const persisted = JSON.parse(JSON.stringify(state)) as HoldingRuntime;
  expect(advance(persisted, sample(g.turn.at(-1)!, 68, 180))).toEqual(
    persisted,
  );
  expect(
    observeHolding(
      state,
      sample(g.outbound[1]!, 80, 180),
      true,
      origin + 110000,
    ),
  ).toBe(state);
  state = advance(state, sample(g.outbound[1]!, 128, 180));
  expect(state.phase).toBe("return");
  state = advance(
    state,
    sample(destinationPoint(config.fix, 180, 0.15), 180, 0),
  );
  state = advance(state, sample(config.fix, 186, 0));
  expect(state.circuits).toBe(1);
  expect(state.phase).toBe("turn");
  expect(state.entry).toBe("direct");
  expect(state.timerStartedAt).toBeNull();
});

test("parallel and teardrop are chosen from actual arrival, mirrored turns and timers", () => {
  for (const direction of ["left", "right"] as const)
    for (const approach of [150, 240]) {
      const track = direction === "right" ? approach : 360 - approach;
      let state = armHolding({ ...config, direction });
      state = advance(
        state,
        sample(destinationPoint(config.fix, track + 180, 0.2), 0, track),
      );
      state = advance(state, sample(config.fix, 8, track));
      expect(state.entry).toBe(approach === 150 ? "teardrop" : "parallel");
      const geometry = holdingGeometry(state.config, state.entry);
      const p = destinationPoint(
        geometry.outbound[0]!,
        geometry.outboundDeg,
        0.2,
      );
      state = advance(state, sample(p, 20, geometry.outboundDeg));
      state = advance(
        state,
        sample(
          destinationPoint(p, geometry.outboundDeg, 0.03),
          21,
          geometry.outboundDeg,
        ),
      );
      expect(state.phase).toBe("outbound");
    }
});

test("active hold pauses normal guidance; Exit resumes after fix without resetting flight timers", () => {
  const route = [
    { ident: "DEP", ...destinationPoint(config.fix, 180, 10) },
    config.fix,
    { ident: "DEST", ...destinationPoint(config.fix, 90, 10) },
  ];
  const store = useInFlight.getState();
  store.start(route);
  store.setHolding(config);
  let state = {
    ...armHolding(config),
    phase: "outbound" as const,
    timerStartedAt: origin,
  };
  useInFlight.setState({ holding: state });
  const timers = useInFlight.getState().timers;
  const fix = holdingGeometry(config).outbound[0]!;
  expect(
    navigationProgress(route, fix, 0, { tasKt: 100 }, state)?.next.ident,
  ).toBe("KELEL HOLD");
  store.exitHolding(fix);
  expect(useInFlight.getState().holding).toBeNull();
  expect(useInFlight.getState().route.map((p) => p.ident)).toEqual([
    "DCT",
    "DEST",
  ]);
  expect(useInFlight.getState().timers).toBe(timers);
  store.setHolding(config);
  store.goDirect(1, fix);
  expect(useInFlight.getState().holding).toBeNull();
  state = { ...state, config: { ...config, fix: route[2]! } };
  useInFlight.setState({ holding: state, route, activeLeg: 1 });
  store.exitHolding(fix);
  expect(useInFlight.getState().route.at(-1)?.ident).toBe("DEST");
});

test("outbound guidance never points back before the timer ends; zero-turn entries remain navigable", () => {
  const geometry = holdingGeometry(config);
  const position = destinationPoint(
    geometry.outbound[1]!,
    geometry.outboundDeg,
    1,
  );
  const state = {
    ...armHolding(config),
    phase: "outbound" as const,
    timerStartedAt: origin,
  };
  const guidance = navigationProgress(
    [config.fix, { ident: "DEST", ...position }],
    position,
    0,
    { tasKt: 100 },
    state,
  )!;
  expect(guidance.desiredTrackDeg).toBe(geometry.outboundDeg);
  expect(guidance.bearingToNextDeg).toBe(geometry.outboundDeg);
  const zeroTurn = {
    ...armHolding({ ...config, approachTrueDeg: 150 }),
    phase: "turn" as const,
  };
  const start = navigationProgress(
    [config.fix, { ident: "DEST", ...position }],
    config.fix,
    0,
    { tasKt: 100 },
    zeroTurn,
  )!;
  expect(start.desiredTrackDeg).toBeCloseTo(150, 2);
  expect(start.distanceToNextNm).toBeCloseTo(100 / 60, 3);
});

test("an angled direct entry waits for the first turn to finish even when already past abeam", () => {
  const angled = { ...config, approachTrueDeg: 90 };
  let state = {
    ...armHolding(angled),
    phase: "turn" as const,
  } as HoldingRuntime;
  const geometry = holdingGeometry(angled);
  state = advance(state, sample(geometry.turn.at(-3)!, 10, 174));
  state = advance(state, sample(geometry.turn.at(-2)!, 11, 177));
  expect(state.timerStartedAt).toBeNull();
  state = advance(state, sample(geometry.turn.at(-1)!, 12, 180));
  expect(state.timerStartedAt).toBeNull();
  state = advance(
    state,
    sample(destinationPoint(geometry.outbound[0]!, 180, 0.03), 13, 180),
  );
  expect(state.phase).toBe("outbound");
  expect(state.timerStartedAt).toBe(origin + 13000);
});
