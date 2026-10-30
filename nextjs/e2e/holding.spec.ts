import { expect, test, type Page } from "./test";
import { newFlight } from "../src/data/flight";
import { type Holding } from "../src/data/holding";
import { destinationPoint } from "../src/domain/geo";
import { holdingGeometry } from "../src/domain/holding";
import { flyByRoute } from "../src/domain/fly-by";
import { type NavPoint } from "../src/domain/progress";
import { settleStorage } from "./helpers/storage";

const fix = { ident: "KELEL", lat: 49.313611, lon: 20.175278 };
const departure = { ident: "EPKK", lat: 50.077778, lon: 19.784722 };
const destination = { ident: "EPNT", lat: 49.46283, lon: 20.05067 };

async function openHold(page: Page) {
  await page.getByRole("button", { name: "Search", exact: true }).click();
  const search = page.getByRole("dialog", { name: "Search", exact: true });
  await search.getByRole("textbox").fill("KELEL");
  await search.getByRole("button", { name: "Search", exact: true }).click();
  await page
    .getByRole("dialog", { name: "Details", exact: true })
    .getByRole("button", { name: "HOLD", exact: true })
    .click();
  return page.getByRole("region", { name: "HOLD", exact: true });
}

async function seed(page: Page, active = false, intermediate = false) {
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => r.abort());
  const route = active
    ? [
        { ident: "DCT", ...destinationPoint(fix, 180, 10) },
        ...(intermediate
          ? [{ ident: "BEFORE", ...destinationPoint(fix, 180, 3) }]
          : []),
        fix,
        destination,
      ]
    : [departure, fix, destination];
  const flight = {
    ...newFlight(),
    aircraftId: "P2006T",
    departure,
    destination,
    waypoints: [fix],
    cruiseAltitudeFt: 6000,
    cruiseTasKt: 100,
    waypointAltitudes: { KELEL: 4500 },
  };
  const initial = destinationPoint(fix, 180, intermediate ? 5 : 0.8);
  await page.addInitScript(
    ({ flight, route, initial, active }) => {
      localStorage.setItem("nordsweet.language.v1", "en");
      if (!localStorage.getItem("nordsweet.flight.v2"))
        localStorage.setItem(
          "nordsweet.flight.v2",
          JSON.stringify({ version: 1, state: { flight } }),
        );
      if (active && !localStorage.getItem("nordsweet.inflight.v1"))
        localStorage.setItem(
          "nordsweet.inflight.v1",
          JSON.stringify({
            version: 1,
            state: {
              startedAt: new Date().toISOString(),
              route,
              activeLeg: 0,
              phase: "cruise",
            },
          }),
        );
      const listeners = new Map<number, PositionCallback>();
      let id = 0;
      const sample = (p: { lat: number; lon: number }, heading: number) =>
        ({
          coords: {
            latitude: p.lat,
            longitude: p.lon,
            altitude: 3000 * 0.3048,
            accuracy: 5,
            altitudeAccuracy: 5,
            speed: (100 * 1852) / 3600,
            heading,
          },
          timestamp: Date.now(),
        }) as GeolocationPosition;
      Object.defineProperty(navigator, "geolocation", {
        value: {
          watchPosition(callback: PositionCallback) {
            const key = ++id;
            listeners.set(key, callback);
            queueMicrotask(() => callback(sample(initial, 0)));
            return key;
          },
          clearWatch(key: number) {
            listeners.delete(key);
          },
        },
      });
      Object.defineProperty(window, "moveHoldFix", {
        value: (p: { lat: number; lon: number }, heading: number) =>
          listeners.forEach((callback) => callback(sample(p, heading))),
      });
    },
    { flight, route, initial, active },
  );
}

const readConfig = (page: Page) =>
  page.evaluate(
    () =>
      (
        JSON.parse(localStorage.getItem("nordsweet.flight.v2")!) as {
          state: { flight: { holding: Holding | null } };
        }
      ).state.flight.holding,
  );

test("HOLD preview, level/time defaults, automatic entry and saved configuration", async ({
  page,
}) => {
  await seed(page);
  await page.goto("/map");
  const panel = await openHold(page);
  await expect(panel.getByLabel("Fix", { exact: true })).toHaveValue("KELEL");
  await expect(
    panel.getByLabel("Level (ft AMSL)", { exact: true }),
  ).toHaveValue("4500");
  await expect(panel.getByLabel("Outbound time (min)")).toHaveValue("1");
  await expect(page.locator("[data-holding-preview='true']")).toBeVisible();
  await panel.getByLabel("Level (ft AMSL)", { exact: true }).fill("15000");
  await expect(panel.getByLabel("Outbound time (min)")).toHaveValue("1.5");
  await panel.getByLabel("Level (ft AMSL)", { exact: true }).fill("14000");
  await expect(panel.getByLabel("Outbound time (min)")).toHaveValue("1");
  await panel.getByLabel("Outbound time (min)").fill("2");
  await panel.getByLabel("Level (ft AMSL)", { exact: true }).fill("16000");
  await expect(panel.getByLabel("Outbound time (min)")).toHaveValue("2");
  await panel.getByRole("combobox", { name: "Turns" }).click();
  await page.getByRole("option", { name: "Left", exact: true }).click();
  await page.screenshot({ path: "test-results/holding-configuration.png" });
  await panel.getByRole("button", { name: "Accept HOLD", exact: true }).click();
  expect(await readConfig(page)).toMatchObject({
    fix,
    direction: "left",
    levelFt: 16000,
    legSeconds: 120,
  });
  await expect(page.locator("[data-holding-preview='true']")).toHaveCount(0);
  await page.reload();
  const reopened = await openHold(page);
  await expect(
    reopened.getByLabel("Level (ft AMSL)", { exact: true }),
  ).toHaveValue("16000");
  await expect(reopened.getByLabel("Outbound time (min)")).toHaveValue("2");
  await reopened
    .getByRole("button", { name: "Remove HOLD", exact: true })
    .click();
  expect(await readConfig(page)).toBeNull();
});

test("a fix beyond an intervening waypoint suggests its planned level and stays armed", async ({
  page,
}) => {
  await seed(page, true, true);
  await page.goto("/fly");
  const panel = await openHold(page);
  await expect(
    panel.getByLabel("Level (ft AMSL)", { exact: true }),
  ).toHaveValue("4500");
  await panel.getByRole("button", { name: "Accept HOLD", exact: true }).click();
  await expect(page.locator("[data-holding-phase]")).toHaveAttribute(
    "data-holding-phase",
    "armed",
  );
  const active = await page.evaluate(
    () =>
      (
        JSON.parse(localStorage.getItem("nordsweet.inflight.v1")!) as {
          state: { activeLeg: number; route: { ident: string }[] };
        }
      ).state,
  );
  expect(active.route[active.activeLeg + 1]?.ident).toBe("BEFORE");
});

test("accepting HOLD at an off-route fix inserts it in the flight plan", async ({
  page,
}) => {
  await seed(page);
  await page.addInitScript(() => {
    const stored = JSON.parse(localStorage.getItem("nordsweet.flight.v2")!) as {
      state: { flight: { waypoints: unknown[] } };
    };
    stored.state.flight.waypoints = [];
    localStorage.setItem("nordsweet.flight.v2", JSON.stringify(stored));
  });
  await page.goto("/map");
  const panel = await openHold(page);
  await panel.getByRole("button", { name: "Accept HOLD", exact: true }).click();
  const points = await page.evaluate(
    () =>
      (
        JSON.parse(localStorage.getItem("nordsweet.flight.v2")!) as {
          state: { flight: { waypoints: { ident: string }[] } };
        }
      ).state.flight.waypoints,
  );
  expect(points.map((p) => p.ident)).toEqual(["KELEL"]);
  expect((await readConfig(page))?.fix.ident).toBe("KELEL");
});

test("GPS fix passage and abeam start a separate persisted outbound timer; Exit resumes route", async ({
  page,
}) => {
  await page.clock.install({ time: new Date("2026-10-16T12:00:00Z") });
  await page.clock.pauseAt(new Date("2026-10-16T12:00:01Z"));
  await seed(page, true);
  await page.goto("/fly");
  const panel = await openHold(page);
  await expect(
    panel.getByLabel("Level (ft AMSL)", { exact: true }),
  ).toHaveValue("3000");
  await panel.getByRole("button", { name: "Accept HOLD", exact: true }).click();
  const status = page.locator("[data-holding-phase]");
  await expect(status).toHaveAttribute("data-holding-phase", "armed");
  await expect(status).toHaveCSS("color", "rgb(235, 244, 255)");
  const config = (await readConfig(page))!;
  const geometry = holdingGeometry({ ...config, approachTrueDeg: 0 });
  const move = async (
    p: { lat: number; lon: number },
    heading: number,
    ms = 1000,
  ) => {
    await page.clock.fastForward(ms);
    await page.evaluate(
      ({ p, heading }) =>
        (
          window as unknown as {
            moveHoldFix: (
              p: { lat: number; lon: number },
              heading: number,
            ) => void;
          }
        ).moveHoldFix(p, heading),
      { p, heading },
    );
  };
  // First observation establishes the pre-fix sample; the second crosses the fix.
  await move(destinationPoint(fix, 180, 0.15), 0);
  await move(fix, 0);
  await expect(status).toHaveAttribute("data-holding-phase", "turn");
  await expect(page.locator("[data-holding-timer]")).toHaveCount(0);
  await move(geometry.turn[30]!, 90);
  await expect(page.locator("[data-holding-timer]")).toHaveCount(0);
  await move(
    destinationPoint(geometry.outbound[0]!, geometry.outboundDeg, 0.02),
    geometry.outboundDeg,
  );
  await expect(status).toHaveAttribute("data-holding-phase", "turn");
  await move(
    destinationPoint(geometry.outbound[0]!, geometry.outboundDeg, 0.05),
    geometry.outboundDeg,
  );
  await expect(status).toHaveAttribute("data-holding-phase", "outbound");
  await expect(page.locator("[data-holding-timer]")).toHaveText("01:00");
  await page.clock.fastForward(10000);
  await expect(page.locator("[data-holding-timer]")).toHaveText("00:50");
  await page.screenshot({ path: "test-results/holding-outbound.png" });
  const started = await page.evaluate(
    () =>
      (
        JSON.parse(localStorage.getItem("nordsweet.inflight.v1")!) as {
          state: { holding: { timerStartedAt: number } };
        }
      ).state.holding.timerStartedAt,
  );
  await page.reload();
  await expect(status).toHaveAttribute("data-holding-phase", "outbound");
  expect(
    await page.evaluate(
      () =>
        (
          JSON.parse(localStorage.getItem("nordsweet.inflight.v1")!) as {
            state: { holding: { timerStartedAt: number } };
          }
        ).state.holding.timerStartedAt,
    ),
  ).toBe(started);
  // Reload reinstalls the fixture's initial northbound GPS fix. Restore the
  // actual outbound observation before testing the live-course exit.
  await move(
    destinationPoint(geometry.outbound[0]!, geometry.outboundDeg, 0.06),
    geometry.outboundDeg,
  );
  await status.getByRole("button", { name: "Exit HOLD", exact: true }).click();
  await expect(status).toHaveCount(0);
  await settleStorage(page, { clock: true });
  const remaining = await page.evaluate(
    () =>
      (
        JSON.parse(localStorage.getItem("nordsweet.inflight.v1")!) as {
          state: { route: NavPoint[] };
        }
      ).state.route,
  );
  expect(remaining.map((p) => p.ident)).toEqual(["DCT", "EPNT"]);
  expect(remaining[0]?.initialCourseDeg).toBeCloseTo(180, 0);
  const exit = flyByRoute(remaining, { tasKt: 100 });
  expect(exit.issues).toEqual([]);
  expect(exit.points.length).toBeGreaterThan(3);
  await page.screenshot({ path: "test-results/holding-exit.png" });
  await page.reload();
  await expect(status).toHaveCount(0);
  expect(
    await page.evaluate(
      () =>
        (
          JSON.parse(localStorage.getItem("nordsweet.inflight.v1")!) as {
            state: { route: NavPoint[] };
          }
        ).state.route,
    ),
  ).toEqual(remaining);
});
