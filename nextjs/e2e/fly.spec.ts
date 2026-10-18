import { expect, test } from "@playwright/test";

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
  await expect(page.getByText(/^Route:/)).toHaveCount(0);
  await expect(page.getByTestId("gps-status")).toHaveCount(0);
  await expect(page.getByTestId("map-gps-status")).toHaveCount(0);

  await page.getByRole("button", { name: "Info", exact: true }).click();
  await expect(page.getByTestId("fly-next")).toHaveText("BBBB");
  await expect(page.getByTestId("fly-xte")).toHaveText(/^1\.\d L$/); // 0.02° north of the (great-circle) track

  await context.setGeolocation({ latitude: 50, longitude: 20.05, accuracy: 5 }); // abeam BBBB
  await expect(page.getByTestId("fly-next")).toHaveText("CCCC");
  await page.reload(); // in-flight state survives a reload
  await page.getByRole("button", { name: "Info", exact: true }).click();
  await expect(page.getByTestId("fly-next")).toHaveText("CCCC");

  await page.getByRole("combobox", { name: "Direct to…" }).click();
  await page.getByRole("option", { name: "CCCC" }).click();
  await expect(page.getByTestId("fly-xte")).toHaveText(/0\.0/);

  // OPTIONS: manual Block Time, the event log and the phase survive a reload.
  await page.getByRole("button", { name: "Cruise", exact: true }).click();
  await page.getByRole("button", { name: "Options", exact: true }).click();
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
  await expect(page.getByTestId("debrief")).toContainText("track points");
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
