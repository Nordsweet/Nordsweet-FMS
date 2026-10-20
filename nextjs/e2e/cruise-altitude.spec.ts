import { expect, test } from "./test";
import { newFlight } from "../src/data/flight";
import { newTimers } from "../src/domain/flight-timers";

for (const accept of [true, false])
  test(`higher cruise level asks after two minutes; ${accept ? "YES updates the plan" : "No retains the plan without repeated prompts"}`, async ({
    page,
  }) => {
    test.setTimeout(60000);
    const advance = async (ms: number) => {
      for (let left = ms; left > 0; left -= 5000)
        await page.clock.fastForward(Math.min(5000, left));
    };
    const now = new Date();
    await page.clock.install({ time: now });
    await page.clock.pauseAt(new Date(now.getTime() + 1000));
    await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => r.abort());
    await page.addInitScript(
      ({ flight, route, timers }) => {
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
          const send = () =>
            success({
              timestamp: Date.now(),
              coords: {
                latitude: 50,
                longitude: 19,
                altitude: 5980 * 0.3048,
                accuracy: 5,
                altitudeAccuracy: 5,
                speed: 51.4444,
                heading: 45,
              },
            } as GeolocationPosition);
          send();
          return window.setInterval(send, 5000);
        };
        navigator.geolocation.clearWatch = (id) => clearInterval(id);
      },
      {
        flight: {
          ...newFlight(),
          cruiseAltitudeFt: 5000,
          departure: { ident: "EPKK", lat: 50.0778, lon: 19.7847 },
          destination: { ident: "EPNT", lat: 49.4628, lon: 20.0507 },
          waypointAltitudes: { PASSED: 5000, FREE: 5000, LIMIT: 5000 },
          pointRestrictions: {
            LIMIT: {
              altitudeFt: 5000,
              altitudeMode: "at" as const,
              speedKt: null,
            },
          },
        },
        route: [
          { ident: "PASSED", lat: 50, lon: 19, altitudeFt: 5000 },
          { ident: "FREE", lat: 51, lon: 20, altitudeFt: 5000 },
          { ident: "LIMIT", lat: 52, lon: 21, altitudeFt: 5000 },
        ],
        timers: newTimers(),
      },
    );
    await page.goto("/fly");
    await expect(page.getByTestId("status-altitude")).toHaveText("5980 ft");
    const popup = page.getByTestId("cruise-altitude-popup");
    await advance(119000);
    await expect(popup).toHaveCount(0);
    await advance(6000);
    await expect(popup).toContainText(
      "Do You want to change Cruise Altitude to 6000ft?",
    );
    await page.screenshot({
      path: `test-results/cruise-altitude-${accept ? "yes" : "no"}.png`,
    });
    await popup
      .getByRole("button", { name: accept ? "YES" : "No", exact: true })
      .click();
    await expect(popup).toHaveCount(0);
    const values = await page.evaluate(() => {
      const saved = JSON.parse(
        localStorage.getItem("nordsweet.flight.v2")!,
      ) as {
        state: {
          flight: {
            cruiseAltitudeFt: number;
            waypointAltitudes: Record<string, number>;
            pointRestrictions: Record<string, { altitudeFt: number }>;
          };
        };
      };
      const active = JSON.parse(
        localStorage.getItem("nordsweet.inflight.v1")!,
      ) as { state: { route: { altitudeFt: number }[]; activeLeg: number } };
      return {
        flight: saved.state.flight,
        route: active.state.route,
        leg: active.state.activeLeg,
      };
    });
    expect(values.flight.cruiseAltitudeFt).toBe(accept ? 6000 : 5000);
    expect(values.flight.waypointAltitudes).toEqual({
      PASSED: 5000,
      FREE: accept ? 6000 : 5000,
      LIMIT: 5000,
    });
    expect(values.route.map((p) => p.altitudeFt)).toEqual([
      5000,
      accept ? 6000 : 5000,
      5000,
    ]);
    expect(values.leg).toBe(0);
    await advance(125000);
    await expect(popup).toHaveCount(0);
  });
