import { expect, test, type Page } from "./test";
import { newFlight } from "../src/data/flight";
import { newTimers } from "../src/domain/flight-timers";

async function seed(page: Page, airborne = true, language = "en") {
  const timers = newTimers();
  if (airborne)
    timers.airTime = {
      ...timers.airTime,
      startedAt: Date.parse("2026-10-17T12:00:00Z"),
      source: "manual",
    };
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => route.abort());
  await page.clock.install({ time: new Date("2026-10-17T12:00:00Z") });
  await page.clock.pauseAt(new Date("2026-10-17T12:00:01Z"));
  await page.addInitScript(
    ({ timers, flight, language }) => {
      localStorage.setItem("nordsweet.language.v1", language);
      if (!localStorage.getItem("nordsweet.flight.v2"))
        localStorage.setItem(
          "nordsweet.flight.v2",
          JSON.stringify({ version: 1, state: { flight } }),
        );
      if (!localStorage.getItem("nordsweet.inflight.v1"))
        localStorage.setItem(
          "nordsweet.inflight.v1",
          JSON.stringify({
            version: 1,
            state: {
              startedAt: "2026-10-17T12:00:00Z",
              phase: "cruise",
              activeLeg: 0,
              timers,
              route: [
                { ident: "DEP", lat: 49.9, lon: 20 },
                { ident: "DEST", lat: 50.5, lon: 20 },
              ],
            },
          }),
        );
      const listeners = new Map<number, PositionCallback>();
      let id = 0,
        lat = 50,
        lon = 20;
      Object.defineProperty(navigator, "geolocation", {
        value: {
          watchPosition(callback: PositionCallback) {
            const key = ++id;
            listeners.set(key, callback);
            return key;
          },
          clearWatch(key: number) {
            listeners.delete(key);
          },
        },
      });
      Object.defineProperty(window, "feedWind", {
        value: (heading: number) => {
          const knot = 1852 / 3600;
          // 100 kt TAS, wind FROM 270° at 12 kt: eastward air-mass velocity.
          const e =
            100 * knot * Math.sin((heading * Math.PI) / 180) + 12 * knot;
          const n = 100 * knot * Math.cos((heading * Math.PI) / 180);
          lat += n / 111320;
          lon += e / (111320 * Math.cos((lat * Math.PI) / 180));
          const position = {
            coords: {
              latitude: lat,
              longitude: lon,
              altitude: 1500,
              accuracy: 5,
              altitudeAccuracy: 5,
              speed: Math.hypot(e, n),
              heading: ((Math.atan2(e, n) * 180) / Math.PI + 360) % 360,
            },
            timestamp: Date.now(),
          } as GeolocationPosition;
          listeners.forEach((callback) => callback(position));
        },
      });
    },
    {
      timers,
      flight: { ...newFlight(), aircraftId: "P2006T", cruiseAltitudeFt: 5000 },
      language,
    },
  );
}

async function turn(page: Page) {
  for (let i = 0; i <= 145; i++) {
    await page.clock.fastForward(1000);
    await page.evaluate(
      (heading) =>
        (window as unknown as { feedWind: (heading: number) => void }).feedWind(
          355 + heading,
        ),
      i * 3,
    );
  }
}

test("GPS wind tile shows downwind arrow and FROM/kt, then expires and resets on reload", async ({
  page,
  context,
}) => {
  test.setTimeout(60000);
  await seed(page);
  await page.goto("/fly");
  const tile = page.getByTestId("wind-tile");
  await expect(tile).toHaveAttribute("data-wind-state", "collecting");
  await expect(tile).toHaveText("---°/---");
  await expect(page.getByTestId("map")).toHaveAttribute(
    "data-map-ready",
    "true",
  );
  await turn(page);
  await expect(tile).toHaveAttribute("data-wind-state", "valid");
  await expect(tile).toHaveText("270°/012");
  const arrow = page.getByTestId("wind-arrow");
  await expect(arrow).toBeVisible();
  expect(
    await arrow.evaluate(
      (node) => new DOMMatrixReadOnly(getComputedStyle(node).transform).b,
    ),
  ).toBeCloseTo(1, 3);
  const box = (await tile.boundingBox())!;
  expect(box.x).toBeLessThan(20);
  expect(box.y).toBeGreaterThan(360);
  await page.screenshot({ path: "test-results/wind-tile.png" });
  await context.setOffline(true);
  await expect(tile).toHaveText("270°/012");
  await page.clock.fastForward(21000);
  await expect(tile).toHaveAttribute("data-wind-state", "stale");
  await expect(tile).toHaveText("---°/---");
  await expect(arrow).toHaveCount(0);
  await context.setOffline(false);
  await page.reload();
  await expect(tile).toHaveAttribute("data-wind-state", "collecting");
  await expect(tile).toHaveText("---°/---");
});

test("a flight session without confirmed take-off cannot create live wind; tile also exists on Map in Polish", async ({
  page,
}) => {
  test.setTimeout(60000);
  await seed(page, false, "pl");
  await page.goto("/map");
  const tile = page.getByTestId("wind-tile");
  await expect(tile).toHaveAttribute("aria-label", /Wiatr szacowany/);
  await turn(page);
  await expect(tile).toHaveText("---°/---");
  await expect(tile).toHaveAttribute("data-wind-state", "collecting");
});
