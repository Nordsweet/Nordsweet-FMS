import { expect, test } from "./test";

test("OFM overlay is optional, persists and renders above the basemap in 2D and 3D", async ({
  page,
}) => {
  test.setTimeout(60000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (/Binding terrain_map|shader.*error|error.*layer/i.test(message.text()))
      errors.push(message.text());
  });
  await page.clock.install({ time: new Date("2026-10-22T12:00:00Z") });
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => route.abort());
  let tiles = 0;
  await page.route(
    "https://nwy-tiles-api.prod.newaydata.com/tiles/**",
    (route) => {
      expect(new URL(route.request().url()).searchParams.get("path")).toBe(
        "2610/aero/latest",
      );
      tiles++;
      return route.fulfill({
        path: "e2e/fixtures/openflightmaps.png",
        contentType: "image/png",
      });
    },
  );
  await page.route(
    "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/**",
    (route) =>
      route.fulfill({
        path: "e2e/fixtures/terrain-flat.png",
        contentType: "image/png",
      }),
  );
  await page.addInitScript(() =>
    localStorage.setItem("nordsweet.language.v1", "en"),
  );
  await page.goto("/map");
  await expect(page.getByTestId("map")).toHaveAttribute(
    "data-map-ready",
    "true",
  );
  const toggle = page.getByRole("checkbox", {
    name: "OpenFlightMaps",
    exact: true,
  });
  await expect(toggle).not.toBeChecked();
  expect(tiles).toBe(0);
  for (let i = 0; i < 4; i++)
    await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  await toggle.check();
  await expect.poll(() => tiles).toBeGreaterThan(0);
  await expect(
    page.getByRole("link", { name: /open flightmaps association/ }),
  ).toContainText("AIRAC 2610");
  await expect(
    page.getByRole("link", { name: "Report an OFM error" }),
  ).toHaveAttribute("href", /^mailto:info@openflightmaps.org/);
  await page.screenshot({ path: "test-results/openflightmaps.png" });
  await page.getByLabel("Terrain 3D", { exact: true }).check();
  await expect(page.locator("[data-terrain-3d='true']")).toBeVisible();
  await page.waitForTimeout(3000);
  await page.screenshot({ path: "test-results/openflightmaps-3d.png" });
  await page.reload();
  await expect(toggle).toBeChecked();
  await toggle.uncheck();
  await expect(
    page.getByRole("link", { name: /open flightmaps association/ }),
  ).toHaveCount(0);
  expect(errors).toEqual([]);
});
