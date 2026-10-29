import { expect, test } from "./test";
import { newFlight } from "../src/data/flight";
import { airportSchema } from "../src/data/schemas";
import airports from "../public/data/airports.json" with { type: "json" };
import { buildRoutePlan } from "../src/domain/route-plan";
import { navigationRoute } from "../src/domain/navigation-route";
import { destinationPoint, initialBearingDeg } from "../src/domain/geo";

test("TOC/TOD dots stay on the drawn line and descent counts down into clean notification history", async ({
  page,
}) => {
  // Leave room for moving-map initialization under concurrent CI load.
  test.setTimeout(90000);
  const start = new Date("2026-10-20T12:00:00Z");
  await page.clock.install({ time: start });
  await page.clock.pauseAt(new Date(start.getTime() + 1000));
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => r.abort());
  const departure = airportSchema.parse(
    airports.find((a) => a.ident === "EPML"),
  );
  const destination = airportSchema.parse(
    airports.find((a) => a.ident === "EPRJ"),
  );
  const plan = buildRoutePlan(
    {
      airport: () => null,
      point: () => null,
      procedures: () => [],
      airways: {},
    },
    {
      departure,
      destination,
      alternate: null,
      altitudeFt: 5000,
      routeText: "",
      selections: { SID: null, STAR: null, APPROACH: null },
      inlineSelections: {},
      insertedWaypoints: [],
      waypointAltitudes: {},
      waypointWx: {},
      conditionsWind: null,
      runwayWind: () => null,
      climbGradientFtPerNm: 500,
    },
  )!;
  const route = navigationRoute(plan);
  const tod = plan.points.find((p) => p.id === "TOD")!;
  const heading = initialBearingDeg(route[0]!, route.at(-1)!);
  const position = destinationPoint(
    destinationPoint(tod, heading + 180, (100 * 20) / 3600),
    heading + 90,
    0.6,
  );
  await page.addInitScript(
    ({ flight, route, position, heading }) => {
      localStorage.setItem("nordsweet.language.v1", "en");
      localStorage.setItem(
        "nordsweet.flight.v2",
        JSON.stringify({ version: 1, state: { flight } }),
      );
      localStorage.setItem(
        "nordsweet.inflight.v1",
        JSON.stringify({
          version: 1,
          state: {
            startedAt: new Date().toISOString(),
            phase: "cruise",
            route,
            activeLeg: 0,
          },
        }),
      );
      navigator.geolocation.watchPosition = (success) => {
        const movementStart = Date.now();
        const sample = () =>
          success({
            timestamp: Date.now(),
            coords: {
              latitude:
                position.lat +
                (((Math.cos((heading * Math.PI) / 180) *
                  (Date.now() - movementStart)) /
                  1000) *
                  100) /
                  3600 /
                  60,
              longitude:
                position.lon +
                (((Math.sin((heading * Math.PI) / 180) *
                  (Date.now() - movementStart)) /
                  1000) *
                  100) /
                  3600 /
                  60 /
                  Math.cos((position.lat * Math.PI) / 180),
              altitude: 5000 * 0.3048,
              heading,
              speed: 100 / 1.943844,
              accuracy: 5,
              altitudeAccuracy: 5,
            },
          } as GeolocationPosition);
        sample();
        return window.setInterval(sample, 1000);
      };
      navigator.geolocation.clearWatch = (id) => window.clearInterval(id);
    },
    {
      flight: {
        ...newFlight(),
        aircraftId: "C172S",
        departure: {
          ident: departure.ident,
          lat: departure.lat,
          lon: departure.lon,
        },
        destination: {
          ident: destination.ident,
          lat: destination.lat,
          lon: destination.lon,
        },
        cruiseAltitudeFt: 5000,
        cruiseTasKt: 100,
      },
      route,
      position,
      heading,
    },
  );
  await page.goto("/fly");
  await expect(page.getByTestId("flight-status-bar")).toBeVisible();
  // Query notification timers must drain even while the simulated flight clock is paused.
  await expect
    .poll(async () => {
      await page.clock.runFor(100);
      return page.locator('[data-profile-marker="TOD"]').count();
    })
    .toBe(1);
  const popup = page
    .getByTestId("flight-notifications")
    .getByRole("status", { name: "Altitude", exact: true });
  await expect(popup).toContainText(/Descent to \d+ft in ([12]\d|30)s/);
  await expect(page.locator('[data-profile-marker="TOD"]')).toBeVisible();
  await page.clock.runFor(1000);
  for (const id of ["TOC", "TOD"]) {
    const marker = page.locator(`[data-profile-marker="${id}"]`);
    await expect(marker).toBeVisible();
    const dot = await marker.evaluate((el) => {
      const r = el.getBoundingClientRect();
      const p = getComputedStyle(el, "::before");
      return { x: r.left + parseFloat(p.left), y: r.top + parseFloat(p.top) };
    });
    const map = page.getByTestId("map");
    const box = (await map.boundingBox())!;
    const lon = Number(await map.getAttribute("data-center-lon")),
      lat = Number(await map.getAttribute("data-center-lat")),
      zoom = Number(await map.getAttribute("data-zoom"));
    const world = 512 * 2 ** zoom;
    const merc = (v: number) =>
      Math.log(Math.tan(Math.PI / 4 + (v * Math.PI) / 360));
    const projected = route.map((p) => ({
      x: box.x + box.width / 2 + ((p.lon - lon) / 360) * world,
      y:
        box.y +
        box.height / 2 -
        ((merc(p.lat) - merc(lat)) / (2 * Math.PI)) * world,
    }));
    const a = projected[0]!,
      b = projected.at(-1)!;
    const distance =
      Math.abs((b.x - a.x) * (dot.y - a.y) - (b.y - a.y) * (dot.x - a.x)) /
      Math.hypot(b.x - a.x, b.y - a.y);
    expect(distance).toBeLessThan(1.5);
  }
  await page.screenshot({ path: "test-results/toc-tod-anchored.png" });
  await page.clock.runFor(8000);
  await page.clock.runFor(1000);
  await expect(popup).toContainText(/in (\d|1\d)s/);
  await page.clock.runFor(16000);
  await page.clock.runFor(1000);
  await expect(popup).toContainText(/Descent to \d+ft now/);
  const entries = await page.evaluate(
    () =>
      (
        JSON.parse(
          localStorage.getItem("nordsweet.flight-notifications.v1")!,
        ) as { state: { entries: { message: string }[] } }
      ).state.entries,
  );
  expect(
    entries.filter((e) => /^Descent to \d+ft$/.test(e.message)),
  ).toHaveLength(1);
});

test("1000ft to go appears during actual climb and is recorded once", async ({
  page,
}) => {
  test.setTimeout(60000);
  await page.clock.install({ time: new Date("2026-10-20T12:00:00Z") });
  await page.clock.pauseAt(new Date("2026-10-20T12:00:01Z"));
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => r.abort());
  const route = [
    { ident: "A", lat: 50, lon: 20 },
    { ident: "B", lat: 50, lon: 21, altitudeFt: 5000 },
  ];
  await page.addInitScript(
    ({ flight, route }) => {
      localStorage.setItem("nordsweet.language.v1", "en");
      localStorage.setItem(
        "nordsweet.flight.v2",
        JSON.stringify({ version: 1, state: { flight } }),
      );
      localStorage.setItem(
        "nordsweet.inflight.v1",
        JSON.stringify({
          version: 1,
          state: {
            startedAt: new Date().toISOString(),
            phase: "climb",
            route,
            activeLeg: 0,
          },
        }),
      );
      navigator.geolocation.watchPosition = (success) => {
        const start = Date.now();
        const sample = () =>
          success({
            timestamp: Date.now(),
            coords: {
              latitude: 50,
              longitude: 20.1,
              altitude: (3800 + ((Date.now() - start) / 1000) * 20) * 0.3048,
              heading: 90,
              speed: 72 / 1.943844,
              accuracy: 5,
              altitudeAccuracy: 5,
            },
          } as GeolocationPosition);
        sample();
        return window.setInterval(sample, 1000);
      };
      navigator.geolocation.clearWatch = (id) => window.clearInterval(id);
    },
    {
      flight: {
        ...newFlight(),
        aircraftId: "C172S",
        departure: route[0],
        destination: route[1],
        cruiseAltitudeFt: 5000,
      },
      route,
    },
  );
  await page.goto("/fly");
  await page.clock.runFor(12000);
  await expect(page.getByTestId("flight-notifications")).toContainText(
    "1000ft to go",
  );
  await page.clock.runFor(4000);
  const messages = await page.evaluate(() =>
    (
      JSON.parse(
        localStorage.getItem("nordsweet.flight-notifications.v1")!,
      ) as { state: { entries: { message: string }[] } }
    ).state.entries.map((e) => e.message),
  );
  expect(messages.filter((m) => m === "1000ft to go")).toHaveLength(1);
});
