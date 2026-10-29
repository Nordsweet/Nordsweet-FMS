import { selectFlightPhase, type Page, expect, test } from "./test";
import charts from "../public/data/charts.json" with { type: "json" };

test.beforeEach(async ({ page }) => {
  // Deterministic: no live API (VFR points degrade gracefully), English UI.
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => route.abort());
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
  await selectFlightPhase(page, phase);
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

test("plans a flight end to end and keeps it across reloads", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("combobox", { name: "Aircraft type" }).click();
  await page.getByRole("option", { name: "R172K (C172)" }).click();

  await tab(page, "Route");
  await pickPoint(page, "Departure", "EPNT", "EPNT");
  await pickPoint(page, "Arrival", "EPKK", "EPKK");
  await page.getByRole("textbox", { name: "Route", exact: true }).fill("ABAKU");
  await page
    .getByRole("spinbutton", { name: "Altitude", exact: true })
    .fill("6000");
  await expect(page.getByTestId("route-strip")).toContainText(
    "EPNT → TOC → ABAKU → TOD → EPKK",
  );

  // Economy writes the best-range altitude into every point.
  await page.getByRole("button", { name: "Economy" }).click();
  await expect(page.getByTestId("economy-points")).toContainText("ABAKU");
  const economyAltitudes = await page
    .getByTestId("economy-points")
    .locator("tbody tr")
    .evaluateAll((rows) =>
      rows
        .slice(1, -1)
        .map((row) =>
          Number(
            row
              .querySelectorAll("td")[2]
              ?.textContent?.replace(/[^0-9]/g, "") ?? 0,
          ),
        ),
    );
  const economyCruise = Math.max(...economyAltitudes);
  expect(economyCruise).toBe(12000);
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(
    page.getByRole("spinbutton", { name: "Altitude", exact: true }),
  ).toHaveValue(String(economyCruise));
  await expect(
    page.getByRole("spinbutton", { name: "Altitude at ABAKU" }),
  ).not.toHaveValue("");
  await tab(page, "Fuel");
  await expect(page.getByTestId("fuel-margin")).toBeVisible();
  await tab(page, "W&B");
  await expect(page.getByTestId("wb-status")).toContainText("CG envelope");

  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save a flight" }).click();
  await expect(page.getByRole("status")).toHaveText("Flight saved");
  expect((await download).suggestedFilename()).toMatch(/\.nord$/);
  await expect(
    page.getByRole("tab", { name: "Current flight", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await tab(page, "Saved flights");
  await page.getByLabel("Flight name").fill("Test flight");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page.getByRole("list", { name: "Saved flights list" }),
  ).toContainText("Test flight");

  await page.reload();
  await tab(page, "Route");
  await expect(
    page.getByRole("spinbutton", { name: "Altitude", exact: true }),
  ).toHaveValue(String(economyCruise));
  await expect(page.getByTestId("route-strip")).toContainText("ABAKU");
  await tab(page, "Saved flights");
  await expect(
    page.getByRole("list", { name: "Saved flights list" }),
  ).toContainText("Test flight");
  await flightPanel(page, "Take-off", "RWY");
  await expect(page.getByTestId("perf-takeoff-ground-roll")).toHaveText(
    /\d+ m/,
  );
  await expect(page.getByTestId("perf-landing-obstacle")).toHaveText(/\d+ m/);
  await page.getByRole("button", { name: "FPL", exact: true }).click();
  await expect(
    page
      .getByRole("dialog", { name: "FPL", exact: true })
      .getByRole("spinbutton", { name: "Cruise altitude (ft)" }),
  ).toHaveValue("12000");
});

test("imports a legacy .nord flight", async ({ page }) => {
  await page.goto("/");
  await tab(page, "Saved flights");
  await page
    .getByLabel("Import .nord")
    .setInputFiles("tests/fixtures/nord/P2006T0508261012.nord");
  const saved = page.getByRole("list", { name: "Saved flights list" });
  await expect(saved).toContainText("EPNT -> EPML");
  await saved.getByRole("button", { name: "Load" }).first().click();
  await tab(page, "Current flight");
  await tab(page, "Route");
  await expect(page.getByTestId("route-summary")).toContainText("EPNT -> EPML");
  await page.getByRole("textbox", { name: "Route", exact: true }).focus();
  await expect(
    page.getByRole("textbox", { name: "Route", exact: true }),
  ).toHaveValue("epnta epmlr epmls");
});

test("adds a SID, shows the taxi route and charts", async ({ page }) => {
  await page.goto("/");
  await tab(page, "Route");
  await pickPoint(page, "Departure", "EPKK", "EPKK");
  await pickPoint(page, "Arrival", "EPNT", "EPNT");

  await page.getByRole("combobox", { name: "SID" }).click();
  await page.getByRole("option", { name: /^NAVUR 5F/ }).click();
  await expect(page.getByTestId("route-strip")).toContainText(
    "EPKK THR07 → KK801",
  );

  await flightPanel(page, "Taxi-Out", "TAXI");
  await expect(page.getByTestId("taxi-departure-route")).toHaveText(
    "Stand 1 → Taxiway G → Taxiway B4 → Taxiway C → HP07",
  );
  await flightPanel(page, "Taxi-In", "TAXI");
  await expect(page.getByTestId("taxi-arrival")).toContainText("EPNT");

  await flightPanel(page, "Taxi-Out", "WX");
  await expect(page.getByTestId("wx-departure")).not.toContainText("Charts:");
  // Charts moved out of Weather and remain available through the airport action.
  await page.goto("/map");
  await expect(page.getByTestId("map")).toHaveAttribute(
    "data-map-ready",
    "true",
  );
  await page.getByRole("button", { name: "Search", exact: true }).click();
  const search = page.getByRole("dialog", { name: "Search", exact: true });
  await search.getByRole("textbox").fill("EPKK");
  await search.getByRole("button", { name: "Search", exact: true }).click();
  await page
    .getByRole("dialog", { name: "Details", exact: true })
    .getByRole("button", { name: "Charts", exact: true })
    .click();
  await expect(
    page.getByRole("button", {
      name: "EPKK · National AIP · AD2",
      exact: true,
    }),
  ).toBeVisible();
});

test("Poprad Charts lists the official AIP documents and serves the original PDFs", async ({
  page,
  request,
}) => {
  await page.goto("/map");
  await expect(page.getByTestId("map")).toHaveAttribute(
    "data-map-ready",
    "true",
  );
  await page.getByRole("button", { name: "Search", exact: true }).click();
  const search = page.getByRole("dialog", { name: "Search", exact: true });
  await search.getByRole("textbox").fill("LZTT");
  await search.getByRole("button", { name: "Search", exact: true }).click();
  const details = page.getByRole("dialog", { name: "Details", exact: true });
  await details.getByRole("button", { name: "Charts", exact: true }).click();
  const documents = details.getByRole("button").filter({ hasText: "LZTT ·" });
  await expect(documents).toHaveCount(18);
  await expect(
    details.getByRole("button", {
      name: "LZTT · RNAV STAR - RWY 27",
      exact: true,
    }),
  ).toBeVisible();
  for (const chart of charts.filter((c) => c.airport === "LZTT")) {
    const href = chart.src;
    expect(href).toMatch(/^\/charts\/Slovakia\/LZTT\/.+\.pdf$/);
    const response = await request.get(href);
    expect(response.ok()).toBe(true);
    expect((await response.body()).subarray(0, 5).toString()).toBe("%PDF-");
  }
});

test("Poprad RNAV SID and STAR can be selected and add their published fixes", async ({
  page,
}) => {
  await page.goto("/");
  await tab(page, "Route");
  await pickPoint(page, "Departure", "LZTT", "LZTT");
  await pickPoint(page, "Arrival", "EPKK", "EPKK");
  await page.getByRole("combobox", { name: "SID", exact: true }).click();
  await page.getByRole("option", { name: /^UMARY 1R/ }).click();
  await expect(page.getByTestId("route-strip")).toContainText("TT511");
  await expect(page.getByTestId("route-strip")).toContainText("TT516");
  await pickPoint(page, "Departure", "EPKK", "EPKK");
  await pickPoint(page, "Arrival", "LZTT", "LZTT");
  await page.getByRole("combobox", { name: "STAR", exact: true }).click();
  await page.getByRole("option", { name: /^UMARY 2S/ }).click();
  await expect(page.getByTestId("route-strip")).toContainText("TT631");
  await expect(page.getByTestId("route-strip")).toContainText("BREST");
});
