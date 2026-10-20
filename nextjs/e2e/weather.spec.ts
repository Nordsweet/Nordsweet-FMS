import fs from "node:fs";

import { type Page, expect, test } from "./test";

const epkk = fs.readFileSync("src/api/aviation/fixtures/airport.json", "utf8");

test.beforeEach(async ({ page }) => {
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => route.abort());
  await page.route("https://aviation.lab.vibecde.com/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/airports/EPKK" || path.startsWith("/airports/EPKK/"))
      return route.fulfill({ body: epkk, contentType: "application/json" });
    if (path.startsWith("/airports/"))
      return route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          icao: path.split("/")[2],
          aerodrome: null,
          metar: null,
          taf: null,
          atis: [],
          sources: { "atis.guru": "ok" },
        }),
      });
    return route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ places: [], sources: { lotnik_cup: "ok" } }),
    });
  });
  await page.route("https://api.open-meteo.com/**", (route) => {
    const count = new URL(route.request().url()).searchParams
      .get("latitude")!
      .split(",").length;
    const level = /wind_speed_(\d+)hPa/.exec(route.request().url())![1];
    const loc = {
      hourly: {
        time: ["2026-10-11T20:00"],
        [`wind_speed_${level}hPa`]: [25],
        [`wind_direction_${level}hPa`]: [270],
      },
    };
    return route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(Array.from({ length: count }, () => loc)),
    });
  });
  await page.addInitScript(() => {
    if (!localStorage.getItem("nordsweet.settings.v2"))
      localStorage.setItem("nordsweet.language.v1", "en");
  });
});

/** Weather, runway performance and taxi live in the flight view, as in legacy: start, pick the
 * phase, open the rail panel. */
async function flightPanel(page: Page, phase: string, panel: string) {
  if (!page.url().endsWith("/fly"))
    await page.getByRole("link", { name: "Start a flight" }).click();
  await page.getByRole("button", { name: phase, exact: true }).click();
  const button = page.getByRole("button", { name: panel, exact: true });
  if ((await button.getAttribute("aria-expanded")) !== "true")
    await button.click();
}

/** The planner groups sections into tabs, like the original app. */
async function tab(page: Page, name: string) {
  await page.getByRole("tab", { name, exact: true }).click();
}

async function pickPoint(
  page: Page,
  label: string,
  query: string,
  ident: string,
) {
  await page.getByLabel(label, { exact: true }).fill("");
  await page.getByLabel(label, { exact: true }).fill(query);
  await page.getByRole("option").filter({ hasText: ident }).first().click();
}

test("briefs weather and fills landing conditions from the METAR", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("combobox", { name: "Aircraft type" }).click();
  await page.getByRole("option", { name: "R172K (C172)" }).click();
  await tab(page, "Route");
  await pickPoint(page, "Departure", "EPNT", "EPNT");
  await pickPoint(page, "Arrival", "EPKK", "EPKK");

  await flightPanel(page, "Taxi-Out", "WX");
  const destination = page.getByTestId("wx-destination");
  await expect(destination).toContainText("EPKK 111130Z 27011KT");
  await expect(destination).toContainText("stale");
  await expect(page.getByTestId("wx-departure")).toContainText("none");

  await flightPanel(page, "Landing", "RWY");
  const landing = page.getByTestId("perf-landing");
  await landing.getByRole("button", { name: "Fill from METAR" }).click();
  await expect(page.getByTestId("perf-landing-metar")).toContainText(
    "from METAR EPKK",
  );
  await expect(landing.getByLabel("QNH")).toHaveValue("1010");
  await expect(landing.getByLabel("Wind speed")).toHaveValue("11");
});
