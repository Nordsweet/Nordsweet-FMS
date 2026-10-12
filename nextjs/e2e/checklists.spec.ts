import { expect, test } from "@playwright/test";

test("works through an aircraft checklist", async ({ page }) => {
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => route.abort());
  await page.addInitScript(() => {
    if (!localStorage.getItem("nordsweet.settings.v2"))
      localStorage.setItem("nordsweet.language.v1", "en");
  });
  await page.goto("/");
  await page.getByRole("combobox", { name: "Type / registration" }).click();
  await page.getByRole("option", { name: "Tecnam P2006T" }).click();

  await page.getByRole("link", { name: "Checklists" }).click();
  await expect(
    page.getByRole("heading", { name: "Before Engine Start" }),
  ).toBeVisible();
  const progress = page.getByTestId("checklist-progress");
  await expect(progress).toHaveText(/^0 of \d+$/);

  await page.getByRole("checkbox", { name: /Parking brake/ }).check();
  await expect(progress).toHaveText(/^1 of \d+$/);

  await page.getByRole("button", { name: "SHUTDOWN" }).click();
  await expect(page.getByRole("heading", { name: "SHUTDOWN" })).toBeVisible();
  await expect(progress).toHaveText(/^0 of \d+$/); // each checklist starts fresh
});
