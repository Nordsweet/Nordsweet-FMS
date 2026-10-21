import { expect, test } from "vitest";
import { guidanceTimeline } from "~/domain/guidance-timeline";
import {
  observeGuidance,
  type GuidanceNotices,
} from "~/domain/guidance-notices";
import { destinationPoint, initialBearingDeg } from "~/domain/geo";
import { flyByRoute } from "~/domain/fly-by";

const now = Date.parse("2026-10-19T12:00:00Z");
test("announces descent 30 seconds before TOD without commanding circuit altitude prematurely", () => {
  const a = { ident: "A", lat: 50, lon: 20 };
  const tod = {
    id: "TOD",
    ...destinationPoint(a, 90, 5),
    isProfilePoint: true,
    routeDistanceNm: 5,
  };
  const c = {
    ident: "C",
    ...destinationPoint(a, 90, 10),
    patternId: "circuit",
    altitudeFt: 2000,
  };
  const position = destinationPoint(a, 90, 5 - (100 * 20) / 3600);
  const plan = {
    points: [
      { id: "A", ...a, routeDistanceNm: 0 },
      tod,
      { id: "C", ...c, routeDistanceNm: 10 },
    ],
    pointAltitudeByKey: { TOD: 5000, C: 2000 },
  };
  const events = guidanceTimeline({
    now,
    phase: "cruise",
    fix: {
      ...position,
      time: new Date(now).toISOString(),
      groundSpeedKt: 100,
      trackDeg: initialBearingDeg(a, c),
      altitudeFt: 5000,
    },
    courseTrueDeg: initialBearingDeg(a, c),
    targetAltitudeFt: 5000,
    variationDeg: 0,
    tasKt: 100,
    wind: { directionDeg: 0, speedKt: 0 },
    route: [a, c],
    activeLeg: 0,
    performance: { tasKt: 100 },
    plan,
    cruiseAltitudeFt: 5000,
  });
  expect(events).toHaveLength(1);
  expect(events[0]!.command).toEqual({
    category: "altitude",
    direction: "descend",
    altitudeFt: 2000,
  });
  expect((events[0]!.dueAt - now) / 1000).toBeCloseTo(20, 0);
});
test("warns 30 seconds before the rate-one tangent, rather than the raw waypoint, and keeps an absolute deadline", () => {
  const a = { ident: "A", lat: 50, lon: 20 };
  const b = { ident: "B", ...destinationPoint(a, 90, 10) };
  const c = { ident: "C", ...destinationPoint(b, 0, 10) };
  const route = [a, b, c];
  const path = flyByRoute(route, { tasKt: 100 });
  const entry = path.turns.get(1)!.points[0]!;
  const position = destinationPoint(
    entry,
    initialBearingDeg(b, a),
    (100 * 20) / 3600,
  );
  const input = {
    now,
    phase: "cruise" as const,
    fix: {
      ...position,
      time: new Date(now).toISOString(),
      groundSpeedKt: 100,
      trackDeg: initialBearingDeg(a, b),
      altitudeFt: 3000,
    },
    courseTrueDeg: initialBearingDeg(a, b),
    targetAltitudeFt: 3000,
    variationDeg: 0,
    tasKt: 100,
    wind: { directionDeg: 0, speedKt: 0 },
    route,
    activeLeg: 0,
    performance: { tasKt: 100 },
    plan: null,
    cruiseAltitudeFt: 3000,
  };
  const event = guidanceTimeline(input).find((e) => e.key === "heading-leg:1")!;
  expect(event.command).toMatchObject({
    category: "heading",
    direction: "left",
  });
  expect((event.dueAt - now) / 1000).toBeCloseTo(20, 0);
  expect(
    guidanceTimeline({ ...input, now: now + 3000 }).find(
      (e) => e.key === event.key,
    )?.dueAt,
  ).toBe(event.dueAt);
  expect(
    guidanceTimeline({
      ...input,
      fix: { ...input.fix, ...destinationPoint(entry, 270, (100 * 40) / 3600) },
    }),
  ).toEqual([]);
  expect(
    guidanceTimeline({ ...input, fix: { ...input.fix, paused: true } }),
  ).toEqual([]);
});

test("countdowns enter history only at NOW, survive sequencing and latch the first timestamp", () => {
  const empty: GuidanceNotices = {
    session: null,
    seen: new Set(),
    notices: [],
  };
  const event = {
    key: "heading-leg:1",
    command: {
      category: "heading" as const,
      direction: "left" as const,
      headingDeg: 235,
    },
    dueAt: now + 20000,
  };
  const pending = observeGuidance(empty, "flight", "route", [event], now);
  expect(pending.notices[0]?.announcedAt).toBeNull();
  expect(pending.seen.size).toBe(0);
  expect(
    observeGuidance(
      pending,
      "flight",
      "route",
      [{ ...event, dueAt: now + 30000 }],
      now + 20000,
    ).notices[0]?.announcedAt,
  ).toBeNull();
  const announced = observeGuidance(
    pending,
    "flight",
    "route",
    [],
    now + 20000,
  );
  expect(announced.notices[0]?.announcedAt).toBe(now + 20000);
  const latched = observeGuidance(
    announced,
    "flight",
    "route",
    [{ ...event, dueAt: now + 21000 }],
    now + 21000,
  );
  expect(latched.notices).toHaveLength(1);
  expect(latched.notices[0]?.announcedAt).toBe(now + 20000);
  expect(
    observeGuidance(latched, "flight", "route", [event], now + 33000).notices,
  ).toEqual([]);
  expect(
    observeGuidance(pending, "flight", "route", [], now + 20000, false).notices,
  ).toEqual([]);
  expect(
    observeGuidance(pending, "flight", "changed-route", [], now + 20000)
      .notices,
  ).toEqual([]);
});
