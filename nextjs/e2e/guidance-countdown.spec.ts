import { expect, test } from "./test";
import { newFlight } from "../src/data/flight";
import { newTimers } from "../src/domain/flight-timers";
import { observeChimes, chimeNotes } from "./helpers/chimes";

for (const scenario of [
  { name: "fly-over", flyOver: true, heading: 90, north: 0 },
  { name: "inside live fly-by", flyOver: false, heading: 50, north: -0.06 },
  { name: "outside live fly-by", flyOver: false, heading: 90, north: -1 },
])
  test(`${scenario.name} turn counts down, becomes NOW, and only then records a clean history message`, async ({
    page,
  }) => {
    test.setTimeout(60000);
    await observeChimes(page);
    await page.clock.install({ time: new Date("2026-10-19T12:00:00Z") });
    await page.clock.pauseAt(new Date("2026-10-19T12:00:01Z"));
    await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => r.abort());
    const route = [
      { ident: "A", lat: 50, lon: 19.9 },
      { ident: "B", lat: 50, lon: 20, flyOver: scenario.flyOver },
      { ident: "C", lat: 50.1, lon: 20 },
    ];
    await page.addInitScript(
      ({ route, flight, timers, scenario }) => {
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
              timers,
            },
          }),
        );
        navigator.geolocation.watchPosition = (success) => {
          const start = Date.now();
          const sample = () =>
            success({
              timestamp: Date.now(),
              coords: {
                latitude:
                  50 +
                  (scenario.north +
                    ((((Date.now() - start) / 1000) * 100) / 3600) *
                      Math.cos((scenario.heading * Math.PI) / 180)) /
                    60,
                longitude:
                  20 +
                  ((((Date.now() - start) / 1000 - 20) *
                    100 *
                    Math.sin((scenario.heading * Math.PI) / 180)) /
                    3600 -
                    (scenario.flyOver
                      ? 0
                      : (100 / (60 * Math.PI)) *
                        (1 - Math.cos((scenario.heading * Math.PI) / 180)))) /
                    (60 * Math.cos((50 * Math.PI) / 180)),
                altitude: 914.4,
                heading: scenario.heading,
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
        route,
        flight: {
          ...newFlight(),
          departure: route[0],
          destination: route[2],
          waypoints: [route[1]],
          cruiseAltitudeFt: 3000,
        },
        timers: newTimers(),
        scenario,
      },
    );
    await page.goto("/fly");
    const heading = page
      .getByTestId("flight-notifications")
      .getByRole("status", { name: "Heading", exact: true });
    await expect(heading).toContainText(
      /Turn Left Heading \d{3}° in \d+ seconds?/,
    );
    const history = () =>
      page.evaluate(() => {
        const saved = JSON.parse(
          localStorage.getItem("nordsweet.flight-notifications.v1") ??
            '{"state":{"entries":[]}}',
        ) as {
          state: {
            entries: { category: string; message: string; createdAt: number }[];
          };
        };
        return saved.state.entries.filter((e) => e.category === "heading");
      });
    expect(await history()).toEqual([]);
    await page.keyboard.press("Shift");
    await page.clock.fastForward(10000);
    await expect(heading).toContainText(/in (9|10|11) seconds/);
    const initialNotes = await chimeNotes(page);
    await page.clock.fastForward(1000);
    expect(await chimeNotes(page)).toEqual(initialNotes);
    await page.clock.fastForward(10000);
    await expect(heading).toContainText(/Turn Left Heading \d{3}° now/);
    await expect.poll(() => chimeNotes(page)).toEqual([...initialNotes, 880]);
    const entries = await history();
    expect(entries).toHaveLength(1);
    expect(entries[0]!.message).toMatch(/^Turn Left Heading \d{3}°$/);
    expect(entries[0]!.createdAt).toBeGreaterThanOrEqual(
      Date.parse("2026-10-19T12:00:19Z"),
    );
    expect(entries[0]!.createdAt).toBeLessThanOrEqual(
      Date.parse("2026-10-19T12:00:22Z"),
    );
    await page.clock.fastForward(3000);
    expect(await history()).toEqual(entries);
    expect(await chimeNotes(page)).toEqual([...initialNotes, 880]);
  });
