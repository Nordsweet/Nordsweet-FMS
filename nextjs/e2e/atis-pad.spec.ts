import { expect, test } from "./test";

test.beforeEach(async ({ page }) => {
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => route.abort());
  await page.addInitScript(() => {
    if (!localStorage.getItem("nordsweet.settings.v2"))
      localStorage.setItem("nordsweet.language.v1", "en");
  });
});

test("copies a spoken ATIS by tapping tiles (legacy ATIS pad)", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("tab", { name: "Route", exact: true }).click();
  await page.getByLabel("Departure", { exact: true }).fill("EPKK");
  await page.keyboard.press("Escape");
  await page.getByLabel("Arrival", { exact: true }).fill("EPGD");
  await page.keyboard.press("Escape");
  // WX with Insert ATIS is in the flight view, as in legacy.
  await page.getByRole("link", { name: "Start a flight" }).click();
  await page.getByRole("button", { name: "WX", exact: true }).click();
  await page.getByRole("button", { name: "Insert ATIS" }).first().click();

  const pad = page.getByRole("dialog", { name: "ATIS Pad" });
  const card = (name: string) => pad.getByRole("region", { name, exact: true });
  await card("ATIS Information")
    .getByRole("button", { name: "C", exact: true })
    .click();
  const time = card("Time");
  await time.getByRole("button", { name: "10", exact: true }).first().click();
  await time.getByRole("button", { name: "30", exact: true }).click();
  const arrival = card("Arrival");
  await arrival.getByRole("button", { name: "G", exact: true }).click();
  // Arrival G suggests RWY 25 (legacy EPKK arrival flow).
  await card("Runway").getByRole("button", { name: "RWY 25" }).first().click();
  const wind = card("Wind");
  await wind.getByRole("button", { name: "200", exact: true }).click();
  await wind.getByRole("button", { name: "50", exact: true }).first().click();
  await wind.getByRole("button", { name: "8", exact: true }).first().click();
  const qnh = card("QNH");
  await qnh.getByRole("button", { name: "1000", exact: true }).click();
  await qnh.getByRole("button", { name: "10", exact: true }).click();
  await qnh.getByRole("button", { name: "3", exact: true }).click();

  await expect(pad.getByTestId("atis-tile-information")).toContainText("C");
  await expect(pad.getByTestId("atis-tile-time")).toContainText("10:30");
  await expect(pad.getByTestId("atis-tile-runway")).toContainText("RWY 25");
  await expect(pad.getByTestId("atis-tile-wind")).toContainText("250/08KT");
  await expect(pad.getByTestId("atis-tile-qnh")).toContainText("QNH 1013");
  await expect(pad.getByTestId("atis-tile-location")).toContainText("EPKK");

  // Tap a tile to mark it as copied; the pad survives a reload.
  await pad.getByTestId("atis-tile-qnh").click();
  await expect(pad.getByTestId("atis-tile-qnh")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.reload();
  await page.getByRole("button", { name: "WX", exact: true }).click();
  await page.getByRole("button", { name: "Insert ATIS" }).first().click();
  await expect(
    page
      .getByRole("dialog", { name: "ATIS Pad" })
      .getByTestId("atis-tile-wind"),
  ).toContainText("250/08KT");
});
