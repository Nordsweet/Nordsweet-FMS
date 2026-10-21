import { expect, test } from "./test";
import { newFlight } from "../src/data/flight";
import { destinationPoint } from "../src/domain/geo";

test("approaching traffic escalates from yellow TA to red proximity, without resolutions, and is logged", async ({
  page,
}) => {
  const time = new Date();
  await page.clock.install({ time });
  await page.clock.pauseAt(new Date(time.getTime() + 1000));
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => r.abort());
  const own = { ident: "AAAA", lat: 50, lon: 19 };
  const route = [own, { ident: "BBBB", ...destinationPoint(own, 0, 40) }];
  let close = false;
  await page.route("https://aviation.lab.vibecde.com/**", async (r) => {
    if (!new URL(r.request().url()).pathname.endsWith("/traffic"))
      return r.fulfill({ json: { sources: {}, places: [] } });
    const now = await page.evaluate(() => Date.now());
    return r.fulfill({
      json: {
        count: 1,
        aircraft: [
          {
            ...destinationPoint(own, 0, close ? 1.8 : 3.3),
            hex: "abc123",
            callsign: "TEST123",
            registration: "SP-TEST",
            type: "C172",
            altitude_ft: close ? 1400 : 1700,
            ground_speed_kt: 200,
            track_deg: 180,
            vertical_rate_fpm: 0,
            on_ground: false,
            squawk: null,
            position_time: new Date(now).toISOString(),
            sources: ["adsb.lol"],
          },
        ],
        sources: {},
      },
    });
  });
  await page.addInitScript(
    ({ route, flight }) => {
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
              latitude: 50,
              longitude: 19,
              altitude: 304.8,
              speed: 51.4444,
              heading: 0,
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
      route,
      flight: {
        ...newFlight(),
        departure: route[0],
        destination: route[1],
        cruiseAltitudeFt: 1000,
      },
    },
  );
  const loaded = page.waitForResponse((response) =>
    new URL(response.url()).pathname.endsWith("/traffic"),
  );
  await page.goto("/fly");
  await loaded;
  await page.clock.fastForward(1000);
  await expect(page.getByTestId("map")).toHaveAttribute(
    "data-map-ready",
    "true",
  );
  const ta = page.getByTestId("traffic-ta");
  await expect(ta).toContainText("Traffic advisory: TEST123");
  await expect(ta).toHaveClass(/border-yellow-400/);
  await ta.getByRole("button").click();
  await expect(ta).toHaveCount(0);
  close = true;
  const updated = page.waitForResponse((response) =>
    new URL(response.url()).pathname.endsWith("/traffic"),
  );
  await page.clock.fastForward(15000);
  await updated;
  await page.clock.fastForward(1000);
  const red = page.getByTestId("traffic-close");
  await expect(red).toContainText("Traffic close: TEST123");
  await expect(red).toHaveClass(/border-red-500/);
  await expect(red).not.toContainText(/climb|descend|resolution/i);
  await page.clock.resume();
  await page.screenshot({ path: "test-results/traffic-close.png" });
  await page
    .getByRole("button", { name: "Notifications", exact: true })
    .click();
  const history = page.getByRole("dialog", {
    name: "Notifications",
    exact: true,
  });
  await expect(history).toContainText("Traffic advisory: TEST123");
  await expect(history).toContainText("Traffic close: TEST123");
});
