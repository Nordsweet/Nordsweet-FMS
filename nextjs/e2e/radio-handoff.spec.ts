import { expect, test } from "./test";
import { newFlight } from "../src/data/flight";

test("climb crossing ATZ to FIS and entering TMA both suggest the current local service", async ({
  page,
}) => {
  test.setTimeout(60000);
  await page.clock.install({ time: new Date("2026-10-20T12:00:00Z") });
  await page.clock.pauseAt(new Date("2026-10-20T12:00:01Z"));
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => r.abort());
  const zone = (
    name: string,
    west: number,
    east: number,
    frequencyMhz: string,
    callsign: string,
    lower = "GND",
  ) => ({
    type: "Feature",
    bbox: [west, 49, east, 51],
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [west, 49],
          [east, 49],
          [east, 51],
          [west, 51],
          [west, 49],
        ],
      ],
    },
    properties: {
      name,
      class: name.split(" ")[0],
      lower,
      upper: "FL095",
      active_now: true,
      activations: [],
      frequencies: [
        {
          frequencyMhz,
          callsign,
          sector: null,
          serviceId: name.startsWith("TMA")
            ? "zblizanie"
            : name.startsWith("FIS")
              ? "fiss"
              : "radio",
        },
      ],
    },
  });
  const features = [
    zone("ATZ TEST", 19.8, 20.1, "122.305", "Test Radio"),
    zone("FIS LOCAL", 19, 22, "119.275", "Local Information"),
    zone("TMA TEST", 20.5, 21, "121.075", "Test Approach", "4000 FT AMSL"),
  ];
  await page.route("https://aviation.lab.vibecde.com/airspace**", (r) =>
    r.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        type: "FeatureCollection",
        features,
        sources: { test: "ok" },
      }),
    }),
  );
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
        const sample = () =>
          success({
            timestamp: Date.now(),
            coords: {
              latitude: 50,
              longitude: Number(localStorage.getItem("test.radio.lon") ?? 20),
              altitude: 5000 * 0.3048,
              heading: 90,
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
        departure: route[0],
        destination: route[1],
        cruiseAltitudeFt: 5000,
      },
      route,
    },
  );
  await page.goto("/fly");
  await expect(page.getByTestId("flight-status-bar")).toBeVisible();
  await page.getByRole("button", { name: "COMMs", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "COMMs", exact: true }),
  ).toContainText("Test Radio");
  await page.getByRole("button", { name: "COMMs", exact: true }).click();
  await page.evaluate(() => localStorage.setItem("test.radio.lon", "20.2"));
  await page.clock.runFor(3000);
  const frequency = page
    .getByTestId("flight-notifications")
    .getByRole("status", { name: "Frequency", exact: true });
  await expect(frequency).toContainText("119.275 Local Information (FIS)");
  await page.evaluate(() => localStorage.setItem("test.radio.lon", "20.6"));
  await page.clock.runFor(3000);
  await expect(frequency).toContainText("121.075 Test Approach");
});
