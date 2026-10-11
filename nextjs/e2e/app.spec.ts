import { expect, test } from "@playwright/test";

test("settings migrate from the legacy planner and switch language", async ({
  page,
}) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem("nordsweet.settings.v2")) {
      localStorage.setItem("nordsweet.language.v1", "en");
      localStorage.setItem("nordsweet.homeAirport.v1", "EPNT");
    }
  });
  await page.goto("/v2/settings");
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  await expect(page.getByLabel("Home airport (ICAO)")).toHaveValue("EPNT");

  await page.getByRole("button", { name: "PL" }).click();
  await expect(page.getByRole("heading", { name: "Ustawienia" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Ustawienia" })).toBeVisible();
});
