import { expect, test } from "@playwright/test";

const legacyScreens = [
  "index",
  "airport-frequencies-editor",
  "airspaces-editor",
  "airspaces-map",
  "chart-browser",
  "checklist-editor",
  "ground-editor",
  "PFD",
  "traffic",
  "waypoint-procedure-editor",
];

test.beforeEach(async ({ page }) => {
  // Keep the suite deterministic: no third-party APIs or tiles.
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => route.abort());
});

for (const screen of legacyScreens) {
  test(`legacy ${screen} boots without errors`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`/${screen}.html`);
    await expect(page.locator("html")).toHaveAttribute(
      "data-nordsweet-ready",
      screen,
      {
        timeout: 20_000,
      },
    );
    expect(errors).toEqual([]);
  });
}
