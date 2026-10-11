import fs from "node:fs";

import { type Page, expect, test } from "@playwright/test";

const epkk = fs.readFileSync("src/api/aviation/fixtures/airport.json", "utf8");

test.beforeEach(async ({ page }) => {
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => route.abort());
  await page.route("https://aviation.lab.vibecde.com/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/airports/EPKK")
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

async function pickPoint(
  page: Page,
  label: string,
  query: string,
  ident: string,
) {
  await page.getByLabel(label, { exact: true }).fill(query);
  await page.getByRole("option").filter({ hasText: ident }).first().click();
}

test("briefs weather, fills landing conditions from the METAR and uses forecast winds", async ({
  page,
}) => {
  await page.goto("/v2");
  await page.getByRole("combobox", { name: "Type / registration" }).click();
  await page.getByRole("option", { name: "Cessna R172K" }).click();
  await pickPoint(page, "Departure", "EPNT", "EPNT");
  await pickPoint(page, "Destination", "EPKK", "EPKK");

  const destination = page.getByTestId("wx-destination");
  await expect(destination).toContainText("EPKK 111130Z 27011KT");
  await expect(destination).toContainText("stale");
  await expect(page.getByTestId("wx-departure")).toContainText("none");

  const landing = page.getByTestId("perf-landing");
  await landing.getByRole("button", { name: "Fill from METAR" }).click();
  await expect(page.getByTestId("perf-landing-metar")).toContainText(
    "from METAR EPKK",
  );
  await expect(landing.getByLabel("QNH")).toHaveValue("1010");
  await expect(landing.getByLabel("Wind speed")).toHaveValue("11");

  await page.getByRole("button", { name: "Use forecast winds aloft" }).click();
  await expect(page.getByTestId("winds-aloft")).toContainText("900 hPa");
  await expect(
    page.getByRole("cell", { name: "270/25" }).first(),
  ).toBeVisible();
});
