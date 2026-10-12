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

  await page.goto("/v2/map");
  await expect(page.locator(".maplibregl-canvas")).toBeVisible();
  await page.waitForTimeout(2000); // map style load + data
  expect(airspaceRequests).toBeGreaterThan(0);

  // Pixel of EPKK at the initial view (zoom 5.5 around 19.4E 52N; MapLibre world = 512·2^z px).
  const box = (await page.getByTestId("map").boundingBox())!;
  const world = 2 ** 5.5 * 512;
  const merc = (lat: number) =>
    Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
  await page.mouse.click(
    box.x + box.width / 2 + ((19.7855 - 19.4) / 360) * world,
    box.y +
      box.height / 2 +
      ((merc(52) - merc(50.0778)) / (2 * Math.PI)) * world,
  );
  const card = page.getByRole("dialog", { name: "Details" });
  await expect(card).toContainText("EPKK");
  await card.getByRole("button", { name: "Departure" }).click();
  await expect(page.locator(".maplibregl-marker")).toHaveText(["EPKK"]);

  await page.getByRole("link", { name: "Flight plan" }).click();
  await expect(page.getByText("EPKK", { exact: true }).first()).toBeVisible();
  expect(errors).toEqual([]);
});
