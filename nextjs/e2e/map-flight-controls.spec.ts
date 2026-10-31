import { expect, test } from "./test";
import { settleStorage } from "./helpers/storage";

const a = { ident: "A", lat: 49, lon: 20 };
const b = { ident: "B", lat: 50, lon: 20 };
const c = { ident: "C", lat: 51, lon: 20 };
const position = { latitude: 49.3, longitude: 20.1, accuracy: 5 };
test.use({ permissions: ["geolocation"], geolocation: position });
test.beforeEach(async ({ page }) => {
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => route.abort());
  await page.addInitScript(
    ({ a, b, c }) => {
      localStorage.setItem("nordsweet.language.v1", "en");
      if (!localStorage.getItem("nordsweet.flight.v2")) {
        localStorage.setItem(
          "nordsweet.flight.v2",
          JSON.stringify({
            version: 1,
            state: {
              flight: {
                id: "controls",
                name: "Controls",
                savedAt: "2026-10-18T10:00:00Z",
                aircraftId: null,
                departure: a,
                destination: c,
                waypoints: [b],
                alternate: null,
                cruiseAltitudeFt: 3000,
                cruiseTasKt: 100,
                fuel: { blockL: 0 },
                stationsKg: {},
              },
            },
          }),
        );
        localStorage.setItem(
          "nordsweet.inflight.v1",
          JSON.stringify({
            version: 1,
            state: {
              startedAt: "2026-10-18T10:00:00Z",
              route: [a, b, c],
              activeLeg: 0,
              phase: "cruise",
            },
          }),
        );
      }
    },
    { a, b, c },
  );
});

test("the whole waypoint disk opens Details and removing its target starts a DCT from the aircraft", async ({
  page,
}) => {
  await page.goto("/fly");
  const marker = page.locator('[data-route-marker="B"]');
  const disk = marker.locator(".legacy-route-hit-target");
  await expect(disk).toBeVisible();
  for (const offset of [0, -5, 5]) {
    await disk.click({ position: { x: 6 + offset, y: 6 } });
    const details = page.getByRole("dialog", { name: "Details", exact: true });
    await expect(details).toBeVisible();
    if (offset !== 5)
      await details.getByRole("button", { name: "Close", exact: true }).click();
  }
  await page
    .getByRole("button", { name: "Remove from route", exact: true })
    .click();
  await expect(page.locator("[data-route-marker]")).toHaveText(["DCT", "C"]);
  await settleStorage(page);
  const saved = await page.evaluate(
    () =>
      JSON.parse(localStorage.getItem("nordsweet.inflight.v1")!) as {
        state: {
          route: { ident: string; lat: number; lon: number }[];
          activeLeg: number;
        };
      },
  );
  expect(saved.state.route[0]).toMatchObject({
    ident: "DCT",
    lat: position.latitude,
    lon: position.longitude,
  });
  expect(saved.state.activeLeg).toBe(0);
  await page.reload();
  await expect(page.locator("[data-route-marker]")).toHaveText(["DCT", "C"]);
});

test("panning exposes a bottom-centered Center button that restores aircraft following", async ({
  page,
}) => {
  await page.goto("/fly");
  const center = page.getByTestId("map-recenter");
  await expect(center).toBeVisible();
  await center.click();
  await expect(center).toHaveCount(0);
  const map = page.getByTestId("map");
  const bounds = (await map.boundingBox())!;
  await page.mouse.move(
    bounds.x + bounds.width * 0.65,
    bounds.y + bounds.height * 0.45,
  );
  await page.mouse.down();
  await page.mouse.move(
    bounds.x + bounds.width * 0.65 + 100,
    bounds.y + bounds.height * 0.45 + 70,
    { steps: 10 },
  );
  await page.mouse.up();
  await expect(center).toBeVisible();
  const button = (await center.boundingBox())!;
  expect(button.x + button.width / 2).toBeCloseTo(
    page.viewportSize()!.width / 2,
    0,
  );
  await page.screenshot({ path: "test-results/center-after-pan.png" });
  await center.click();
  await expect(center).toHaveCount(0);
});
