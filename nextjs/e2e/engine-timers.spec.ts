import { expect, test, selectFlightPhase } from "./test";
import { newFlight } from "../src/data/flight";

test("engine warm-up and stationary cool-down count down and movement resets cooling", async ({
  page,
}) => {
  test.setTimeout(120000);
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => r.abort());
  await page.addInitScript(
    (flight) => {
      localStorage.setItem("nordsweet.language.v1", "en");
      if (!localStorage.getItem("nordsweet.flight.v2"))
        localStorage.setItem(
          "nordsweet.flight.v2",
          JSON.stringify({ version: 1, state: { flight } }),
        );
      const speed = () =>
        (window as Window & { engineTestSpeed?: number }).engineTestSpeed ?? 0;
      Object.defineProperty(navigator, "geolocation", {
        configurable: true,
        value: {
          watchPosition: (callback: PositionCallback) => {
            const send = () =>
              callback({
                timestamp: Date.now(),
                coords: {
                  latitude: 50.077778,
                  longitude: 19.784722,
                  accuracy: 5,
                  altitude: 240,
                  altitudeAccuracy: 5,
                  heading: 0,
                  speed: (speed() * 1852) / 3600,
                },
              } as GeolocationPosition);
            send();
            return setInterval(send, 1000);
          },
          clearWatch: (id: number) => clearInterval(id),
        },
      });
    },
    {
      ...newFlight(),
      departure: { ident: "EPKK", lat: 50.077778, lon: 19.784722 },
      destination: { ident: "EPNT", lat: 49.46283, lon: 20.05067 },
    },
  );
  await page.goto("/fly");
  await page.getByRole("button", { name: "Start flight", exact: true }).click();
  await page.clock.install();
  await page.clock.pauseAt(
    new Date((await page.evaluate(() => Date.now())) + 100),
  );
  const warm = page.getByRole("region", { name: "Warm Up", exact: true });
  await warm.getByRole("button", { name: "Engine Start", exact: true }).click();
  await page.clock.fastForward(10000);
  await expect(warm.getByTestId("engine-assistant-timer")).toHaveText("00:50");
  await page.reload();
  await expect(warm).toBeVisible({ timeout: 30000 });
  await expect(warm.getByTestId("engine-assistant-timer")).toHaveText("00:50");
  await page.clock.fastForward(50000);
  await expect(warm).toContainText("1 minute elapsed");
  await selectFlightPhase(page, "Taxi-In");
  const cool = page.getByRole("region", {
    name: "Cool Down Assistant",
    exact: true,
  });
  await expect(warm).toHaveCount(0);
  await page.clock.runFor(1000);
  const timer = cool.getByTestId("engine-assistant-timer");
  await expect(timer).toHaveText(/0[01]:[0-5]\d/);
  await page.clock.runFor(10000);
  await expect(timer).toHaveText(/00:[45]\d/);
  await page.evaluate(() => {
    (window as Window & { engineTestSpeed?: number }).engineTestSpeed = 5;
  });
  await page.clock.runFor(2000);
  await expect(timer).toHaveText("01:00");
  await page.evaluate(() => {
    (window as Window & { engineTestSpeed?: number }).engineTestSpeed = 0;
  });
  await page.clock.runFor(2000);
  await expect(timer).toHaveText(/00:5\d/);
  for (let i = 0; i < 6; i++) await page.clock.fastForward(10000);
  await expect(cool).toContainText("1 minute elapsed");
  const box = (await cool.boundingBox())!;
  expect(box.x).toBeLessThan(200);
  expect(box.y).toBeLessThan(250);
  await page.screenshot({ path: "test-results/engine-cool-down.png" });
});
