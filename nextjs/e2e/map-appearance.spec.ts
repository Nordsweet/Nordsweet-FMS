import { expect, test } from "@playwright/test";

test("legacy chart controls retain their palette and proportional zoom", async ({
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
  ).toHaveCSS("background-color", "rgb(255, 255, 255)");
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
  await expect(panel).toHaveCSS(
    "background-color",
    "rgba(247, 244, 234, 0.96)",
  );
});
