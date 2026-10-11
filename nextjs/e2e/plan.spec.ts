import { type Page, expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  // Deterministic: no live API (VFR points degrade gracefully), English UI.
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => route.abort());
  await page.addInitScript(() => {
    if (!localStorage.getItem("nordsweet.settings.v2"))
      localStorage.setItem("nordsweet.language.v1", "en");
  });
});

async function pickPoint(
  page: Page,
  label: string,
  query: string,
  ident: string,
) {
  await page.getByLabel(label, { exact: true }).fill(query);
  await page.getByRole("option").filter({ hasText: ident }).first().click();
}

test("plans a flight end to end and keeps it across reloads", async ({
  page,
}) => {
  await page.goto("/v2");
  await page.getByRole("combobox", { name: "Type / registration" }).click();
  await page.getByRole("option", { name: "Cessna R172K" }).click();

  await pickPoint(page, "Departure", "EPNT", "EPNT");
  await pickPoint(page, "Destination", "EPKK", "EPKK");
  await pickPoint(page, "Add waypoint", "ABAKU", "ABAKU");

  await expect(page.getByRole("cell", { name: "EPNT → ABAKU" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "ABAKU → EPKK" })).toBeVisible();
  await expect(page.getByTestId("fuel-extra")).toBeVisible();
  await expect(page.getByTestId("wb-takeoff")).toContainText("kg");
  await expect(page.getByTestId("perf-takeoff-ground-roll")).toHaveText(
    /\d+ m/,
  );
  await expect(page.getByTestId("perf-landing-obstacle")).toHaveText(/\d+ m/);

  await page.getByLabel("Flight name").fill("Test flight");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page.getByRole("list", { name: "Saved flights list" }),
  ).toContainText("Test flight");

  await page.reload();
  await expect(page.getByRole("cell", { name: "EPNT → ABAKU" })).toBeVisible();
  await expect(
    page.getByRole("list", { name: "Saved flights list" }),
  ).toContainText("Test flight");
});

test("imports a legacy .nord flight", async ({ page }) => {
  await page.goto("/v2");
  await page
    .getByLabel("Import .nord")
    .setInputFiles("public/savedflights/P2006T0508261012.nord");
  const saved = page.getByRole("list", { name: "Saved flights list" });
  await expect(saved).toContainText("EPNT -> EPML");
  await saved.getByRole("button", { name: "Load" }).first().click();
  await expect(page.getByRole("cell", { name: "EPMLS → EPML" })).toBeVisible();
});
