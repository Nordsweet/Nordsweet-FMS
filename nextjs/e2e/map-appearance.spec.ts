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
  await expect(page.getByTestId("map-gps-status")).toHaveText("GPS off");
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
  expect((await map.boundingBox())!.height).toBeGreaterThan(800);
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
