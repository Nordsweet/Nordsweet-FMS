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
