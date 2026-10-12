import { expect, test } from "@playwright/test";

test.use({ serviceWorkers: "allow" });

test("new app works offline after the first visit", async ({
  page,
  context,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem("nordsweet.homeAirport.v1", "EPKK"),
  );
  await page.goto("/settings");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  // The worker precaches on install; wait until it controls the page.
  await page.reload();
  await expect
    .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller))
    .toBe(true);

  await context.setOffline(true);
  await page.goto("/settings");
  await expect(page.getByRole("heading", { name: "Ustawienia" })).toBeVisible();
  await expect(page.getByTestId("home-airport-name")).toContainText("EPKK");
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Plan lotu" })).toBeVisible();
});
