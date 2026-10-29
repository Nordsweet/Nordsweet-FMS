import path from "node:path";
import { expect, test, E2E_TOKEN, type Page } from "./test";

function pdf() {
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R 5 0 R] /Count 2 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 400 600] /Resources << >> /Contents 4 0 R >>",
    "<< /Length 31 >>\nstream\n0 0 1 rg 30 40 300 400 re f\n\nendstream",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 600 400] /Resources << >> /Contents 6 0 R >>",
    "<< /Length 31 >>\nstream\n1 0 0 rg 40 30 400 300 re f\n\nendstream",
  ];
  let body = "%PDF-1.7\n";
  const offsets = [0];
  for (const [i, object] of objects.entries()) {
    offsets.push(Buffer.byteLength(body));
    body += `${i + 1} 0 obj\n${object}\nendobj\n`;
  }
  const start = Buffer.byteLength(body);
  body +=
    `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n` +
    offsets
      .slice(1)
      .map((n) => `${String(n).padStart(10, "0")} 00000 n \n`)
      .join("");
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${start}\n%%EOF\n`;
  return Buffer.from(body);
}
const flight = {
  id: "charts-test",
  name: "Chart flight",
  savedAt: "2026-10-28T12:00:00.000Z",
  aircraftId: null,
  departure: { ident: "EPNT", lat: 49.462, lon: 20.052 },
  destination: { ident: "EPKK", lat: 50.078, lon: 19.784 },
  alternate: null,
  waypoints: [],
  cruiseAltitudeFt: 4000,
  cruiseTasKt: 100,
  fuel: { blockL: 60 },
  stationsKg: {},
  taxiInputs: { "departure|EPNT": { from: "HP12", to: "RW12" } },
};
const doc = (airport: string, volume: "IFR" | "VFR" | "MIL", id: string) => ({
  id: id.repeat(64),
  airport,
  title: `${airport} ${volume} AERODROME CHART`,
  category: "aerodrome",
  volume,
  source_url: "https://docs.pansa.pl/chart.pdf",
  sha256: id.repeat(64),
  bytes: 1000,
  effective_from: "2026-10-01",
  effective_until: "2026-10-29",
});
const catalog = {
  packages: [
    {
      volume: "IFR",
      source_url: "https://docs.pansa.pl/",
      downloaded_at: "2026-10-28T20:00:00Z",
      effective_from: "2026-10-01",
      effective_until: "2026-10-29",
    },
  ],
  airports: [
    {
      icao: "EPNT",
      name: "Nowy Targ",
      lat: 49.462,
      lon: 20.052,
      volume: "VFR",
      source_url: "https://docs.pansa.pl/",
    },
    {
      icao: "EPKK",
      name: "Kraków",
      lat: 50.078,
      lon: 19.784,
      volume: "IFR",
      source_url: "https://docs.pansa.pl/",
    },
    {
      icao: "EPXX",
      name: "Test military field",
      lat: 52,
      lon: 20,
      volume: "MIL",
      source_url: "https://docs.pansa.pl/",
    },
  ],
  charts: [
    doc("EPNT", "VFR", "a"),
    doc("EPKK", "IFR", "b"),
    doc("EPXX", "MIL", "c"),
  ],
};
const library = {
  revision: 1,
  ground: {
    EPNT: {
      chartOverlay: {
        chart: {
          src: "./charts/Poland/EPNT/National%20AIP/AD4.pdf",
          title: "Our EPNT taxi sheet",
        },
        intersections: [
          { id: "hold", members: ["HP12"], x: 450, y: 300 },
          { id: "runway", members: ["RW12"], x: 500, y: 400 },
        ],
        taxiwayPaths: {},
      },
    },
  },
  charts: [],
  revisions: {},
};

test("airport document actions open the exact AIP, library or NordChart inside FPL from Map and Fly", async ({
  page,
  context,
}) => {
  test.setTimeout(180000);
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => {
    const url = new URL(route.request().url());
    if (url.hostname !== "aviation.lab.vibecde.com") return route.abort();
    if (url.pathname === "/auth/me")
      return route.fulfill({ json: { username: "admin", role: "admin" } });
    if (url.pathname === "/charts/catalog")
      return route.fulfill({ json: catalog });
    if (url.pathname === "/charts/library")
      return route.fulfill({ json: library });
    if (
      url.pathname.startsWith("/charts/pdf/") ||
      url.pathname === "/airports/api/chart"
    ) {
      expect(route.request().headers().authorization).toBe(
        `Bearer ${E2E_TOKEN}`,
      );
      return route.fulfill({ body: pdf(), contentType: "application/pdf" });
    }
    return route.abort();
  });
  await page.addInitScript((f) => {
    localStorage.setItem("nordsweet.language.v1", "en");
    localStorage.setItem(
      "nordsweet.flight.v2",
      JSON.stringify({ state: { flight: f }, version: 1 }),
    );
  }, flight);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/map");

  async function airportCharts(page: Page, ident: string) {
    await expect(page.getByTestId("map")).toHaveAttribute(
      "data-map-ready",
      "true",
      { timeout: 20000 },
    );
    await page.getByRole("button", { name: "Search", exact: true }).click();
    const search = page.getByRole("dialog", { name: "Search", exact: true });
    await search.getByRole("textbox").fill(ident);
    await search.getByRole("button", { name: "Search", exact: true }).click();
    const details = page.getByRole("dialog", { name: "Details", exact: true });
    await details.getByRole("button", { name: "Charts", exact: true }).click();
    return details;
  }
  const fpl = page.getByRole("dialog", { name: "FPL", exact: true });
  const left = page.getByTestId("chart-pane-departure");
  const right = page.getByTestId("chart-pane-arrival");
  const details = await airportCharts(page, "EPXX");
  await details
    .getByRole("button", { name: "EPXX MIL AERODROME CHART", exact: true })
    .click();
  await expect(page).toHaveURL(/\/fly$/);
  await expect(
    fpl.getByRole("tab", { name: "Charts", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(left.getByLabel("Chart", { exact: true })).toHaveValue(
    "c".repeat(64),
  );
  await expect(left.getByTestId("chart-pdf")).toHaveAttribute(
    "data-ready",
    "true",
    { timeout: 20000 },
  );
  await expect(
    page.getByRole("dialog", { name: "Details", exact: true }),
  ).toHaveCount(0);

  await fpl.getByRole("button", { name: "Close", exact: true }).click();
  await page.getByRole("button", { name: "Start flight", exact: true }).click();
  await expect(page.getByTestId("flight-phase")).toBeVisible();
  await (
    await airportCharts(page, "EPKK")
  )
    .getByRole("button", { name: "EPKK IFR AERODROME CHART", exact: true })
    .click();
  await expect(right.getByLabel("Chart", { exact: true })).toHaveValue(
    "b".repeat(64),
  );
  await expect(right.getByTestId("chart-pdf")).toHaveAttribute(
    "data-ready",
    "true",
    { timeout: 20000 },
  );

  await fpl.getByRole("button", { name: "Close", exact: true }).click();
  await (
    await airportCharts(page, "EPNT")
  )
    .getByRole("button", { name: "Our EPNT taxi sheet", exact: true })
    .click();
  const libraryId = "library:Poland/EPNT/National AIP/AD4.pdf";
  await expect(left.getByLabel("Chart", { exact: true })).toHaveValue(
    libraryId,
  );
  await expect(left.getByTestId("chart-pdf")).toHaveAttribute(
    "data-ready",
    "true",
    { timeout: 20000 },
  );
  // A fresh click must reselect this sheet even if the pane changed since the previous request.
  await left.getByLabel("Chart", { exact: true }).selectOption("a".repeat(64));
  await fpl.getByRole("button", { name: "Close", exact: true }).click();
  await (
    await airportCharts(page, "EPNT")
  )
    .getByRole("button", { name: "Our EPNT taxi sheet", exact: true })
    .click();
  await expect(left.getByLabel("Chart", { exact: true })).toHaveValue(
    libraryId,
  );

  await fpl.getByRole("button", { name: "Close", exact: true }).click();
  const krakow = await airportCharts(page, "EPKK");
  const nord = krakow.getByRole("button", { name: /^SID RWY/ }).first();
  const title = await nord.innerText();
  await nord.click();
  await expect(
    right.getByLabel("Chart", { exact: true }).locator("option:checked"),
  ).toHaveText(`NordChart · ${title}`);
  await expect(
    right.getByRole("img", { name: /procedure chart/ }),
  ).toBeVisible();
  expect(context.pages()).toHaveLength(1);
});

test("FPL charts render authenticated multipage AIP, retain independent panes and reopen offline", async ({
  page,
}) => {
  test.setTimeout(90000);
  let available = true,
    pdfRequests = 0;
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => {
    const url = new URL(route.request().url());
    if (url.hostname !== "aviation.lab.vibecde.com" || !available)
      return route.abort();
    if (url.pathname === "/auth/me")
      return route.fulfill({ json: { username: "admin", role: "admin" } });
    if (
      url.pathname.startsWith("/charts/") ||
      url.pathname === "/airports/api/chart"
    )
      expect(route.request().headers().authorization).toBe(
        `Bearer ${E2E_TOKEN}`,
      );
    if (url.pathname === "/charts/catalog")
      return route.fulfill({ json: catalog });
    if (url.pathname === "/charts/library")
      return route.fulfill({ json: library });
    if (url.pathname.startsWith("/charts/pdf/")) {
      pdfRequests++;
      return route.fulfill({ body: pdf(), contentType: "application/pdf" });
    }
    if (url.pathname === "/airports/api/chart")
      return route.fulfill({ body: pdf(), contentType: "application/pdf" });
    return route.abort();
  });
  await page.addInitScript((f) => {
    localStorage.setItem("nordsweet.language.v1", "en");
    if (!localStorage.getItem("nordsweet.flight.v2"))
      localStorage.setItem(
        "nordsweet.flight.v2",
        JSON.stringify({ state: { flight: f }, version: 1 }),
      );
  }, flight);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/fly");
  await page
    .getByRole("button", { name: "Start flight", exact: true })
    .click({ timeout: 20000 });
  await expect(page.getByTestId("flight-phase")).toBeVisible({
    timeout: 20000,
  });
  await page.getByRole("button", { name: "FPL", exact: true }).click();
  const fpl = page.getByRole("dialog", { name: "FPL", exact: true });
  await expect(
    fpl.getByRole("tab", { name: "FPL", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await fpl.getByRole("tab", { name: "Charts", exact: true }).click();
  const left = page.getByTestId("chart-pane-departure"),
    right = page.getByTestId("chart-pane-arrival");
  await expect(left.getByTestId("chart-pdf")).toHaveAttribute(
    "data-ready",
    "true",
    { timeout: 25000 },
  );
  await expect(right.getByTestId("chart-pdf")).toHaveAttribute(
    "data-ready",
    "true",
    { timeout: 25000 },
  );
  await expect(left.getByLabel("Chart", { exact: true })).toHaveValue(
    "a".repeat(64),
  );
  await expect(right.getByLabel("Chart", { exact: true })).toHaveValue(
    "b".repeat(64),
  );
  await left
    .getByRole("button", { name: "Next PDF page", exact: true })
    .click();
  await expect(left.getByText("Page 2 / 2", { exact: true })).toBeVisible();
  await expect(right.getByText("Page 1 / 2", { exact: true })).toBeVisible();
  await left
    .getByRole("button", { name: "Zoom chart in", exact: true })
    .click();
  await expect(left.getByText("125%", { exact: true })).toBeVisible();
  await expect(right.getByText("100%", { exact: true })).toBeVisible();
  await left
    .getByRole("button", { name: "Fit chart to pane", exact: true })
    .click();
  await expect(left.getByText("100%", { exact: true })).toBeVisible();
  const surfaceBox = await left.getByTestId("chart-surface").boundingBox();
  expect(surfaceBox!.y + surfaceBox!.height).toBeLessThanOrEqual(1000);
  await right
    .getByText("Sources, chart types and flight sequence", { exact: true })
    .click();
  await right.getByLabel("Source", { exact: true }).selectOption("nord");
  const nord = right.getByRole("img", { name: /procedure chart/ });
  await expect(nord).toBeVisible();
  expect(await nord.locator("polyline").count()).toBeGreaterThan(1);
  await right.getByLabel("Source", { exact: true }).selectOption("all");
  await right
    .getByText("Sources, chart types and flight sequence", { exact: true })
    .click();
  await expect(right.getByTestId("chart-pdf")).toHaveAttribute(
    "data-ready",
    "true",
  );
  await expect(left.getByText("Page 2 / 2", { exact: true })).toBeVisible();
  await page.screenshot({ path: "test-results/fpl-charts-desktop.png" });
  await right.focus();
  await right.press("ArrowRight");
  await right
    .getByText("Sources, chart types and flight sequence", { exact: true })
    .click();
  await expect(right.getByLabel("Chart type", { exact: true })).toHaveValue(
    "parking",
  );
  await right
    .getByText("Sources, chart types and flight sequence", { exact: true })
    .click();
  await right.focus();
  await right.press("ArrowLeft");
  await expect(right.getByTestId("chart-pdf")).toHaveAttribute(
    "data-ready",
    "true",
  );
  const before = pdfRequests;
  available = false;
  await page.reload();
  await expect(page.getByTestId("flight-phase")).toBeVisible({
    timeout: 20000,
  });
  await page.getByRole("button", { name: "FPL", exact: true }).click();
  await page.getByRole("tab", { name: "Charts", exact: true }).click();
  await expect(left.getByTestId("chart-pdf")).toHaveAttribute(
    "data-ready",
    "true",
    { timeout: 20000 },
  );
  expect(pdfRequests).toBe(before);
  await left
    .getByLabel("Departure / left pane airport", { exact: true })
    .fill("EPXX");
  await expect(left.getByLabel("Chart", { exact: true })).toHaveValue(
    "c".repeat(64),
  );
  await expect(left.getByText(/not available online/)).toBeVisible({
    timeout: 15000,
  });
  await expect(right.getByTestId("chart-pdf")).toHaveAttribute(
    "data-ready",
    "true",
  );
});

test("iPad chart library uses its own calibration and local PDF controls fit the pane", async ({
  page,
}) => {
  test.setTimeout(90000);
  const chartPath = path.join(
    process.cwd(),
    "public/charts/Poland/EPNT/National AIP/AD4.pdf",
  );
  await page.setViewportSize({ width: 820, height: 1180 });
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/charts/catalog") return route.fulfill({ json: catalog });
    if (path === "/charts/library") return route.fulfill({ json: library });
    if (path === "/airports/api/chart")
      return route.fulfill({ path: chartPath });
    if (path.startsWith("/charts/pdf/"))
      return route.fulfill({ body: pdf(), contentType: "application/pdf" });
    if (path === "/auth/me")
      return route.fulfill({ json: { username: "admin", role: "admin" } });
    return route.abort();
  });
  await page.addInitScript((f) => {
    localStorage.setItem("nordsweet.language.v1", "en");
    localStorage.setItem(
      "nordsweet.flight.v2",
      JSON.stringify({ state: { flight: f }, version: 1 }),
    );
  }, flight);
  await page.goto("/fly");
  await page
    .getByRole("button", { name: "Start flight", exact: true })
    .click({ timeout: 20000 });
  await expect(page.getByTestId("flight-phase")).toBeVisible({
    timeout: 20000,
  });
  await page.getByRole("button", { name: "FPL", exact: true }).click();
  await page.getByRole("tab", { name: "Charts", exact: true }).click();
  const left = page.getByTestId("chart-pane-departure");
  await expect(left.getByTestId("chart-pdf")).toHaveAttribute(
    "data-ready",
    "true",
    { timeout: 25000 },
  );
  await expect(
    left.getByRole("img", { name: "Calibrated taxi route" }),
  ).toHaveCount(0);
  await left
    .getByText("Sources, chart types and flight sequence", { exact: true })
    .click();
  await left.getByLabel("Source", { exact: true }).selectOption("library");
  await left
    .getByText("Sources, chart types and flight sequence", { exact: true })
    .click();
  await expect(left.getByTestId("chart-pdf")).toHaveAttribute(
    "data-ready",
    "true",
    { timeout: 25000 },
  );
  await expect(
    left.getByRole("img", { name: "Calibrated taxi route" }),
  ).toBeVisible();
  await page.screenshot({ path: "test-results/fpl-charts-real-pansa.png" });
  await left.locator('input[type="file"]').setInputFiles({
    name: "My chart.pdf",
    mimeType: "application/pdf",
    buffer: pdf(),
  });
  await expect(
    left.getByLabel("Chart", { exact: true }).locator("option:checked"),
  ).toHaveText("My chart.pdf");
  await expect(left.getByTestId("chart-pdf")).toHaveAttribute(
    "data-ready",
    "true",
    { timeout: 15000 },
  );
  await expect(
    left.getByRole("img", { name: "Calibrated taxi route" }),
  ).toHaveCount(0);
  const box = await left.boundingBox();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(820);
  await page.screenshot({ path: "test-results/fpl-charts-ipad.png" });
});
