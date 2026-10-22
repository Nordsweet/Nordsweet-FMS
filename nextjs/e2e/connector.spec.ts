import { expect, test, type WebSocketRoute } from "./test";

test("Connector source feeds Fly, survives reload and clears stale fixes without GPS fallback", async ({
  page,
}) => {
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => route.abort());
  await page.addInitScript(() => {
    localStorage.setItem("nordsweet.language.v1", "en");
    // A fresh Connector-only page need not register a native GPS watch at all.
    Object.defineProperty(window, "__emitDevicePosition", {
      configurable: true,
      value: () => undefined,
    });
    Object.defineProperty(navigator, "geolocation", {
      value: {
        watchPosition: (success: (position: unknown) => void) => {
          Object.defineProperty(window, "__emitDevicePosition", {
            configurable: true,
            value: () =>
              success({
                coords: {
                  latitude: 53,
                  longitude: 19,
                  altitude: 100,
                  speed: 20,
                  heading: 180,
                  accuracy: 5,
                  altitudeAccuracy: 5,
                },
                timestamp: Date.now(),
              }),
          });
          return 1;
        },
        clearWatch: () => undefined,
      },
    });
  });
  let socket: WebSocketRoute | undefined;
  let payload: string | undefined;
  await page.routeWebSocket("wss://pc.example.ts.net:8767/ws*", (route) => {
    socket = route;
    const heartbeat = setInterval(() => {
      if (payload) route.send(payload);
    }, 100);
    route.onClose(() => clearInterval(heartbeat));
    page.once("close", () => clearInterval(heartbeat));
  });
  await page.goto("/");
  await expect(
    page.getByRole("combobox", { name: "Position source", exact: true }),
  ).toHaveCount(0);
  await page.goto("/fly");
  await page
    .getByRole("button", { name: "Position source", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Position source", exact: true })
    .selectOption("connector");
  await page
    .getByLabel("Connector HTTPS address")
    .fill("https://pc.example.ts.net:8767");
  await page.getByLabel("Connector token").fill("test-token");
  await page.getByRole("button", { name: "Connect", exact: true }).click();
  await expect.poll(() => !!socket).toBe(true);
  const send = (
    stale = false,
    demo = false,
    paused = false,
    onGround = false,
  ) =>
    socket!.send(
      (payload = JSON.stringify({
        schemaVersion: 1,
        source: demo ? "demo" : "prepar3d-v5",
        connected: true,
        paused,
        stale,
        ageMs: stale ? 3000 : 0,
        receivedAt: new Date().toISOString(),
        data: {
          latitude: 52.16,
          longitude: 20.97,
          altitudeMslFt: 2500,
          altitudeAglFt: 2100,
          indicatedAltitudeFt: 2600,
          groundSpeedKt: 110,
          indicatedAirspeedKt: 100,
          trueAirspeedKt: 105,
          headingTrueDeg: 90,
          headingMagneticDeg: 85,
          trackTrueDeg: 92,
          verticalSpeedFpm: -300,
          pitchDeg: 2,
          bankDeg: -10,
          onGround: onGround ? 1 : 0,
        },
      })),
    );
  send();
  await expect(page.getByTestId("connector-status")).toHaveText(
    "Prepar3D — connected",
  );
  // The connection shortcut can select the source before starting a flight.
  expect(
    await page.evaluate(() => localStorage.getItem("nordsweet.inflight.v1")),
  ).not.toContain('"startedAt":"');
  await expect(page.getByTestId("wind-tile")).toContainText("308°/006");
  await expect(page.getByTestId("wind-tile")).toHaveAttribute(
    "data-wind-state",
    "valid",
  );
  await expect(page.getByTestId("wind-tile")).toHaveAttribute("title", /P3D/);

  await expect(page.getByTestId("status-altitude")).toHaveText("2500 ft");
  await expect(page.getByTestId("status-gs")).toHaveText("110 kt");
  await expect(page.getByTestId("status-vs")).toHaveText("-300");
  await expect(page.getByTestId("status-agl")).toHaveText("2100 ft");
  await expect(page.getByTestId("status-utc")).toHaveText(
    /^\d{2}:\d{2}:\d{2}$/,
  );
  await page.screenshot({ path: "test-results/connector-desktop.png" });
  await page.setViewportSize({ width: 1024, height: 768 });
  await expect(page.getByLabel("Connector token")).toBeInViewport();
  await expect(
    page.getByRole("button", { name: "Disconnect", exact: true }),
  ).toBeInViewport();
  await page.screenshot({ path: "test-results/connector-tablet.png" });
  await expect(page.getByTestId("connector-telemetry")).toContainText("110");
  await page.evaluate(() =>
    (
      window as unknown as { __emitDevicePosition: () => void }
    ).__emitDevicePosition(),
  );
  await expect(page.getByTestId("connector-telemetry")).toContainText("110");
  send(false, false, false, true);
  await expect(page.getByTestId("wind-tile")).toContainText("---°/---");
  send();
  await expect(page.getByTestId("wind-tile")).toContainText("308°/006");
  send(false, true);
  await expect(
    page.getByText("DEMO — simulated data", { exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId("wind-tile")).toContainText("---°/---");
  send(false, false, true);
  await expect(page.getByTestId("connector-status")).toHaveText(
    "Prepar3D — paused",
  );
  await expect(page.getByTestId("wind-tile")).toContainText("---°/---");
  send(true);
  await expect(page.getByTestId("connector-status")).toHaveText(
    "No current data from Prepar3D",
  );
  await expect(page.getByTestId("connector-telemetry")).toHaveCount(0);
  await page.evaluate(() =>
    (
      window as unknown as { __emitDevicePosition: () => void }
    ).__emitDevicePosition(),
  );
  await expect(page.getByTestId("connector-status")).toHaveText(
    "No current data from Prepar3D",
  );
  await page.reload();
  await page
    .getByRole("button", { name: "Position source", exact: true })
    .click();
  await expect(
    page.getByRole("combobox", { name: "Position source", exact: true }),
  ).toHaveValue("connector");
  await expect(page.getByLabel("Connector token")).toHaveValue("test-token");
  await page.getByRole("button", { name: "Disconnect", exact: true }).click();
  await expect(page.getByTestId("connector-status")).toHaveText(
    "Connector disconnected",
  );
  // A new tab has no sessionStorage from the first tab; credentials are still remembered.
  const reopened = await page.context().newPage();
  await reopened.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) =>
    route.abort(),
  );
  await reopened.goto("/fly");
  await reopened
    .getByRole("button", { name: "Position source", exact: true })
    .click();
  await expect(reopened.getByLabel("Connector HTTPS address")).toHaveValue(
    "https://pc.example.ts.net:8767",
  );
  await expect(reopened.getByLabel("Connector token")).toHaveValue(
    "test-token",
  );
  expect(
    await reopened.evaluate(() =>
      sessionStorage.getItem("nordsweet.position-source.v1"),
    ),
  ).toBeNull();
  expect(
    await reopened.evaluate(() => localStorage.getItem("nordsweet.flight.v2")),
  ).not.toContain("test-token");
  await reopened.close();
  await page
    .getByRole("combobox", { name: "Position source", exact: true })
    .selectOption("device");
  await expect(page.getByLabel("Connector token")).toHaveCount(0);
  await page.evaluate(() =>
    (
      window as unknown as { __emitDevicePosition: () => void }
    ).__emitDevicePosition(),
  );
  await expect(page.getByTestId("connector-telemetry")).toHaveCount(0);
});
