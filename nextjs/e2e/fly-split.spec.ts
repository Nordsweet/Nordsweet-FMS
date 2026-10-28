import { expect, test } from "./test";

const flight = {
  id: "split-flight",
  name: "Split flight",
  savedAt: "2026-10-28T12:00:00.000Z",
  aircraftId: null,
  departure: { ident: "AAAA", lat: 50, lon: 19 },
  destination: { ident: "CCCC", lat: 50, lon: 21 },
  alternate: null,
  waypoints: [{ ident: "BBBB", lat: 50, lon: 20 }],
  cruiseAltitudeFt: 3000,
  cruiseTasKt: 100,
  fuel: { blockL: 60 },
  stationsKg: {},
};

test("splits the actual map viewport, centers ownship and swaps tools without rebuilding the map", async ({
  page,
}) => {
  test.setTimeout(60000);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.context().grantPermissions(["geolocation"]);
  await page
    .context()
    .setGeolocation({ latitude: 50.02, longitude: 19.3, accuracy: 5 });
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => route.abort());
  await page.addInitScript((f) => {
    localStorage.setItem("nordsweet.language.v1", "en");
    localStorage.setItem(
      "nordsweet.flight.v2",
      JSON.stringify({ state: { flight: f }, version: 1 }),
    );
    localStorage.setItem(
      "nordsweet.map.v1",
      JSON.stringify({ state: { gpsEnabled: true }, version: 3 }),
    );
  }, flight);
  await page.goto("/fly");
  const map = page.getByTestId("map"),
    toolbar = page.getByTestId("flight-status-bar");
  await expect(map).toHaveAttribute("data-map-ready", "true", {
    timeout: 20000,
  });
  await page.getByRole("button", { name: "Start flight", exact: true }).click();
  const altitude = await toolbar.getByTestId("status-altitude").boundingBox();
  const agl = await toolbar.getByTestId("status-agl").boundingBox();
  expect(agl!.x).toBeCloseTo(altitude!.x, 0);
  expect(agl!.y).toBeGreaterThan(altitude!.y);
  const canvas = await map.locator("canvas").elementHandle();
  await toolbar
    .getByRole("button", { name: "Split screen", exact: true })
    .click();
  const tools = page.getByTestId("fly-tool-pane"),
    mapPane = page.getByTestId("fly-map-pane");
  await expect(tools).toHaveAttribute("aria-label", "Options");
  await expect(
    tools.getByRole("heading", { name: "Options", exact: true }),
  ).toBeVisible();
  expect((await tools.boundingBox())!.width).toBeCloseTo(640, 0);
  expect((await mapPane.boundingBox())!.x).toBeCloseTo(640, 0);
  expect((await map.boundingBox())!.width).toBeCloseTo(640, 0);
  expect((await tools.boundingBox())!.height).toBeCloseTo(804, 0);
  await expect
    .poll(async () => Number(await map.getAttribute("data-center-lat")))
    .toBeCloseTo(50.02, 3);
  await expect
    .poll(async () => Number(await map.getAttribute("data-center-lon")))
    .toBeCloseTo(19.3, 3);
  const zoom = Number(await map.getAttribute("data-zoom"));
  const swap = page.getByRole("button", {
    name: "Swap map and tools",
    exact: true,
  });
  const swapBox = (await swap.boundingBox())!;
  expect(swapBox.x + swapBox.width / 2).toBeCloseTo(640, 0);
  expect(swapBox.y).toBeGreaterThanOrEqual(
    (await toolbar.boundingBox())!.height,
  );
  await page.screenshot({ path: "test-results/fly-split-desktop.png" });
  await swap.click();
  expect((await mapPane.boundingBox())!.x).toBeCloseTo(0, 0);
  expect((await tools.boundingBox())!.x).toBeCloseTo(640, 0);
  expect(await canvas.evaluate((el) => el.isConnected)).toBe(true);
  expect(Number(await map.getAttribute("data-zoom"))).toBeCloseTo(zoom);
  await expect
    .poll(async () => Number(await map.getAttribute("data-center-lat")))
    .toBeCloseTo(50.02, 3);
  await page
    .getByRole("navigation", { name: "In flight", exact: true })
    .getByRole("button", { name: "FPL", exact: true })
    .click();
  await expect(tools).toHaveAttribute("aria-label", "FPL");
  expect((await tools.boundingBox())!.width).toBeCloseTo(640, 0);
  await tools.getByRole("button", { name: "Close", exact: true }).click();
  await expect(page.getByTestId("fly-workspace")).toHaveAttribute(
    "data-split",
    "false",
  );
  expect((await map.boundingBox())!.width).toBeCloseTo(1280, 0);
  expect(await canvas.evaluate((el) => el.isConnected)).toBe(true);
  await toolbar
    .getByRole("button", { name: "Split screen", exact: true })
    .click();
  await toolbar
    .getByRole("button", { name: "Close flight", exact: true })
    .click();
  await expect(page.getByTestId("fly-workspace")).toHaveAttribute(
    "data-split",
    "false",
  );
  await expect(page.getByTestId("fly-tool-pane")).toHaveCount(0);
});

test("fits Options to iPad and narrow split panes before flight without a GPS fix", async ({
  page,
}) => {
  test.setTimeout(45000);
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => route.abort());
  await page.addInitScript(() =>
    localStorage.setItem("nordsweet.language.v1", "en"),
  );
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto("/fly");
  const toolbar = page.getByTestId("flight-status-bar"),
    map = page.getByTestId("map");
  await expect(map).toHaveAttribute("data-map-ready", "true", {
    timeout: 20000,
  });
  await toolbar
    .getByRole("button", { name: "Split screen", exact: true })
    .click();
  const tools = page.getByTestId("fly-tool-pane");
  expect((await tools.boundingBox())!.width).toBeCloseTo(512, 0);
  expect((await map.boundingBox())!.x).toBeCloseTo(512, 0);
  await expect(tools).toHaveAttribute("aria-label", "Options");
  expect(await tools.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(
    true,
  );
  await page.screenshot({ path: "test-results/fly-split-ipad.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    (await tools.getByTestId("timer-offBlock").boundingBox())!.height,
  ).toBeLessThan(35);
  expect(
    (await tools
      .getByRole("heading", { name: "Options", exact: true })
      .boundingBox())!.height,
  ).toBeLessThan(30);
  expect((await tools.boundingBox())!.width).toBeCloseTo(195, 0);
  expect((await map.boundingBox())!.x).toBeCloseTo(195, 0);
  expect(await tools.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(
    true,
  );
  await page
    .getByRole("button", { name: "Swap map and tools", exact: true })
    .click();
  expect((await tools.boundingBox())!.x).toBeCloseTo(195, 0);
  expect((await map.boundingBox())!.x).toBeCloseTo(0, 0);
  const title = await tools
    .getByRole("heading", { name: "Options", exact: true })
    .boundingBox();
  const swapBox = await page
    .getByRole("button", { name: "Swap map and tools", exact: true })
    .boundingBox();
  expect(title!.x).toBeGreaterThanOrEqual(swapBox!.x + swapBox!.width);
  await page.screenshot({ path: "test-results/fly-split-mobile.png" });
  await toolbar
    .getByRole("button", { name: "Full screen map", exact: true })
    .click();
  await expect(tools).toHaveCount(0);
  expect((await map.boundingBox())!.width).toBeCloseTo(390, 0);
});
