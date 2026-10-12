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
  await page.goto("/settings");
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  await expect(page.getByLabel("Home airport (ICAO)")).toHaveValue("EPNT");
  await expect(page.getByTestId("home-airport-name")).toHaveText(
    "Nowy Targ (EPNT)",
  );
  await page.getByLabel("Home airport (ICAO)").fill("ANTONO");
  await expect(page.getByTestId("home-airport-name")).toHaveText(
    "Antonowo (ANTONOWO)",
  );
  await page.getByLabel("Home airport (ICAO)").fill("EPXX");
  await expect(page.getByTestId("home-airport-name")).toHaveText(
    "Unknown airport",
  );

  await page.getByRole("button", { name: "PL" }).click();
  await expect(page.getByRole("heading", { name: "Ustawienia" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Ustawienia" })).toBeVisible();
});

test("legacy URLs land on the new screens", async ({ page }) => {
  await page.goto("/airspaces-map.html");
  await expect(page).toHaveURL(/\/map$/);
  await page.goto("/PFD.html");
  await expect(page).toHaveURL(/\/fly$/);
  await page.goto("/index.html");
  await expect(
    page.getByRole("heading", { name: /Przygotowanie lotu|Flight setup/ }),
  ).toBeVisible();
});
