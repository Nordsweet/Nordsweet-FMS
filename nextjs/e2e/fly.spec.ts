import { selectFlightPhase, expect, test } from "./test";

const flight = {
  id: "e2e",
  name: "E2E",
  savedAt: "2026-10-12T08:00:00.000Z",
  aircraftId: null,
  departure: { ident: "AAAA", lat: 50, lon: 19 },
  destination: { ident: "CCCC", lat: 50, lon: 21 },
  alternate: null,
  waypoints: [{ ident: "BBBB", lat: 50, lon: 20 }],
  cruiseAltitudeFt: 3000,
  cruiseTasKt: 100,
  fuel: { blockL: 0 },
  stationsKg: {},
};

test.use({
  permissions: ["geolocation"],
  geolocation: { latitude: 50.02, longitude: 19.3, accuracy: 5 },
});

test("flies the route: sequencing, direct-to and debrief", async ({
  page,
  context,
}) => {
  test.setTimeout(60000);
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => route.abort());
  await page.addInitScript((f) => {
    if (!localStorage.getItem("nordsweet.flight.v2")) {
      localStorage.setItem("nordsweet.language.v1", "en");
      localStorage.setItem(
        "nordsweet.flight.v2",
        JSON.stringify({ state: { flight: f }, version: 1 }),
      );
    }
  }, flight);

  await page.goto("/fly");
  await expect(page.getByText(/^Route:/)).toHaveCount(0);
  await expect(page.getByTestId("gps-status")).toHaveCount(0);
  await expect(page.getByTestId("map-gps-status")).toHaveCount(0);
  await page.getByRole("button", { name: "Start flight" }).click();
  const instruments = page.getByTestId("flight-status-bar");
  await expect(instruments.getByTestId("flight-phase")).toHaveText("Taxi-Out");
  await expect(
    instruments.getByRole("button", { name: "Close flight", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Cruise", exact: true }),
  ).toHaveCount(0);
  await instruments
    .getByRole("button", { name: "Position source", exact: true })
    .click();
  const connection = page.getByRole("dialog", {
    name: "Position source",
    exact: true,
  });
  await expect(
    connection.getByRole("combobox", { name: "Position source", exact: true }),
  ).toBeVisible();
  await connection.getByRole("button", { name: "Close", exact: true }).click();
  await expect(connection).toBeHidden();
  await page.screenshot({ path: "test-results/compact-flight-toolbar.png" });
  await expect(page.getByText(/^Route:/)).toHaveCount(0);
  await expect(page.getByTestId("gps-status")).toHaveCount(0);
  await expect(page.getByTestId("map-gps-status")).toHaveCount(0);

  const rail = page.getByRole("navigation", { name: "In flight", exact: true });
  await expect(rail.getByRole("button").nth(0)).toHaveText("EMER");
  await expect(rail.getByRole("button").nth(1)).toHaveText("FPL");
  await rail.getByRole("button", { name: "FPL", exact: true }).click();
  const fpl = page.getByRole("dialog", { name: "FPL", exact: true });
  await expect(fpl.getByRole("listitem")).toContainText([
    "AAAA",
    "BBBB",
    "CCCC",
  ]);
  await expect(fpl.locator("[aria-current='step']")).toContainText("BBBB");
  const fplBox = (await fpl.boundingBox())!;
  expect(fplBox.x).toBeGreaterThan(0);
  expect(fplBox.x + fplBox.width).toBeLessThanOrEqual(
    (await rail.boundingBox())!.x,
  );
  await page.screenshot({ path: "test-results/fpl.png" });
  await rail.getByRole("button", { name: "FPL", exact: true }).click();
  await expect(fpl).toHaveCount(0);

  await page.getByRole("button", { name: "Info", exact: true }).click();
  await expect(page.getByTestId("fly-next")).toHaveText("BBBB");
  await expect(page.getByTestId("fly-xte")).toHaveText(/^1\.\d L$/); // 0.02° north of the (great-circle) track

  await context.setGeolocation({ latitude: 50, longitude: 20.05, accuracy: 5 }); // abeam BBBB
  await expect(page.getByTestId("fly-next")).toHaveText("CCCC");
  await rail.getByRole("button", { name: "FPL", exact: true }).click();
  await expect(fpl.locator("[aria-current='step']")).toContainText("CCCC");
  await page.reload(); // in-flight state survives a reload
  await page.getByRole("button", { name: "Info", exact: true }).click();
  await expect(page.getByTestId("fly-next")).toHaveText("CCCC");

  await page.getByRole("combobox", { name: "Direct to…" }).click();
  await page.getByRole("option", { name: "CCCC" }).click();
  await expect(page.getByTestId("fly-xte")).toHaveText(/0\.0/);

  // OPTIONS: manual Block Time, the event log and the phase survive a reload.
  await selectFlightPhase(page, "Cruise");
  await expect(rail.getByRole("button").nth(1)).toHaveText("FPL");
  await page.getByRole("button", { name: "Options", exact: true }).click();
  await expect(
    page.getByRole("combobox", { name: "Position source", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "OFF-BLOCK" }).click();
  await expect(page.getByTestId("timer-offBlock")).not.toHaveText("--:--:--");
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Cruise", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Options", exact: true }).click();
  await expect(
    page.getByRole("list", { name: "Events" }).getByRole("listitem"),
  ).toContainText(["Off-block"]);
  await expect(page.getByRole("button", { name: "ON-BLOCK" })).toBeVisible();

  // FREDA check: completing it logs the fuel as an event.
  await page.getByRole("button", { name: "FREDA CHECK" }).click();
  const freda = page.getByRole("dialog", { name: "FREDA" });
  await freda.getByRole("button", { name: "YES" }).click();
  await freda.getByRole("button", { name: "Complete FREDA check" }).click();
  await expect(
    page.getByRole("list", { name: "Events" }).getByRole("listitem").first(),
  ).toContainText("FREDA Fuel check");

  await page.getByRole("button", { name: "Close flight" }).click();
  await expect(page.getByTestId("debrief")).toContainText(/track points?\./);
  const debrief = page.locator('.fly-popover[data-panel="none"]');
  const before = (await debrief.boundingBox())!;
  const title = page.getByRole("button", {
    name: "Move flight debrief (drag or arrow keys)",
    exact: true,
  });
  const handle = (await title.boundingBox())!;
  await page.mouse.move(handle.x + 30, handle.y + 8);
  await page.mouse.down();
  await page.mouse.move(handle.x + 110, handle.y + 88, { steps: 5 });
  await page.mouse.up();
  const after = (await debrief.boundingBox())!;
  expect(after.x).toBeGreaterThan(before.x + 30);
  expect(after.y).toBeGreaterThan(before.y + 30);
  await expect(
    page.getByRole("button", { name: "Export GPX track", exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: "test-results/debrief-drag.png" });
});

test("WX conditions are editable and survive a reload", async ({ page }) => {
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => route.abort());
  await page.addInitScript((f) => {
    if (!localStorage.getItem("nordsweet.flight.v2")) {
      localStorage.setItem("nordsweet.language.v1", "en");
      localStorage.setItem(
        "nordsweet.flight.v2",
        JSON.stringify({ state: { flight: f }, version: 1 }),
      );
    }
  }, flight);

  await page.goto("/fly");
  await page.getByRole("button", { name: "Start flight" }).click();
  await page.getByRole("button", { name: "WX", exact: true }).click();
  const wx = page.getByRole("dialog", { name: "WX" });
  await expect(wx.getByText("Weather and condition source")).toBeVisible();
  await wx.getByLabel("QNH (hPa)").fill("1005");
  await wx.getByLabel("QNH (hPa)").blur();

  await page.reload();
  await page.getByRole("button", { name: "WX", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "WX" }).getByLabel("QNH (hPa)"),
  ).toHaveValue("1005");
});
