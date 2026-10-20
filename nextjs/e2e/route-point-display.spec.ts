import fs from "node:fs";
import { expect, test } from "./test";
import { newFlight } from "../src/data/flight";

const navpoints = JSON.parse(
  fs.readFileSync("public/data/navpoints.json", "utf8"),
) as { ident: string; lat: number; lon: number }[];
const fix = navpoints.find((point) => point.ident === "XEVLU")!;
const airports = (
  JSON.parse(fs.readFileSync("public/data/airports.json", "utf8")) as {
    ident: string;
  }[]
).filter((airport) => ["EPKK", "EPNT"].includes(airport.ident));

for (const basemap of ["osm", "dark"]) {
  test(`route points replace ordinary symbols and TOC/TOD share route colour on ${basemap}`, async ({
    page,
  }) => {
    test.setTimeout(60000);
    await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => route.abort());
    await page.route("**/data/navpoints.json", (route) =>
      route.fulfill({ json: [fix] }),
    );
    await page.route("**/data/airports.json", (route) =>
      route.fulfill({ json: airports }),
    );
    await page.route("**/data/procedures.json", (route) =>
      route.fulfill({ json: [] }),
    );
    await page.addInitScript(
      ({ flight, basemap }) => {
        localStorage.setItem("nordsweet.language.v1", "en");
        if (!localStorage.getItem("nordsweet.flight.v2"))
          localStorage.setItem(
            "nordsweet.flight.v2",
            JSON.stringify({ version: 1, state: { flight } }),
          );
        localStorage.setItem(
          "nordsweet.map.v1",
          JSON.stringify({
            version: 3,
            state: { basemap, layers: { airspace: false, traffic: false } },
          }),
        );
      },
      {
        basemap,
        flight: {
          ...newFlight(),
          aircraftId: "C172S",
          departure: { ident: "EPKK", lat: 50.077778, lon: 19.784722 },
          destination: { ident: "EPNT", lat: 49.46283, lon: 20.05067 },
          waypoints: [{ ident: fix.ident, lat: fix.lat, lon: fix.lon }],
          cruiseAltitudeFt: 5000,
        },
      },
    );
    await page.goto("/map");
    const map = page.getByTestId("map");
    await expect(map).toHaveAttribute("data-map-ready", "true");
    await page.getByRole("button", { name: "Layers", exact: true }).click();
    await page.getByRole("button", { name: "Search", exact: true }).click();
    const search = page.getByRole("dialog", { name: "Search", exact: true });
    await search.getByRole("textbox").fill("XEVLU");
    await search.getByRole("button", { name: "Search", exact: true }).click();
    const details = page.getByRole("dialog", { name: "Details", exact: true });
    await expect(details).toContainText("XEVLU");
    await details.getByRole("button", { name: "Close", exact: true }).click();
    await expect
      .poll(async () => Number(await map.getAttribute("data-zoom")))
      .toBeGreaterThanOrEqual(9);
    for (const id of ["TOC", "TOD"]) {
      await expect(page.locator(`[data-profile-marker="${id}"]`)).toHaveCount(
        1,
      );
      await expect
        .poll(() =>
          page.evaluate((id) => {
            const profile = document.querySelector(
              `[data-profile-marker="${id}"] .legacy-route-label`,
            );
            const route = document.querySelector('[data-route-marker="XEVLU"]');
            return (
              !!profile &&
              !!route &&
              getComputedStyle(profile).color === getComputedStyle(route).color
            );
          }, id),
        )
        .toBe(true);
    }
    const bluePixels = async () => {
      const box = (await map.boundingBox())!;
      const lon = Number(await map.getAttribute("data-center-lon"));
      const lat = Number(await map.getAttribute("data-center-lat"));
      const world = 512 * 2 ** Number(await map.getAttribute("data-zoom"));
      const merc = (value: number) =>
        Math.log(Math.tan(Math.PI / 4 + (value * Math.PI) / 360));
      const x = box.x + box.width / 2 + ((fix.lon - lon) / 360) * world;
      const y =
        box.y +
        box.height / 2 -
        ((merc(fix.lat) - merc(lat)) / (2 * Math.PI)) * world;
      const png = await page.screenshot({
        clip: {
          x: Math.round(x - 10),
          y: Math.round(y - 20),
          width: 85,
          height: 55,
        },
      });
      return page.evaluate(async (bytes) => {
        const bitmap = await createImageBitmap(
          new Blob([new Uint8Array(bytes)], { type: "image/png" }),
        );
        const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
        const context = canvas.getContext("2d")!;
        context.drawImage(bitmap, 0, 0);
        const pixels = context.getImageData(
          0,
          0,
          bitmap.width,
          bitmap.height,
        ).data;
        bitmap.close();
        let blue = 0;
        for (let i = 0; i < pixels.length; i += 4)
          if (
            pixels[i + 2]! > pixels[i]! + 20 &&
            pixels[i + 2]! > pixels[i + 1]! + 10
          )
            blue++;
        return blue;
      }, Array.from(png));
    };
    await expect.poll(bluePixels).toBe(0);
    await page.getByRole("button", { name: "Layers", exact: true }).click();
    await page.getByRole("checkbox", { name: "Route", exact: true }).uncheck();
    await page.getByRole("button", { name: "Layers", exact: true }).click();
    await expect.poll(bluePixels).toBeGreaterThan(10);
    await page.getByRole("button", { name: "Layers", exact: true }).click();
    await page.getByRole("checkbox", { name: "Route", exact: true }).check();
    await page.getByRole("button", { name: "Layers", exact: true }).click();
    await expect.poll(bluePixels).toBe(0);
    await page.locator('[data-route-marker="XEVLU"]').click();
    await expect(details).toContainText("XEVLU");
    await details
      .getByRole("button", { name: "Remove from route", exact: true })
      .click();
    if (await details.isVisible())
      await details.getByRole("button", { name: "Close", exact: true }).click();
    await expect(page.locator('[data-route-marker="XEVLU"]')).toHaveCount(0);
    await expect.poll(bluePixels).toBeGreaterThan(10);
  });
}
