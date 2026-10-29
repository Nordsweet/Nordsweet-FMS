import { expect, test } from "./test";
import { newFlight } from "../src/data/flight";
import { airportSchema } from "../src/data/schemas";
import airports from "../public/data/airports.json" with { type: "json" };
import { destinationPoint, initialBearingDeg } from "../src/domain/geo";

test("restored economy levels wait for route data before issuing altitude commands", async ({
  page,
}) => {
  test.setTimeout(90000);
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => r.abort());
  const departure = airportSchema.parse(
    airports.find((a) => a.ident === "EPNT"),
  );
  const arrival = airportSchema.parse(airports.find((a) => a.ident === "EPGD"));
  const heading = initialBearingDeg(departure, arrival);
  const waypoint = {
    ident: "WPT1",
    ...destinationPoint(departure, heading, 90),
  };
  const position = destinationPoint(departure, heading, 30);
  const point = (a: typeof departure) => ({
    ident: a.ident,
    lat: a.lat,
    lon: a.lon,
  });
  const flight = {
    ...newFlight(),
    departure: point(departure),
    destination: point(arrival),
    waypoints: [waypoint],
    cruiseAltitudeFt: 6000,
    waypointAltitudes: { WPT1: 12000, TOC: 6000, TOD: 6000 },
  };
  const route = [point(departure), waypoint, point(arrival)];
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
        const sample = () =>
          success({
            timestamp: Date.now(),
            coords: {
              latitude: position.lat,
              longitude: position.lon,
              altitude: 12000 * 0.3048,
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
    { flight, route, position, heading },
  );
  let release!: () => void;
  const blocked = new Promise<void>((resolve) => {
    release = resolve;
  });
  let requested!: () => void;
  const requestedData = new Promise<void>((resolve) => {
    requested = resolve;
  });
  await page.route("**/data/navpoints.json", async (r) => {
    requested();
    await blocked;
    await r.continue();
  });
  const navpointsResponse = page.waitForResponse(
    (response) =>
      response.url().includes("/data/navpoints.json") &&
      response.status() === 200,
  );
  try {
    await page.goto("/fly", { waitUntil: "domcontentloaded" });
    await requestedData;
    await expect(page.getByTestId("flight-status-bar")).toBeVisible();
    await page.waitForTimeout(3000);
    await expect(page.getByTestId("flight-notifications")).not.toContainText(
      "Descent to 6000ft",
    );
  } finally {
    release();
  }
  await navpointsResponse;
  await page.waitForTimeout(3000);
  await expect(page.getByTestId("flight-notifications")).not.toContainText(
    "Descent to 6000ft",
  );
  const entries = await page.evaluate(
    () =>
      (
        JSON.parse(
          localStorage.getItem("nordsweet.flight-notifications.v1") ??
            '{"state":{"entries":[]}}',
        ) as { state: { entries: { message: string }[] } }
      ).state.entries,
  );
  expect(entries.some((e) => e.message.includes("6000ft"))).toBe(false);
});
