import { expect, test, type WebSocketRoute } from "./test";
import { newFlight } from "../src/data/flight";

for (const tablet of [false, true]) {
  test.describe(tablet ? "iPad" : "PC", () => {
    test.use(
      tablet
        ? {
            viewport: { width: 1024, height: 768 },
            isMobile: true,
            hasTouch: true,
          }
        : {},
    );
    test("sparse P3D telemetry starts Air Time, reaches Cruise and prompts FREDA after 30 minutes", async ({
      page,
    }) => {
      test.setTimeout(90000);
      await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) =>
        route.abort(),
      );
      await page.addInitScript(
        (flight) => {
          localStorage.setItem("nordsweet.language.v1", "en");
          localStorage.setItem(
            "nordsweet.flight.v2",
            JSON.stringify({ version: 1, state: { flight } }),
          );
          localStorage.setItem(
            "nordsweet.position-source.v1",
            JSON.stringify({
              version: 0,
              state: {
                source: "connector",
                enabled: true,
                url: "https://sim.example",
                token: "test",
              },
            }),
          );
        },
        {
          ...newFlight(),
          aircraftId: "C152",
          departure: { ident: "EPKK", lat: 50.077778, lon: 19.784722 },
          destination: { ident: "EPNT", lat: 49.46283, lon: 20.05067 },
          cruiseAltitudeFt: 3000,
        },
      );
      let socket: WebSocketRoute | undefined;
      await page.routeWebSocket("wss://sim.example/ws*", (route) => {
        socket = route;
        route.onClose(() => {
          if (socket === route) socket = undefined;
          void route.close();
        });
      });
      await page.goto("/fly");
      await expect.poll(() => !!socket).toBe(true);
      await expect(page.getByTestId("map")).toHaveAttribute(
        "data-map-ready",
        "true",
      );
      await page
        .getByRole("button", { name: "Start flight", exact: true })
        .click();
      await page.clock.install();
      await page.clock.pauseAt(
        new Date((await page.evaluate(() => Date.now())) + 100),
      );
      const send = async (
        onGround: boolean,
        altitudeFt: number,
        speedKt: number,
      ) => {
        const at = await page.evaluate(() => Date.now());
        const frame = JSON.stringify({
          schemaVersion: 1,
          source: "prepar3d-v5",
          connected: true,
          paused: false,
          stale: false,
          ageMs: 0,
          receivedAt: new Date(at).toISOString(),
          data: {
            latitude: 50.077778,
            longitude: 19.784722,
            altitudeMslFt: altitudeFt,
            altitudeAglFt: altitudeFt - 778,
            indicatedAltitudeFt: altitudeFt,
            groundSpeedKt: speedKt,
            indicatedAirspeedKt: speedKt,
            trueAirspeedKt: speedKt,
            headingTrueDeg: 250,
            headingMagneticDeg: 245,
            trackTrueDeg: 250,
            verticalSpeedFpm: 0,
            pitchDeg: 0,
            bankDeg: 0,
            onGround: onGround ? 1 : 0,
          },
        });
        // WebSocket delivery is asynchronous even while the page clock is paused.
        // Keep telemetry flowing through the watchdog reconnect after each quiet time jump.
        // Advance the throttle until this exact sample reaches the flight timers.
        await expect
          .poll(
            async () => {
              socket?.send(frame);
              // Reconnect is scheduled 3 seconds after the watchdog closes the quiet socket.
              // A paused clock must advance through that delay, independently of real-time polling.
              await page.clock.runFor(1000);
              return page.evaluate(() => {
                const saved = JSON.parse(
                  localStorage.getItem("nordsweet.inflight.v1")!,
                ) as {
                  state: {
                    timers: {
                      last: {
                        at: number;
                        altitudeFt: number;
                        onGround: boolean;
                      } | null;
                    };
                  };
                };
                return saved.state.timers.last;
              });
            },
            { timeout: 15000, intervals: [100, 250, 500] },
          )
          .toMatchObject({ at, altitudeFt, onGround });
      };
      await send(true, 778, 0);
      const takeoff = await page.evaluate(() => Date.now());
      // The iPad need not receive any accelerating roll or the instant of crossing +50 ft.
      await send(false, 1200, 70);
      await expect
        .poll(() =>
          page.evaluate(() => {
            const saved = JSON.parse(
              localStorage.getItem("nordsweet.inflight.v1")!,
            ) as {
              state: { timers: { airTime: { startedAt: number | null } } };
            };
            return saved.state.timers.airTime.startedAt;
          }),
        )
        .not.toBeNull();
      await page.clock.fastForward(12000);
      await send(false, 3000, 90);
      await expect(page.getByTestId("flight-phase")).toContainText("Cruise");
      const freda = page.getByRole("dialog", { name: "FREDA", exact: true });
      const elapsed = (await page.evaluate(() => Date.now())) - takeoff;
      await page.clock.fastForward(1_800_000 - elapsed - 2000);
      await expect(freda).not.toBeVisible();
      await send(false, 3000, 90);
      await page.clock.fastForward(2000);
      await expect(freda).toBeVisible();
      await expect(freda).toContainText("Fuel");
    });
  });
}
