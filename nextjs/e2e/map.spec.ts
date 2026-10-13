import fs from "node:fs";

import { expect, test } from "@playwright/test";

const airspace = fs.readFileSync(
  "src/api/aviation/fixtures/airspace.json",
  "utf8",
);

test("map shows airspace and sets the departure from a tapped airport", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => route.abort()); // incl. OSM tiles
  let airspaceRequests = 0;
  await page.route("https://aviation.lab.vibecde.com/**", (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/airspace") {
      airspaceRequests++;
      return route.fulfill({ body: airspace, contentType: "application/json" });
    }
    return route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ places: [], sources: { lotnik_cup: "ok" } }),
    });
  });
  await page.addInitScript(() =>
    localStorage.setItem("nordsweet.language.v1", "en"),
  );

  await page.goto("/map");
  await expect(page.locator(".maplibregl-canvas")).toBeVisible();
  await expect(page.getByTestId("map")).toHaveAttribute(
    "data-map-ready",
    "true",
  );
  await page.waitForTimeout(2000); // map style load + data
  expect(airspaceRequests).toBeGreaterThan(0);

  // Use the rendered camera because the legacy bounds fit the viewport.
  const box = (await page.getByTestId("map").boundingBox())!;
  const world =
    2 ** Number(await page.getByTestId("map").getAttribute("data-zoom")) * 512;
  const merc = (lat: number) =>
    Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
  await page.mouse.click(
    box.x +
      box.width / 2 +
      ((19.7855 -
        Number(await page.getByTestId("map").getAttribute("data-center-lon"))) /
        360) *
        world,
    box.y +
      box.height / 2 +
      ((merc(
        Number(await page.getByTestId("map").getAttribute("data-center-lat")),
      ) -
        merc(50.0778)) /
        (2 * Math.PI)) *
        world,
  );
  const card = page.getByRole("dialog", { name: "Details" });
  await expect(card).toContainText("EPKK");
  await card.getByRole("button", { name: "Departure" }).click();
  await expect(page.locator("[data-route-marker]")).toHaveText(["EPKK"]);

  await page.getByRole("link", { name: "Flight Planner" }).click();
  await page.getByRole("tab", { name: "Route", exact: true }).click();
  await expect(page.getByLabel("Departure", { exact: true })).toHaveValue(
    "EPKK",
  );
  expect(errors).toEqual([]);
});

test("shows live traffic and its details", async ({ page }) => {
  const trafficText = fs.readFileSync(
    "src/api/aviation/fixtures/traffic.json",
    "utf8",
  );
  const currentTraffic = JSON.parse(trafficText) as {
    aircraft: { position_time: string; ground_speed_kt: number | null }[];
  };
  for (const aircraft of currentTraffic.aircraft) {
    aircraft.position_time = new Date().toISOString();
    aircraft.ground_speed_kt = 0; // This click fixture is stationary; animation is covered separately.
  }
  const traffic = JSON.stringify(currentTraffic);
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => route.abort());
  await page.route("https://aviation.lab.vibecde.com/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/traffic")
      return route.fulfill({ body: traffic, contentType: "application/json" });
    if (path === "/airspace")
      return route.fulfill({ body: airspace, contentType: "application/json" });
    return route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ places: [], sources: { lotnik_cup: "ok" } }),
    });
  });
  await page.addInitScript(() =>
    localStorage.setItem("nordsweet.language.v1", "en"),
  );
  await page.goto("/map");
  await expect(page.locator(".maplibregl-canvas")).toBeVisible();
  await expect(page.getByTestId("map")).toHaveAttribute(
    "data-map-ready",
    "true",
  );
  await page.getByLabel("Traffic (ADS-B)").check();
  await page.getByLabel("Airports").uncheck(); // keep the tap on the aircraft
  await page.waitForTimeout(2000);

  const box = (await page.getByTestId("map").boundingBox())!;
  const world =
    2 ** Number(await page.getByTestId("map").getAttribute("data-zoom")) * 512;
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
  await expect(page.getByTestId("traffic-card")).toContainText("RYR8GK");
  await expect(page.getByTestId("traffic-card")).toContainText("23550 ft");
});
