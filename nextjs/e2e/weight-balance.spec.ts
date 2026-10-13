import { type Page, expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
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

test("W&B sheet matches the legacy planner and shares fuel with the Fuel tab", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("combobox", { name: "Aircraft type" }).click();
  await page.getByRole("option", { name: "FR172H (C172)" }).click();
  await tab(page, "Route");
  await pickPoint(page, "Departure", "EPWA");
  await pickPoint(page, "Arrival", "EPKK");
  await pickPoint(page, "Alternate Airport", "EPKT");
  await tab(page, "W&B");
  const usable = page.getByLabel("Usable fuel [L]");
  await usable.fill("120");
  await usable.blur();
  const coPilot = page.getByLabel("Co-Pilot weight kg");
  await coPilot.fill("70");
  await coPilot.blur();

  // Recorded from the legacy planner (main 113e5a8) on the same scenario.
  await expect(page.getByTestId("wb-takeoff")).toContainText("1014.7");
  await expect(page.getByTestId("wb-takeoff")).toContainText("968.4");
  await expect(page.getByTestId("wb-landing")).toContainText("988");
  await expect(page.getByTestId("wb-landing")).toContainText("935.9");
  await expect(page.getByTestId("wb-alternate")).toContainText("973.6");
  await expect(page.getByTestId("wb-alternate")).toContainText("918.3");
  await expect(page.getByTestId("wb-status")).toHaveText(
    "Current loaded condition is outside the CG envelope.",
  );

  // Usable fuel is the Fuel tab's block fuel.
  await tab(page, "Fuel");
  await expect(page.getByLabel("Block Fuel fuel litres")).toHaveValue("120");
});
