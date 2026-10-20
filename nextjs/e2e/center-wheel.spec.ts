import { expect, test } from "./test";
import { newFlight } from "../src/data/flight";

for (const path of ["/map", "/fly"]) {
  test(`mouse wheel and touchpad zoom work after Center on ${path}`, async ({
    page,
  }) => {
    test.setTimeout(60000);
    await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => route.abort());
    await page.addInitScript(
      (flight) => {
        localStorage.setItem("nordsweet.language.v1", "en");
        localStorage.setItem(
          "nordsweet.flight.v2",
          JSON.stringify({ version: 1, state: { flight } }),
        );
        localStorage.setItem(
          "nordsweet.map.v1",
          JSON.stringify({
            version: 3,
            state: { gpsEnabled: true, following: false, trackUp: false },
          }),
        );
        navigator.geolocation.watchPosition = (success) => {
          const sample = () =>
            success({
              timestamp: Date.now(),
              coords: {
                latitude: 50,
                longitude: 20,
                altitude: 1000,
                speed: 0,
                heading: 0,
                accuracy: 5,
                altitudeAccuracy: 5,
              },
            } as GeolocationPosition);
          sample();
          return window.setInterval(sample, 1000);
        };
        navigator.geolocation.clearWatch = (id) => clearInterval(id);
      },
      {
        ...newFlight(),
        departure: { ident: "A", lat: 50, lon: 20 },
        destination: { ident: "B", lat: 51, lon: 21 },
      },
    );
    await page.goto(path);
    const map = page.getByTestId("map");
    await expect(map).toHaveAttribute("data-map-ready", "true");
    if (path === "/fly")
      await page
        .getByRole("button", { name: "Start flight", exact: true })
        .click();
    if (path === "/map")
      await page.getByRole("button", { name: "Layers", exact: true }).click();
    const center = page.getByTestId("map-recenter");
    await expect(center).toBeVisible();
    const zoom = async () => Number(await map.getAttribute("data-zoom"));
    const box = (await map.boundingBox())!;
    const pointer = {
      x: box.x + box.width * 0.28,
      y: box.y + box.height * 0.4,
    };
    await page.mouse.move(pointer.x, pointer.y);
    const freeZoom = await zoom();
    await page.mouse.wheel(0, -400);
    await expect.poll(zoom).toBeGreaterThan(freeZoom + 0.3);
    await center.click();
    await expect(center).toBeHidden();
    const centeredZoom = await zoom();
    await page.mouse.move(pointer.x, pointer.y);
    await page.mouse.wheel(0, -400);
    await expect.poll(zoom).toBeGreaterThan(centeredZoom + 0.3);
    const anchorError = async () => {
      const lon = Number(await map.getAttribute("data-center-lon"));
      const lat = Number(await map.getAttribute("data-center-lat"));
      const world = 512 * 2 ** (await zoom());
      const merc = (value: number) =>
        Math.log(Math.tan(Math.PI / 4 + (value * Math.PI) / 360));
      return Math.hypot(
        ((20 - lon) / 360) * world,
        box.height / 2 -
          ((merc(50) - merc(lat)) / (2 * Math.PI)) * world -
          box.height * 0.75,
      );
    };
    await expect.poll(anchorError).toBeLessThan(2);
    await expect(center).toBeHidden();
    // Let the smooth wheel gesture settle before reversing it.
    await page.waitForTimeout(350);
    const closeZoom = await zoom();
    await page.mouse.wheel(0, 400);
    await expect.poll(zoom).toBeLessThan(closeZoom - 0.3);
    await expect.poll(anchorError).toBeLessThan(2);
    await page.waitForTimeout(350);
    const touchpadZoom = await zoom();
    await page.keyboard.down("Control");
    await page.mouse.wheel(0, -8);
    await page.keyboard.up("Control");
    await expect.poll(zoom).toBeGreaterThan(touchpadZoom + 0.1);
    await expect(center).toBeHidden();
    await expect.poll(anchorError).toBeLessThan(2);
    await page.mouse.move(pointer.x, pointer.y);
    await page.mouse.down();
    await page.mouse.move(pointer.x + 130, pointer.y + 70, { steps: 8 });
    await page.mouse.up();
    await expect(center).toBeVisible();
    await page.waitForTimeout(350);
    const pannedZoom = await zoom();
    await page.mouse.wheel(0, -400);
    await expect.poll(zoom).toBeGreaterThan(pannedZoom + 0.3);
    await expect(center).toBeVisible();
  });
}
