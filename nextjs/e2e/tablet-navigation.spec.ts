import { expect, test } from "./test";
import { newFlight } from "../src/data/flight";

test.use({
  viewport: { width: 1024, height: 768 },
  hasTouch: true,
  isMobile: true,
});
test("tablet planner link works; centered pinch preserves ownship anchor and one-finger pan releases it", async ({
  page,
  context,
}) => {
  test.setTimeout(60000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => r.abort());
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
          state: { gpsEnabled: true, trackUp: false },
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
      navigator.geolocation.clearWatch = (id) => window.clearInterval(id);
    },
    {
      ...newFlight(),
      departure: { ident: "A", lat: 50, lon: 20 },
      destination: { ident: "B", lat: 51, lon: 21 },
    },
  );
  await page.goto("/map");
  const map = page.getByTestId("map");
  await expect(map).toHaveAttribute("data-map-ready", "true");
  await page.getByRole("button", { name: "Layers", exact: true }).tap();
  const center = page.getByTestId("map-recenter");
  if (await center.isVisible()) await center.tap();
  await expect(center).toBeHidden();
  const ownshipPixel = async () => {
    const box = (await map.boundingBox())!;
    const lon = Number(await map.getAttribute("data-center-lon")),
      lat = Number(await map.getAttribute("data-center-lat")),
      zoom = Number(await map.getAttribute("data-zoom"));
    const world = 512 * 2 ** zoom,
      merc = (v: number) =>
        Math.log(Math.tan(Math.PI / 4 + (v * Math.PI) / 360));
    return {
      x: box.width / 2 + ((20 - lon) / 360) * world,
      y: box.height / 2 - ((merc(50) - merc(lat)) / (2 * Math.PI)) * world,
      w: box.width,
      h: box.height,
    };
  };
  await expect
    .poll(async () =>
      Math.abs((await ownshipPixel()).y - (await ownshipPixel()).h * 0.75),
    )
    .toBeLessThan(2);
  const zoom = Number(await map.getAttribute("data-zoom"));
  const box = (await map.boundingBox())!;
  const client = await context.newCDPSession(page);
  const x = box.x + box.width * 0.55,
    y = box.y + box.height * 0.45;
  await client.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [
      { id: 1, x: x - 30, y },
      { id: 2, x: x + 30, y },
    ],
  });
  for (let i = 1; i <= 8; i++) {
    await client.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [
        { id: 1, x: x - 30 - i * 5, y: y + i * 3 },
        { id: 2, x: x + 30 + i * 8, y: y + i * 3 },
      ],
    });
    await page.waitForTimeout(35);
  }
  await client.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await expect
    .poll(async () => Number(await map.getAttribute("data-zoom")))
    .toBeGreaterThan(zoom + 0.3);
  await expect(center).toBeHidden();
  const after = await ownshipPixel();
  expect(Math.abs(after.x - after.w * 0.5)).toBeLessThan(2);
  expect(Math.abs(after.y - after.h * 0.75)).toBeLessThan(2);
  await client.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ id: 1, x, y }],
  });
  await client.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [{ id: 1, x: x + 70, y: y + 40 }],
  });
  await client.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await expect(center).toBeVisible();
  const freeZoom = Number(await map.getAttribute("data-zoom"));
  await client.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [
      { id: 1, x: x - 25, y },
      { id: 2, x: x + 25, y },
    ],
  });
  for (let i = 1; i <= 6; i++) {
    await client.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [
        { id: 1, x: x - 25 - i * 4, y: y + i * 4 },
        { id: 2, x: x + 25 + i * 8, y: y + i * 4 },
      ],
    });
    await page.waitForTimeout(35);
  }
  await client.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await expect
    .poll(async () => Number(await map.getAttribute("data-zoom")))
    .toBeGreaterThan(freeZoom + 0.2);
  await expect(center).toBeVisible();
  // Transition 1 → 2 → 1 fingers without lifting, then cancel while moving.
  for (let cycle = 0; cycle < 3; cycle++) {
    await client.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ id: 1, x, y }],
    });
    await client.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ id: 1, x: x + 15, y: y + 10 }],
    });
    await client.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [
        { id: 1, x: x + 15, y: y + 10 },
        { id: 2, x: x + 65, y: y + 10 },
      ],
    });
    for (let i = 1; i <= 4; i++)
      await client.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [
          { id: 1, x: x + 15 - i * 5, y: y + 10 + i * 4 },
          { id: 2, x: x + 65 + i * 8, y: y + 10 + i * 4 },
        ],
      });
    await client.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [{ id: 1, x, y: y + 26 }],
    });
    await client.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ id: 1, x: x + 30, y: y + 40 }],
    });
    await client.send("Input.dispatchTouchEvent", {
      type: "touchCancel",
      touchPoints: [],
    });
  }
  const beforePan = Number(await map.getAttribute("data-center-lon"));
  const panScale =
    (512 * 2 ** Number(await map.getAttribute("data-zoom"))) / 360;
  await client.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ id: 1, x, y }],
  });
  for (let i = 1; i <= 5; i++)
    await client.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ id: 1, x: x + i * 15, y: y + i * 5 }],
    });
  await client.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await expect
    .poll(
      async () =>
        Math.abs(
          Number(await map.getAttribute("data-center-lon")) - beforePan,
        ) * panScale,
    )
    .toBeGreaterThan(20);
  expect(errors).toEqual([]);
  await page.getByRole("link", { name: "Flight Planner", exact: true }).tap();
  await expect(page).toHaveURL(/\/$/);
  await expect(
    page.getByRole("tab", { name: "Route", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Start a flight", exact: true }).tap();
  await page.getByRole("button", { name: "FPL", exact: true }).tap();
  await expect(
    page.getByRole("dialog", { name: "FPL", exact: true }),
  ).toContainText("B");
});
