import { expect, test } from "@playwright/test";

test("legacy chart controls use the app palette and proportional zoom", async ({
  page,
}) => {
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => route.abort());
  await page.addInitScript(() =>
    localStorage.setItem("nordsweet.language.v1", "en"),
  );
  await page.goto("/map");
  const map = page.getByTestId("map");
  await expect(map).toHaveAttribute("data-map-ready", "true", {
    timeout: 20000,
  });
  const tools = page.locator(".legacy-map-tools");
  await expect(tools.getByText("VFR", { exact: true })).toBeVisible();
  await expect(tools.getByText("IFR", { exact: true })).toBeVisible();
  await expect(tools.getByText("Live traffic", { exact: true })).toBeVisible();
  await expect(
    tools.getByRole("button", { name: "Zoom in", exact: true }),
  ).toHaveCSS("background-color", "rgba(255, 255, 255, 0.05)");
  const initialZoom = Number(await map.getAttribute("data-zoom"));
  await tools.getByRole("button", { name: "Zoom in", exact: true }).click();
  await expect
    .poll(async () => Number(await map.getAttribute("data-zoom")))
    .toBeCloseTo(initialZoom + Math.log2(1.3));
  await tools.getByRole("button", { name: "Zoom out", exact: true }).click();
  await expect
    .poll(async () => Number(await map.getAttribute("data-zoom")))
    .toBeCloseTo(initialZoom + Math.log2(1.3 * 0.77));
  await expect(page.getByTestId("map-gps-status")).toHaveCount(0);
});

test("embedded map fills the screen and its legacy Layers panel stays inside a phone viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => route.abort());
  await page.addInitScript(() =>
    localStorage.setItem("nordsweet.language.v1", "en"),
  );
  await page.goto("/fly");
  const map = page.getByTestId("map");
  await expect(map).toHaveAttribute("data-map-ready", "true", {
    timeout: 20000,
  });
  const status = page.getByTestId("flight-status-bar");
  await expect(status).toBeVisible();
  const mapBox = (await map.boundingBox())!;
  const statusBox = (await status.boundingBox())!;
  expect(mapBox.height).toBeGreaterThan(700);
  expect(mapBox.y).toBeGreaterThanOrEqual(statusBox.y + statusBox.height);
  await page.getByRole("button", { name: "Layers", exact: true }).click();
  const panel = page.locator(".legacy-map-tools");
  await expect(panel).toBeVisible();
  const box = (await panel.boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(390);
  await expect(panel).toHaveCSS("background-color", "rgb(15, 29, 52)");
});

test("the dark map darkens the basemap and its overlays and is remembered", async ({
  page,
}) => {
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => route.abort());
  await page.addInitScript(() =>
    localStorage.setItem("nordsweet.language.v1", "en"),
  );
  await page.goto("/map");
  const map = page.getByTestId("map");
  await expect(map).toHaveAttribute("data-map-ready", "true", {
    timeout: 20000,
  });
  // Fjord is the default; the light OpenStreetMap map is a choice.
  await page.getByRole("combobox", { name: "Base map" }).click();
  await page.getByRole("option", { name: "OpenStreetMap" }).click();
  await expect(map).toHaveCSS("background-color", "rgb(250, 249, 244)");
  await expect(page.locator(".legacy-map--dark")).toHaveCount(0);
  await expect(page.getByText("© OpenStreetMap contributors")).toBeVisible();

  await page.getByRole("combobox", { name: "Base map" }).click();
  await page.getByRole("option", { name: "Dark map" }).click();
  await expect(page.locator(".legacy-map--dark")).toHaveCount(1);
  await expect(map).toHaveCSS("background-color", "rgb(8, 12, 18)");
  // The tiles stay (darkened by the shader), so the attribution stays too.
  await expect(page.getByText("© OpenStreetMap contributors")).toBeVisible();

  await page.reload();
  await expect(map).toHaveAttribute("data-map-ready", "true", {
    timeout: 20000,
  });
  await expect(page.locator(".legacy-map--dark")).toHaveCount(1);

  await page.getByRole("combobox", { name: "Base map" }).click();
  await page.getByRole("option", { name: "Black" }).click();
  await expect(page.locator(".legacy-map--dark")).toHaveCount(1);
  await expect(page.getByText("© OpenStreetMap contributors")).toHaveCount(0);
});

test("the Fjord map has its own background and credits its tile sources", async ({
  page,
}) => {
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => route.abort());
  await page.addInitScript(() =>
    localStorage.setItem("nordsweet.language.v1", "en"),
  );
  await page.goto("/map");
  const map = page.getByTestId("map");
  await expect(map).toHaveAttribute("data-map-ready", "true", {
    timeout: 20000,
  });
  await page.getByRole("combobox", { name: "Base map" }).click();
  await page.getByRole("option", { name: "Fjord" }).click();
  await expect(map).toHaveCSS("background-color", "rgb(69, 81, 110)");
  await expect(page.locator(".legacy-map--dark")).toHaveCount(1);
  await expect(page.getByText("© OpenMapTiles")).toBeVisible();
  // Tiles are blocked here: the map must stay usable, not crash.
  await expect(map).toHaveAttribute("data-map-ready", "true");
});

test("Dark Matter renders vector tiles, persists and works over 3D terrain", async ({
  page,
}) => {
  test.setTimeout(60000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (/Binding terrain_map|shader.*error|error.*layer/i.test(m.text()))
      errors.push(m.text());
  });
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => r.abort());
  await page.route("https://tiles.openfreemap.org/planet", (r) =>
    r.fulfill({
      json: {
        tiles: ["https://tiles.openfreemap.org/planet/fixture/{z}/{x}/{y}.pbf"],
      },
    }),
  );
  let tiles = 0;
  await page.route("https://tiles.openfreemap.org/planet/fixture/**", (r) => {
    tiles++;
    return r.fulfill({
      path: "e2e/fixtures/vector/poland.pbf",
      contentType: "application/x-protobuf",
    });
  });
  await page.route(
    "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/**",
    (r) =>
      r.fulfill({
        path: "e2e/fixtures/terrain-flat.png",
        contentType: "image/png",
      }),
  );
  await page.addInitScript(() =>
    localStorage.setItem("nordsweet.language.v1", "en"),
  );
  await page.goto("/map");
  const map = page.getByTestId("map");
  await expect(map).toHaveAttribute("data-map-ready", "true", {
    timeout: 20000,
  });
  await page.getByRole("combobox", { name: "Base map" }).click();
  await page.getByRole("option", { name: "Dark Matter", exact: true }).click();
  await expect(map).toHaveCSS("background-color", "rgb(12, 12, 12)");
  await expect(
    page.getByRole("link", { name: "Dark Matter", exact: true }),
  ).toHaveAttribute("href", "/dark-matter-attribution.html");
  await expect.poll(() => tiles).toBeGreaterThan(0);
  await page.waitForTimeout(3000);
  await page.screenshot({ path: "test-results/dark-matter.png" });
  await page.getByLabel("Terrain 3D", { exact: true }).check();
  await expect(page.locator("[data-terrain-3d='true']")).toBeVisible();
  await page.waitForTimeout(4000);
  await page.screenshot({ path: "test-results/dark-matter-3d.png" });
  await page.reload();
  await expect(page.getByRole("combobox", { name: "Base map" })).toContainText(
    "Dark Matter",
  );
  await expect(map).toHaveAttribute("data-map-ready", "true", {
    timeout: 20000,
  });
  expect(errors).toEqual([]);
});
