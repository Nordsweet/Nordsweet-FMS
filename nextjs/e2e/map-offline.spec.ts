import { expect, test } from "@playwright/test";

test.use({ serviceWorkers: "allow" });
test("map opens offline and serves previously visited OSM tiles", async ({
  page,
  context,
}) => {
  test.setTimeout(60000);
  await context.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => {
    if (new URL(route.request().url()).hostname === "tile.openstreetmap.org")
      return route.fulfill({
        contentType: "image/png",
        headers: { "access-control-allow-origin": "*" },
        body: Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a0xkAAAAASUVORK5CYII=",
          "base64",
        ),
      });
    return route.abort();
  });
  await page.goto("/map");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller)
      await new Promise<void>((resolve) =>
        navigator.serviceWorker.addEventListener(
          "controllerchange",
          () => resolve(),
          { once: true },
        ),
      );
  });
  const tile = "https://tile.openstreetmap.org/0/0/0.png";
  await page.evaluate(async (url) => {
    const response = await fetch(url);
    if (!response.ok) throw Error("Tile failed");
  }, tile);
  await expect
    .poll(() =>
      page.evaluate(
        async (url) =>
          !!(await (await caches.open("map-osm-tiles-v1")).match(url)),
        tile,
      ),
    )
    .toBe(true);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByTestId("map")).toHaveAttribute(
    "data-map-ready",
    "true",
  );
  expect(await page.evaluate(async (url) => (await fetch(url)).ok, tile)).toBe(
    true,
  );
});
