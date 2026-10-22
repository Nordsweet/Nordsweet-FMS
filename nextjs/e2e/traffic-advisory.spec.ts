import { expect, test } from "./test";
import { newFlight } from "../src/data/flight";
import { destinationPoint } from "../src/domain/geo";

test("approaching traffic escalates from yellow TA to red proximity, without resolutions, and is logged", async ({
  page,
}) => {
  test.setTimeout(60000);
  const time = new Date();
  await page.clock.install({ time });
  await page.clock.pauseAt(new Date(time.getTime() + 1000));
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => r.abort());
  const own = { ident: "AAAA", lat: 50, lon: 19 };
  const route = [own, { ident: "BBBB", ...destinationPoint(own, 0, 40) }];
  let close = false;
  let rangeNm = 9;
  let receding = false;
  await page.route("https://aviation.lab.vibecde.com/**", async (r) => {
    if (!new URL(r.request().url()).pathname.endsWith("/traffic"))
      return r.fulfill({ json: { sources: {}, places: [] } });
    const now = await page.evaluate(() => Date.now());
    return r.fulfill({
      json: {
        count: 1,
        aircraft: [
          {
            ...destinationPoint(own, 0, close ? 1.8 : rangeNm),
            hex: "abc123",
            callsign: "TEST123",
            registration: "SP-TEST",
            type: "C172",
            altitude_ft: close ? 1400 : 1700,
            ground_speed_kt: 200,
            track_deg: receding ? 0 : 180,
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
  await page.getByTestId("map-recenter").click();
  await page.clock.fastForward(1000);
  const clockDots = async () => {
    await page.clock.fastForward(100);
    const box = (await page.getByTestId("map").boundingBox())!;
    const png = await page.screenshot({
      clip: {
        x: Math.round(box.x + box.width / 2 - 60),
        y: Math.round(box.y + box.height * 0.75 - 60),
        width: 120,
        height: 120,
      },
    });
    return page.evaluate(async (bytes) => {
      const image = await createImageBitmap(
        new Blob([new Uint8Array(bytes)], { type: "image/png" }),
      );
      const canvas = new OffscreenCanvas(120, 120);
      const context = canvas.getContext("2d")!;
      context.drawImage(image, 0, 0);
      image.close();
      const pixels = context.getImageData(0, 0, 120, 120).data;
      let dots = 0;
      for (let hour = 0; hour < 12; hour++) {
        const x = Math.round(60 + Math.sin((hour * Math.PI) / 6) * 42);
        const y = Math.round(60 - Math.cos((hour * Math.PI) / 6) * 42);
        let blue = false;
        for (let dy = -4; dy <= 4; dy++)
          for (let dx = -4; dx <= 4; dx++) {
            const i = ((y + dy) * 120 + x + dx) * 4;
            blue ||=
              Math.abs(pixels[i]! - 36) < 8 &&
              Math.abs(pixels[i + 1]! - 79) < 8 &&
              Math.abs(pixels[i + 2]! - 134) < 8;
          }
        if (blue) dots++;
      }
      return dots;
    }, Array.from(png));
  };
  // 300 kt closure at 9 NM is 108 seconds: the clock precedes any TA.
  await expect(page.getByTestId("traffic-ta")).toHaveCount(0);
  await expect.poll(clockDots).toBe(12);
  await page.screenshot({ path: "test-results/traffic-clock.png" });
  const refreshTraffic = async () => {
    const updated = page.waitForResponse((response) =>
      new URL(response.url()).pathname.endsWith("/traffic"),
    );
    await page.clock.fastForward(15000);
    await updated;
    await page.clock.fastForward(1000);
  };
  rangeNm = 3.3;
  await refreshTraffic();
  const ta = page.getByTestId("traffic-ta");
  await expect(ta).toContainText("Traffic advisory: TEST123");
  await expect(ta).toHaveClass(/border-yellow-400/);
  await ta.getByRole("button").click();
  await expect(ta).toHaveCount(0);
  close = true;
  await refreshTraffic();
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
  await history.getByRole("button", { name: "Close", exact: true }).click();
  close = false;
  receding = true;
  rangeNm = 9;
  await refreshTraffic();
  // The forward GPS vector can occupy twelve o'clock, but the other eleven dots disappear.
  await expect.poll(clockDots).toBeLessThan(2);
});
