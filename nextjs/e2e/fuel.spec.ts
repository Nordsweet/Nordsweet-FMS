import { type Page, expect, test } from "./test";

test.beforeEach(async ({ page }) => {
  // No live API: no METAR, so 15 °C / 1013 hPa, as in the legacy recording below.
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => route.abort());
  await page.addInitScript(() =>
    localStorage.setItem("nordsweet.language.v1", "en"),
  );
});

const tab = (page: Page, name: string) =>
  page.getByRole("tab", { name, exact: true }).click();

async function pickPoint(page: Page, label: string, ident: string) {
  await page.getByLabel(label, { exact: true }).fill("");
  await page.getByLabel(label, { exact: true }).fill(ident);
  await page.getByRole("option").filter({ hasText: ident }).first().click();
}

test("fuel table matches the legacy planner and takes overrides", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("combobox", { name: "Aircraft type" }).click();
  await page.getByRole("option", { name: "R172K (C172)" }).click();
  await tab(page, "Route");
  await pickPoint(page, "Departure", "EPKK");
  await pickPoint(page, "Arrival", "EPGD");
  await pickPoint(page, "Alternate Airport", "EPWA");
  await tab(page, "Fuel");
  const block = page.getByLabel("Block Fuel fuel litres");
  await block.fill("150");
  await block.blur();

  // Recorded from the legacy planner (main 113e5a8) on the same scenario.
  const cell = (label: string) => page.getByLabel(label, { exact: true });
  await expect(cell("Trip Time flight time")).toHaveValue("02:59");
  await expect(cell("Trip Time fuel litres")).toHaveValue("72");
  await expect(cell("Start, Taxiing fuel litres")).toHaveValue("4");
  await expect(cell("Climb flight time")).toHaveValue("00:05");
  await expect(cell("Climb fuel litres")).toHaveValue("6");
  await expect(
    cell("Departure, arrival (min. 10 min) fuel litres"),
  ).toHaveValue("5");
  await expect(cell("Alternate fuel flight time")).toHaveValue("01:41");
  await expect(cell("Alternate fuel fuel litres")).toHaveValue("49");
  await expect(page.getByTestId("fuel-minimum")).toHaveText("158");
  await expect(page.getByTestId("fuel-margin")).toHaveText(
    "Fuel below minimum requirement by 8 L.",
  );

  // A typed value replaces the suggestion; clearing it brings the suggestion back.
  await cell("Start, Taxiing fuel litres").fill("10");
  await cell("Start, Taxiing fuel litres").blur();
  await expect(page.getByTestId("fuel-minimum")).toHaveText("164");
  await cell("Start, Taxiing fuel litres").fill("");
  await cell("Start, Taxiing fuel litres").blur();
  await expect(page.getByTestId("fuel-minimum")).toHaveText("158");
});
