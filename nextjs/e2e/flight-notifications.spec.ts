import { expect, test } from "./test";
import { newFlight } from "../src/data/flight";
import { newTimers } from "../src/domain/flight-timers";

test("flight commands share one popup system, dismiss independently and do not repeat on every GPS update", async ({
  page,
}) => {
  const time = new Date();
  await page.clock.install({ time });
  await page.clock.pauseAt(new Date(time.getTime() + 1000));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => route.abort());
  const route = [
    { ident: "AAAA", lat: 50, lon: 19 },
    { ident: "BBBB", lat: 50, lon: 20, altitudeFt: 3000 },
    { ident: "CCCC", lat: 51, lon: 20, altitudeFt: 4000 },
  ];
  await page.addInitScript(
    ({ flight, route, timers }) => {
      localStorage.setItem("nordsweet.language.v1", "en");
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
              startedAt: new Date().toISOString(),
              phase: "cruise",
              route,
              activeLeg: 0,
              patternNotice: {
                report: "downwind",
                expiresAt: Date.now() + 60000,
              },
              timers: {
                ...timers,
                events: [
                  {
                    name: "Landing",
                    at: Date.now(),
                    notedAt: Date.now(),
                    source: "manual",
                    lat: null,
                    lon: null,
                    altitudeFt: null,
                  },
                ],
              },
            },
          }),
        );
      navigator.geolocation.watchPosition = (success) => {
        const sample = () => {
          const changed = localStorage.getItem("test.next-leg") === "yes";
          success({
            timestamp: Date.now(),
            coords: {
              latitude: 50,
              longitude: changed ? 20.1 : 19.2,
              altitude: 304.8,
              heading: changed ? 90 : 0,
              speed: 51.4444,
              accuracy: 5,
              altitudeAccuracy: 5,
            },
          } as GeolocationPosition);
        };
        sample();
        return window.setInterval(sample, 1000);
      };
      navigator.geolocation.clearWatch = (id) => window.clearInterval(id);
    },
    {
      flight: {
        ...newFlight(),
        departure: route[0],
        destination: route[2],
        waypoints: [route[1]],
        cruiseAltitudeFt: 3000,
      },
      route,
      timers: newTimers(),
    },
  );
  await page.goto("/fly");
  const stack = page.getByTestId("flight-notifications");
  const heading = stack.getByRole("status", { name: "Heading", exact: true });
  const altitude = stack.getByRole("status", { name: "Altitude", exact: true });
  await expect(heading).toContainText(/Turn Right Heading \d{3}°/);
  await expect(altitude).toContainText("Climb 3000 ft");
  await expect(
    stack.getByRole("status", { name: "Comms", exact: true }),
  ).toContainText("Report downwind");
  // All categories use the same card and fit beside the phone's flight-control rail.
  for (const card of await stack.getByRole("status").all()) {
    await expect(card).toHaveClass(/text-card-foreground/);
    const box = (await card.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThan(320);
    expect(
      await card.evaluate((element) => {
        const box = element.getBoundingClientRect();
        const hit = document.elementFromPoint(
          box.x + 12,
          box.y + box.height / 2,
        );
        return element.contains(hit);
      }),
    ).toBe(true);
  }
  await page.screenshot({
    path: "test-results/unified-flight-popups-phone.png",
  });
  await heading
    .getByRole("button", { name: "Dismiss Heading", exact: true })
    .click();
  await expect(heading).toHaveCount(0);
  await expect(altitude).toBeVisible();
  // A new sample on the same leg must not redisplay the dismissed heading.
  await page.clock.fastForward(1500);
  await expect(heading).toHaveCount(0);
  await page.evaluate(() => localStorage.setItem("test.next-leg", "yes"));
  await page.clock.fastForward(1000);
  await expect(heading).toContainText(/Turn Left Heading \d{3}°/);
  await expect(altitude).toContainText("Climb 4000 ft");
  const bell = page.getByRole("button", { name: "Notifications", exact: true });
  await bell.click();
  const history = page.getByRole("dialog", {
    name: "Notifications",
    exact: true,
  });
  const entries = history.getByRole("listitem");
  await expect(history).toContainText("Turn Right Heading");
  await expect(history).toContainText("Climb 3000 ft");
  await expect(history).toContainText("Report downwind");
  await expect(history.locator('[data-category="system"]')).toHaveCount(1);
  const dates = await history
    .locator("time")
    .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("datetime")));
  expect(dates.length).toBeGreaterThanOrEqual(6);
  expect(
    dates.every((date) => date !== null && Number.isFinite(Date.parse(date))),
  ).toBe(true);
  await expect(bell.locator('[aria-label^="New notifications"]')).toHaveCount(
    0,
  );
  const count = await entries.count();
  await page.screenshot({
    path: "test-results/notification-history-phone.png",
  });
  await page.goto("/map");
  await bell.click();
  await expect(entries).toHaveCount(count);
  await expect(history).toContainText("Climb 3000 ft");
  await page.reload();
  await bell.click();
  await expect(entries).toHaveCount(count);
  expect(
    await history
      .locator("time")
      .evaluateAll((nodes) =>
        nodes.map((node) => node.getAttribute("datetime")),
      ),
  ).toEqual(dates);
});
