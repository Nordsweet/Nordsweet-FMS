import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => route.abort());
  await page.addInitScript(() =>
    localStorage.setItem("nordsweet.language.v1", "en"),
  );
});

test("an aircraft entered on the Aircraft page can be chosen in the planner", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("link", { name: "Add or edit your own aircraft" })
    .click();
  await page.getByLabel("Type designation (e.g. C182)").fill("tst1");
  await page.getByLabel("ICAO type code").fill("tst1");
  await page.getByLabel("Usable fuel (L)").fill("150");
  await page.getByRole("button", { name: "Save aircraft" }).click();
  await expect(page.getByRole("status")).toContainText("TST1");

  await page.goto("/");
  await page.getByRole("combobox", { name: "Aircraft type" }).click();
  await page.getByRole("option", { name: "TST1 (TST1)" }).click();
  await expect(page.getByLabel("Registration")).toBeVisible();
});

test("a half-filled table row is reported, nothing is saved", async ({
  page,
}) => {
  await page.goto("/aircraft");
  await page.getByLabel("Type designation (e.g. C182)").fill("TST2");
  await page.getByLabel("ICAO type code").fill("TST2");
  await page.getByLabel("TAS (kt) 1").fill("100");
  await page.getByRole("button", { name: "Save aircraft" }).click();
  await expect(page.locator("p[role=alert]")).toContainText("Cruise");
  await expect(page.getByText("No aircraft of your own yet.")).toBeVisible();
});

test("a built-in aircraft can be modified and restored", async ({ page }) => {
  await page.goto("/aircraft");
  const row = page.getByText("C152 (C152)", { exact: false }).first();
  await row.locator("xpath=..").getByRole("button", { name: "Edit" }).click();
  await expect(page.getByLabel("Type designation (e.g. C182)")).toBeDisabled();
  await page.getByLabel("Default fuel (L)").fill("123");
  await page.getByRole("button", { name: "Save aircraft" }).click();
  await expect(page.getByText("modified")).toBeVisible();

  await page.goto("/");
  await page.getByRole("combobox", { name: "Aircraft type" }).click();
  await page.getByRole("option", { name: "C152 (C152)" }).click();
  await page.getByRole("tab", { name: "W&B", exact: true }).click();
  await expect(page.getByLabel("Usable fuel [L]")).toHaveValue("123");

  await page.goto("/aircraft");
  await page.getByRole("button", { name: "Restore built-in" }).click();
  await expect(page.getByText("modified")).toHaveCount(0);
});

test("built-in tables are edited as JSON and invalid JSON is rejected", async ({
  page,
}) => {
  await page.goto("/aircraft");
  const row = page.getByText("C152 (C152)", { exact: false }).first();
  await row.locator("xpath=..").getByRole("button", { name: "Edit" }).click();
  await page.getByLabel("Checklists", { exact: true }).fill("{ nope");
  await page.getByRole("button", { name: "Save aircraft" }).click();
  await expect(page.locator("p[role=alert]")).toContainText("Checklists");
  await expect(page.getByText("modified")).toHaveCount(0);

  await page.getByLabel("Checklists", { exact: true }).fill("[]");
  await page.getByRole("button", { name: "Save aircraft" }).click();
  await expect(page.getByText("modified")).toBeVisible();
  await page.getByRole("button", { name: "Restore built-in" }).click();
});

test("flap speeds grow row by row and gear-up speeds need retractable gear", async ({
  page,
}) => {
  await page.goto("/aircraft");
  await expect(page.getByLabel("Flap setting 1")).toBeVisible();
  await page.getByRole("button", { name: "Add row" }).first().click();
  await expect(page.getByLabel("Flap setting 2")).toBeVisible();

  await page.getByLabel("Type designation (e.g. C182)").fill("TST3");
  await page.getByLabel("ICAO type code").fill("TST3");
  await page.getByLabel("Pattern speed (KIAS)").fill("80");
  await page.getByLabel("Flap setting 1").fill("10");
  await page.getByLabel("Min IAS (kt) 1").fill("60");
  await page.getByLabel("Max IAS (kt) 1").fill("110");
  await expect(page.getByLabel("Gear up Min IAS (kt) 1")).toBeHidden();
  await page.getByRole("button", { name: "Retractable" }).click();
  await page.getByLabel("Gear down Min IAS (kt) 1").fill("60");
  await page.getByLabel("Gear down Max IAS (kt) 1").fill("110");
  await page.getByLabel("Gear up Min IAS (kt) 1").fill("70");
  await page.getByLabel("Gear up Max IAS (kt) 1").fill("120");
  await page.getByRole("button", { name: "Save aircraft" }).click();
  await expect(page.getByRole("status")).toContainText("TST3");
});
