import fs from "node:fs";
import { expect, test, type Page } from "@playwright/test";

const airspace = fs.readFileSync(
  "src/api/aviation/fixtures/airspace.json",
  "utf8",
);
async function mocks(page: Page) {
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => route.abort());
  await page.route("https://aviation.lab.vibecde.com/**", (route) => {
    const pathname = new URL(route.request().url()).pathname;
    return route.fulfill({
      contentType: "application/json",
      body:
        pathname === "/airspace"
          ? airspace
          : JSON.stringify({ places: [], sources: { lotnik_cup: "ok" } }),
    });
  });
  await page.addInitScript(() =>
    localStorage.setItem("nordsweet.language.v1", "en"),
  );
}

test("GPX and imported airspace survive reload; invalid GPX keeps the route", async ({
  page,
}) => {
  await mocks(page);
  await page.goto("/map");
  await expect(page.getByText(/^Route:/)).toHaveCount(1);
  await expect(page.getByTestId("map-gps-status")).toBeVisible();
  await expect(page.locator(".maplibregl-canvas")).toBeVisible();
  await expect(page.getByTestId("map")).toHaveAttribute(
    "data-map-ready",
    "true",
  );
  await page.getByLabel("Import GPX").setInputFiles({
    name: "route.gpx",
    mimeType: "application/gpx+xml",
    buffer: Buffer.from(
      '<gpx xmlns="http://www.topografix.com/GPX/1/1"><rte><rtept lat="50" lon="19"><name>A</name></rtept><rtept lat="50.2" lon="19.2"><name>B</name></rtept></rte></gpx>',
    ),
  });
  await expect(page.locator("[data-route-marker]")).toHaveText(["A", "B"]);
  await page.getByLabel("Import OpenAir / JSON").setInputFiles({
    name: "test.txt",
    mimeType: "text/plain",
    buffer: Buffer.from(
      "AC R\nAN IMPORTED TEST\nAL GND\nAH FL095\nDP 50:00:00 N 019:00:00 E\nDP 50:30:00 N 019:00:00 E\nDP 50:00:00 N 019:30:00 E",
    ),
  });
  await expect(page.getByRole("status")).toContainText("Imported 1 items");
  await page.getByLabel("Track up", { exact: true }).check();
  await page.getByRole("combobox", { name: "Airspace plan" }).click();
  await page.getByRole("option", { name: "No AUP" }).click();
  await page.reload();
  await expect(page.locator("[data-route-marker]")).toHaveText(["A", "B"]);
  await expect(page.getByLabel("Track up", { exact: true })).toBeChecked();
  await expect(
    page.getByRole("combobox", { name: "Airspace plan" }),
  ).toHaveText("No AUP");
  await page.getByLabel("Import GPX").setInputFiles({
    name: "bad.gpx",
    mimeType: "application/gpx+xml",
    buffer: Buffer.from('<gpx><wpt lon="19"/></gpx>'),
  });
  await expect(page.getByRole("status")).toContainText("could not be imported");
  await expect(page.locator("[data-route-marker]")).toHaveText(["A", "B"]);
});

test("selected traffic anchors details at aircraft and restores server history", async ({
  page,
}) => {
  test.setTimeout(60000);
  const now = Date.now();
  await page.clock.install({ time: new Date(now) });
  await mocks(page);
  const fixture = JSON.parse(
    fs.readFileSync("src/api/aviation/fixtures/traffic.json", "utf8"),
  ) as { aircraft: { hex: string; position_time: string }[] };
  for (const aircraft of fixture.aircraft)
    aircraft.position_time = new Date().toISOString();
  await page.route("https://aviation.lab.vibecde.com/traffic?**", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(fixture),
    }),
  );
  await page.route(
    "https://aviation.lab.vibecde.com/traffic/48c2a8/history",
    (route) =>
      route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          hex: "48c2a8",
          history: [
            {
              lat: 50,
              lon: 18,
              sampledAt: now - 60000,
              callsign: "OLD",
            },
            {
              lat: 50.1,
              lon: 18.2,
              sampledAt: now - 30000,
              callsign: "RYR8GK",
            },
            { lat: 50.12, lon: 18.22, sampledAt: now - 20000, callsign: null },
            { lat: 50.14, lon: 18.24, sampledAt: now - 10000, callsign: null },
          ],
        }),
      }),
  );
  await page.goto("/map");
  await expect(page.locator(".maplibregl-canvas")).toBeVisible();
  await expect(page.getByTestId("map")).toHaveAttribute(
    "data-map-ready",
    "true",
  );
  await page.getByLabel("Airports", { exact: true }).uncheck();
  await page.waitForTimeout(2000);
  const box = (await page.getByTestId("map").boundingBox())!,
    world =
      2 ** Number(await page.getByTestId("map").getAttribute("data-zoom")) *
      512;
  const merc = (lat: number) =>
    Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
  await page.mouse.click(
    box.x +
      box.width / 2 +
      ((18.248217 -
        Number(await page.getByTestId("map").getAttribute("data-center-lon"))) /
        360) *
        world,
    box.y +
      box.height / 2 +
      ((merc(
        Number(await page.getByTestId("map").getAttribute("data-center-lat")),
      ) -
        merc(50.174142)) /
        (2 * Math.PI)) *
        world,
  );
  const card = page.getByTestId("traffic-card");
  await expect(card).toContainText("RYR8GK");
  await expect(card).not.toContainText(
    /adsb\.lol|adsb\.fi|Position|Registration|Destination/,
  );
  await expect(card).toContainText("Confirmed history");
  await expect
    .poll(async () =>
      Number(/Confirmed history: (\d+)/.exec(await card.innerText())?.[1] ?? 0),
    )
    .toBeGreaterThanOrEqual(4);
  const panel = page.getByRole("dialog", { name: "Details" });
  await panel.getByText("Details", { exact: true }).scrollIntoViewIfNeeded();
  const before = (await panel.boundingBox())!,
    handle = (await panel.getByText("Details", { exact: true }).boundingBox())!;
  const aircraftX =
    box.x +
    box.width / 2 +
    ((18.248217 -
      Number(await page.getByTestId("map").getAttribute("data-center-lon"))) /
      360) *
      world;
  expect(Math.abs(before.x - aircraftX)).toBeLessThan(270);
  const aircraftY =
    box.y +
    box.height / 2 +
    ((merc(
      Number(await page.getByTestId("map").getAttribute("data-center-lat")),
    ) -
      merc(50.174142)) /
      (2 * Math.PI)) *
      world;
  expect(Math.abs(before.y + before.height / 2 - aircraftY)).toBeLessThan(40);
  await page.mouse.move(handle.x + 20, handle.y + 10);
  await page.mouse.down();
  await page.mouse.move(handle.x - 60, handle.y - 25, { steps: 5 });
  await page.mouse.up();
  expect((await panel.boundingBox())!.x).toBeLessThan(before.x - 10);
});

test("map restrictions persist and navigation shares flight state across pages", async ({
  page,
  context,
}) => {
  test.setTimeout(60000);
  await mocks(page);
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: 50, longitude: 19, accuracy: 5 });
  await page.goto("/map");
  await page.getByLabel("Import GPX").setInputFiles({
    name: "route.gpx",
    mimeType: "application/gpx+xml",
    buffer: Buffer.from(
      '<gpx><rte><rtept lat="50" lon="19"><name>A</name></rtept><rtept lat="50" lon="20"><name>B</name></rtept><rtept lat="50" lon="21"><name>C</name></rtept></rte></gpx>',
    ),
  });
  await page.locator("[data-route-marker]").filter({ hasText: /^B$/ }).click();
  await page.getByRole("button", { name: "Restriction", exact: true }).click();
  await page.getByLabel("Speed (kt)", { exact: true }).fill("80");
  await page.getByLabel("Altitude (ft)", { exact: true }).fill("4000");
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Start navigation", exact: true }),
  ).toHaveCount(0);
  // Preparation only edits the route; navigation starts in the flight view.
  await page.getByRole("button", { name: "GPS", exact: true }).click();
  await page.goto("/fly");
  await page.getByRole("button", { name: "Start flight", exact: true }).click();
  await expect(page.getByTestId("gps-status")).toContainText("5");
  await page.getByRole("button", { name: "Info", exact: true }).click();
  await expect(page.getByTestId("fly-next")).toHaveText("B");
  await context.setGeolocation({ latitude: 50, longitude: 20.05, accuracy: 5 });
  await expect(page.getByTestId("fly-next")).toHaveText("C");
  // The flight view covers the app navigation, like the legacy flight modal.
  await page.reload();
  await page.getByRole("button", { name: "Info", exact: true }).click();
  await expect(page.getByTestId("fly-next")).toHaveText("C");
  await expect(
    page.getByRole("button", { name: "Close flight" }),
  ).toBeVisible();
  await page.goto("/map");
  await page.reload();
  await expect(
    page.getByRole("button", { name: "End navigation", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Layers", exact: true }).click();
  await page.locator("[data-route-marker]").filter({ hasText: /^B$/ }).click();
  await page.getByRole("button", { name: "Restriction", exact: true }).click();
  await expect(page.getByLabel("Speed (kt)", { exact: true })).toHaveValue(
    "80",
  );
  await expect(page.getByLabel("Altitude (ft)", { exact: true })).toHaveValue(
    "4000",
  );
});

test("GPX route edits keep inserted point order and discard stale leg details", async ({
  page,
}) => {
  test.setTimeout(60000);
  await mocks(page);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/map");
  await expect(page.getByTestId("map")).toHaveAttribute(
    "data-map-ready",
    "true",
  );
  for (const label of [
    "Airports",
    "VFR points",
    "IFR points and navaids",
    "Navaids",
    "Traffic (ADS-B)",
  ])
    await page.getByLabel(label, { exact: true }).uncheck();
  const upload = (text: string) =>
    page.getByLabel("Import GPX").setInputFiles({
      name: "edit.gpx",
      mimeType: "application/gpx+xml",
      buffer: Buffer.from(text),
    });
  await upload(
    '<gpx><rte><rtept lat="49.5" lon="18"><name>A</name></rtept><rtept lat="51.5" lon="20"><name>B</name></rtept><rtept lat="52" lon="22"><name>C</name></rtept></rte></gpx>',
  );
  await expect(page.locator("[data-route-marker]")).toHaveText(["A", "B", "C"]);
  await page.getByRole("button", { name: "Layers", exact: true }).click();
  const tap = async (latitude = 50.5, longitude = 19) => {
    const box = (await page.getByTestId("map").boundingBox())!,
      world =
        2 ** Number(await page.getByTestId("map").getAttribute("data-zoom")) *
        512;
    const merc = (lat: number) =>
      Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
    await page.mouse.click(
      box.x +
        box.width / 2 +
        ((longitude -
          Number(
            await page.getByTestId("map").getAttribute("data-center-lon"),
          )) /
          360) *
          world,
      box.y +
        box.height / 2 +
        ((merc(
          Number(await page.getByTestId("map").getAttribute("data-center-lat")),
        ) -
          merc(latitude)) /
          (2 * Math.PI)) *
          world,
    );
  };
  await tap();
  await expect(page.getByRole("dialog", { name: "Details" })).toContainText(
    "Route segment",
  );
  await page
    .getByRole("button", { name: "Create waypoint", exact: true })
    .click();
  await expect(page.locator("[data-route-marker]")).toHaveText([
    "A",
    "WPT 1",
    "B",
    "C",
  ]);
  await tap(51.75, 21);
  await expect(page.getByRole("dialog", { name: "Details" })).toBeVisible();
  await upload('<gpx><wpt lat="50" lon="19"><name>A</name></wpt></gpx>');
  await expect(page.locator("[data-route-marker]")).toHaveText(["A"]);
  await expect(page.getByRole("dialog", { name: "Details" })).toBeHidden();
  expect(errors).toEqual([]);
});
