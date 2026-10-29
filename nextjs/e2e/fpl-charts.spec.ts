import path from "node:path";
import { createHash } from "node:crypto";
import { expect, test, E2E_TOKEN, type Page } from "./test";

function pdf(fineLine = false) {
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R 5 0 R] /Count 2 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 400 600] /Resources << >> /Contents 4 0 R >>",
    "<< /Length 31 >>\nstream\n0 0 1 rg 30 40 300 400 re f\n\nendstream",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 600 400] /Resources << >> /Contents 6 0 R >>",
    "<< /Length 31 >>\nstream\n1 0 0 rg 40 30 400 300 re f\n\nendstream",
  ];
  if (fineLine) {
    // Keep rendering busy while the pointer moves, as with a detailed real chart.
    const commands =
      "q Q\n".repeat(8000) + "0 0 0 RG 0.25 w 200 0 m 200 600 l S\n";
    objects[3] = `<< /Length ${Buffer.byteLength(commands)} >>\nstream\n${commands}endstream`;
  }
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

test.describe("chart fit to window", () => {
  test.use({
    viewport: { width: 1024, height: 900 },
    deviceScaleFactor: 2,
    hasTouch: true,
  });
  test("fills the window or split half and restores the previous panes and zoom", async ({
    page,
  }) => {
    test.setTimeout(120000);
    await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => {
      const url = new URL(route.request().url());
      if (url.hostname !== "aviation.lab.vibecde.com") return route.abort();
      if (url.pathname === "/auth/me")
        return route.fulfill({ json: { username: "admin", role: "admin" } });
      if (url.pathname === "/charts/catalog")
        return route.fulfill({ json: catalog });
      if (url.pathname === "/charts/library")
        return route.fulfill({ json: library });
      if (url.pathname.startsWith("/charts/pdf/"))
        return route.fulfill({ body: pdf(), contentType: "application/pdf" });
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
    await page.getByRole("button", { name: "FPL", exact: true }).click();
    await page.getByRole("tab", { name: "Charts", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "FPL", exact: true });
    const left = page.getByTestId("chart-pane-departure");
    const right = page.getByTestId("chart-pane-arrival");
    const sheet = left.getByTestId("chart-pdf");
    await expect(sheet).toHaveAttribute("data-ready", "true", {
      timeout: 25000,
    });
    const original = await dialog.boundingBox();
    await left
      .getByRole("button", { name: "Zoom chart in", exact: true })
      .click();
    await left
      .getByRole("button", { name: "Zoom chart in", exact: true })
      .click();
    await expect(left.getByText("156%", { exact: true })).toBeVisible();
    const initialSurface = (await left
      .getByTestId("chart-surface")
      .boundingBox())!;
    await page.mouse.move(
      initialSurface.x + initialSurface.width / 2,
      initialSurface.y + initialSurface.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(
      initialSurface.x + initialSurface.width / 2 + 60,
      initialSurface.y + initialSurface.height / 2,
      { steps: 5 },
    );
    await page.mouse.up();
    await expect(sheet).toHaveAttribute("data-ready", "true", {
      timeout: 25000,
    });
    const canvas = sheet.locator("canvas");
    const previousCanvas = await canvas.evaluate((c: HTMLCanvasElement) => ({
      image: c.toDataURL(),
      width: c.width,
      height: c.height,
    }));
    const previousHash = createHash("sha256")
      .update(previousCanvas.image)
      .digest("hex");
    await left
      .getByRole("button", { name: "Fit to window", exact: true })
      .tap();
    await expect(dialog).toHaveAttribute("data-chart-fit", "true");
    await expect(right).toBeHidden();
    await expect(page.getByTestId("flight-status-bar")).toBeHidden();
    await expect(
      dialog.getByRole("tab", { name: "FPL", exact: true }),
    ).toHaveCount(0);
    await expect(left.getByText("100%", { exact: true })).toBeVisible();
    await expect(sheet).toHaveAttribute("data-ready", "true", {
      timeout: 25000,
    });
    let box = await dialog.boundingBox();
    expect(box!.x).toBeCloseTo(0, 0);
    expect(box!.y).toBeCloseTo(0, 0);
    expect(box!.width).toBeCloseTo(1024, 0);
    expect(box!.height).toBeCloseTo(900, 0);
    expect(
      (await left.getByTestId("chart-toolbar").boundingBox())!.y,
    ).toBeLessThan(10);
    await page.screenshot({ path: "test-results/chart-fit-full.png" });
    const exit = left.getByRole("button", {
      name: "Exit fit to window",
      exact: true,
    });
    expect((await exit.boundingBox())!.y).toBeGreaterThan(820);
    await left
      .getByRole("button", { name: "Zoom chart in", exact: true })
      .click();
    await exit.tap();
    await expect(dialog).not.toHaveAttribute("data-chart-fit", "true");
    await expect(page.getByTestId("flight-status-bar")).toBeVisible();
    await expect(right).toBeVisible();
    await expect(left.getByText("156%", { exact: true })).toBeVisible();
    await expect(sheet).toHaveAttribute("data-ready", "true", {
      timeout: 25000,
    });
    await expect
      .poll(async () => canvas.evaluate((c: HTMLCanvasElement) => c.width))
      .toBe(previousCanvas.width);
    await expect(sheet).toHaveAttribute("data-ready", "true", {
      timeout: 25000,
    });
    const restoredCanvas = await canvas.evaluate((c: HTMLCanvasElement) => ({
      image: c.toDataURL(),
      width: c.width,
      height: c.height,
    }));
    expect(restoredCanvas.width).toBe(previousCanvas.width);
    expect(restoredCanvas.height).toBe(previousCanvas.height);
    expect(
      createHash("sha256").update(restoredCanvas.image).digest("hex"),
    ).toBe(previousHash);
    box = await dialog.boundingBox();
    expect(box!.x).toBeCloseTo(original!.x, 0);
    expect(box!.width).toBeCloseTo(original!.width, 0);
    await expect(left.getByLabel("Chart", { exact: true })).toHaveValue(
      "a".repeat(64),
    );

    await expect(right.getByTestId("chart-pdf")).toHaveAttribute(
      "data-ready",
      "true",
      { timeout: 25000 },
    );
    await right
      .getByRole("button", { name: "Fit to window", exact: true })
      .tap();
    await expect(left).toBeHidden();
    await right
      .getByRole("button", { name: "Exit fit to window", exact: true })
      .tap();
    await expect(left).toBeVisible();
    await expect(left.getByText("156%", { exact: true })).toBeVisible();

    await right
      .getByRole("button", {
        name: "Sources, chart types and flight sequence",
        exact: true,
      })
      .tap();
    await page
      .getByRole("dialog", {
        name: "Sources, chart types and flight sequence",
        exact: true,
      })
      .getByLabel("Source", { exact: true })
      .selectOption("nord");
    await right
      .getByRole("button", {
        name: "Sources, chart types and flight sequence",
        exact: true,
      })
      .tap();
    await expect(
      right.getByRole("img", { name: /procedure chart/ }),
    ).toBeVisible();
    await right
      .getByRole("button", { name: "Fit to window", exact: true })
      .tap();
    await expect(left).toBeHidden();
    await right
      .getByRole("button", { name: "Exit fit to window", exact: true })
      .tap();
    await expect(
      right.getByRole("img", { name: /procedure chart/ }),
    ).toBeVisible();

    await left
      .getByRole("button", { name: "Fit to window", exact: true })
      .tap();
    await left
      .getByLabel("Chart", { exact: true })
      .selectOption("library:Poland/EPNT/National AIP/AD4.pdf");
    await expect(left.getByRole("alert")).toContainText(
      "not available online",
      { timeout: 15000 },
    );
    await left
      .getByRole("button", { name: "Exit fit to window", exact: true })
      .tap();
    await expect(right).toBeVisible();
    await right
      .getByRole("button", { name: "Fit to window", exact: true })
      .tap();
    await right
      .getByLabel("Arrival / right pane airport", { exact: true })
      .fill("");
    await expect(
      right
        .locator("p")
        .filter({ hasText: "No charts match this airport and filter." }),
    ).toBeVisible();
    await right
      .getByRole("button", { name: "Exit fit to window", exact: true })
      .tap();
    await expect(left).toBeVisible();

    await page.getByTestId("flight-split-toggle").tap();
    await page.getByRole("button", { name: "FPL", exact: true }).click();
    await page.getByRole("tab", { name: "Charts", exact: true }).click();
    await expect(sheet).toHaveAttribute("data-ready", "true", {
      timeout: 25000,
    });
    const map = page.getByTestId("fly-map-pane");
    await left
      .getByRole("button", { name: "Fit to window", exact: true })
      .tap();
    await expect(dialog).toHaveAttribute("data-chart-fit", "true");
    box = await dialog.boundingBox();
    expect(box!.x).toBeCloseTo(0, 0);
    expect(box!.width).toBeCloseTo(512, 0);
    expect(box!.height).toBeCloseTo(900, 0);
    expect((await map.boundingBox())!.x).toBeCloseTo(512, 0);
    await page.screenshot({ path: "test-results/chart-fit-split-active.png" });
    await left
      .getByRole("button", { name: "Exit fit to window", exact: true })
      .tap();
    await expect(page.getByTestId("flight-status-bar")).toBeVisible();
    await page.getByTestId("flight-split-swap").tap();
    await left
      .getByRole("button", { name: "Fit to window", exact: true })
      .tap();
    box = await dialog.boundingBox();
    expect(box!.x).toBeCloseTo(512, 0);
    expect(box!.width).toBeCloseTo(512, 0);
    expect((await map.boundingBox())!.x).toBeCloseTo(0, 0);
    await left
      .getByRole("button", { name: "Exit fit to window", exact: true })
      .tap();
    await expect(page.getByTestId("flight-split-swap")).toBeVisible();
    await page.screenshot({ path: "test-results/chart-fit-split.png" });
  });
});

test.describe("native PDF resolution", () => {
  test.use({ deviceScaleFactor: 3, hasTouch: true });
  test("compact charts redraw fine vector details at actual zoom without reducing device density", async ({
    page,
  }) => {
    test.setTimeout(90000);
    await page.setViewportSize({ width: 1600, height: 1200 });
    await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => {
      const url = new URL(route.request().url());
      if (url.hostname !== "aviation.lab.vibecde.com") return route.abort();
      if (url.pathname === "/auth/me")
        return route.fulfill({ json: { username: "admin", role: "admin" } });
      if (url.pathname === "/charts/catalog")
        return route.fulfill({ json: catalog });
      if (url.pathname === "/charts/library")
        return route.fulfill({
          json: { revision: 0, ground: {}, charts: [], revisions: {} },
        });
      if (url.pathname.startsWith("/charts/pdf/"))
        return route.fulfill({
          body: pdf(true),
          contentType: "application/pdf",
        });
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
    await page.getByRole("button", { name: "FPL", exact: true }).click();
    await page.getByRole("tab", { name: "Charts", exact: true }).click();
    const pane = page.getByTestId("chart-pane-departure");
    await pane.getByRole("button", { name: "Two panes", exact: true }).click();
    const sheet = pane.getByTestId("chart-pdf");
    await expect(sheet).toHaveAttribute("data-ready", "true", {
      timeout: 25000,
    });
    const toolbar = await pane.getByTestId("chart-toolbar").boundingBox();
    expect(toolbar!.height).toBeLessThanOrEqual(40);
    const paneBox = await pane.boundingBox();
    const surface = pane.getByTestId("chart-surface");
    const surfaceBox = await surface.boundingBox();
    expect(surfaceBox!.y - paneBox!.y).toBeLessThan(56);
    await expect(page.getByLabel("Source", { exact: true })).toHaveCount(0);
    const measure = () =>
      sheet.locator("canvas").evaluate((canvas: HTMLCanvasElement) => {
        const pixels = canvas
          .getContext("2d")!
          .getImageData(0, Math.floor(canvas.height / 2), canvas.width, 1).data;
        let dark = 0;
        for (let i = 0; i < pixels.length; i += 4)
          if (
            pixels[i + 3]! > 128 &&
            pixels[i]! < 64 &&
            pixels[i + 1]! < 64 &&
            pixels[i + 2]! < 64
          )
            dark++;
        return {
          width: canvas.width,
          height: canvas.height,
          cssWidth: canvas.clientWidth,
          cssHeight: canvas.clientHeight,
          dark,
        };
      });
    await expect
      .poll(async () => {
        const current = await measure();
        return Math.abs(current.width - (surfaceBox!.width - 2 + 256) * 3);
      })
      .toBeLessThanOrEqual(1);
    const initial = await measure();
    expect(initial.width * initial.height).toBeGreaterThan(8_000_000);
    expect(Math.abs(initial.width - initial.cssWidth * 3)).toBeLessThanOrEqual(
      3,
    );
    expect(
      Math.abs(initial.height - initial.cssHeight * 3),
    ).toBeLessThanOrEqual(3);
    await surface.dispatchEvent("wheel", { deltaY: -Math.log(8) / 0.0015 });
    await expect(pane.getByText("800%", { exact: true })).toBeVisible();
    await expect
      .poll(async () => Number(await sheet.getAttribute("data-render-zoom")))
      .toBeCloseTo(8);
    await expect(sheet).toHaveAttribute("data-ready", "true");
    const enlarged = await measure();
    // The physical line is rerendered at eight times the scale; canvas size stays bounded by the visible pane.
    expect(enlarged.width).toBe(initial.width);
    expect(enlarged.height).toBe(initial.height);
    expect(enlarged.dark).toBeGreaterThan(initial.dark * 4);
    const fit = Math.min(
      (surfaceBox!.width - 18) / 400,
      (surfaceBox!.height - 18) / 600,
    );
    expect(enlarged.dark).toBeGreaterThanOrEqual(
      Math.floor(0.25 * fit * 8 * 3) - 1,
    );
    expect(enlarged.dark).toBeLessThanOrEqual(
      Math.ceil(0.25 * fit * 8 * 3) + 1,
    );
    const linePosition = () =>
      sheet.locator("canvas").evaluate((canvas: HTMLCanvasElement) => {
        const pixels = canvas
          .getContext("2d")!
          .getImageData(0, Math.floor(canvas.height / 2), canvas.width, 1).data;
        let first = -1,
          last = -1;
        for (let x = 0; x < canvas.width; x++) {
          const i = x * 4;
          if (
            pixels[i + 3]! > 128 &&
            pixels[i]! < 64 &&
            pixels[i + 1]! < 64 &&
            pixels[i + 2]! < 64
          ) {
            if (first < 0) first = x;
            last = x;
          }
        }
        if (first < 0) return null;
        const rect = canvas.getBoundingClientRect();
        return rect.left + ((first + last) / 2 / canvas.width) * rect.width;
      });
    const lineStart = await linePosition();
    expect(lineStart).not.toBeNull();
    const startX = surfaceBox!.x + surfaceBox!.width / 2;
    const startY = surfaceBox!.y + surfaceBox!.height / 2;
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    for (let dx = 20; dx <= 200; dx += 20) {
      await page.mouse.move(startX + dx, startY);
      const x = await linePosition();
      expect(x).not.toBeNull();
      expect(Math.abs(x! - (lineStart! + dx))).toBeLessThan(2);
    }
    await page.mouse.up();
    await expect(sheet).toHaveAttribute("data-ready", "true", {
      timeout: 15000,
    });
    expect(Math.abs((await linePosition())! - (lineStart! + 200))).toBeLessThan(
      2,
    );
    const touchStart = await linePosition();
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x: startX, y: startY, id: 1 }],
    });
    for (let dx = 20; dx <= 100; dx += 20) {
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x: startX + dx, y: startY, id: 1 }],
      });
      await expect
        .poll(async () => {
          const x = await linePosition();
          return x === null ? Infinity : Math.abs(x - (touchStart! + dx));
        })
        .toBeLessThan(2);
    }
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await expect(sheet).toHaveAttribute("data-ready", "true", {
      timeout: 15000,
    });
    expect(
      Math.abs((await linePosition())! - (touchStart! + 100)),
    ).toBeLessThan(2);
    const twoFingerStart = await linePosition();
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [
        { x: startX - 100, y: startY, id: 1 },
        { x: startX + 100, y: startY, id: 2 },
      ],
    });
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [
        { x: startX - 40, y: startY, id: 1 },
        { x: startX + 160, y: startY, id: 2 },
      ],
    });
    await expect
      .poll(async () =>
        Math.abs((await linePosition())! - (twoFingerStart! + 60)),
      )
      .toBeLessThan(2);
    const beforePinch = await linePosition();
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [
        { x: startX - 60, y: startY, id: 1 },
        { x: startX + 180, y: startY, id: 2 },
      ],
    });
    const expectedPinch = startX + 60 + 1.2 * (beforePinch! - startX - 60);
    await expect
      .poll(async () => Math.abs((await linePosition())! - expectedPinch))
      .toBeLessThan(2);
    // Release one finger, then continue dragging with the other.
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: startX + 180, y: startY, id: 2 }],
    });
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: startX + 210, y: startY, id: 2 }],
    });
    await expect
      .poll(async () =>
        Math.abs((await linePosition())! - (expectedPinch + 30)),
      )
      .toBeLessThan(2);
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await expect(sheet).toHaveAttribute("data-ready", "true", {
      timeout: 15000,
    });
    await surface.dispatchEvent("wheel", { deltaY: -2000 });
    await expect(pane.getByText("1000%", { exact: true })).toBeVisible();
    await expect(sheet).toHaveAttribute("data-ready", "true", {
      timeout: 15000,
    });
    const atLimit = await linePosition();
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [
        { x: startX - 100, y: startY, id: 1 },
        { x: startX + 100, y: startY, id: 2 },
      ],
    });
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [
        { x: startX - 160, y: startY, id: 1 },
        { x: startX + 40, y: startY, id: 2 },
      ],
    });
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await expect(pane.getByText("1000%", { exact: true })).toBeVisible();
    await expect(sheet).toHaveAttribute("data-ready", "true", {
      timeout: 15000,
    });
    expect(Math.abs((await linePosition())! - (atLimit! - 60))).toBeLessThan(2);
    await cdp.detach();
    await page.screenshot({ path: "test-results/chart-native-resolution.png" });
  });
});

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
    .getByRole("button", {
      name: "Sources, chart types and flight sequence",
      exact: true,
    })
    .click();
  await page
    .getByRole("dialog", {
      name: "Sources, chart types and flight sequence",
      exact: true,
    })
    .getByLabel("Source", { exact: true })
    .selectOption("nord");
  const nord = right.getByRole("img", { name: /procedure chart/ });
  await expect(nord).toBeVisible();
  expect(await nord.locator("polyline").count()).toBeGreaterThan(1);
  await page
    .getByRole("dialog", {
      name: "Sources, chart types and flight sequence",
      exact: true,
    })
    .getByLabel("Source", { exact: true })
    .selectOption("all");
  await right
    .getByRole("button", {
      name: "Sources, chart types and flight sequence",
      exact: true,
    })
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
    .getByRole("button", {
      name: "Sources, chart types and flight sequence",
      exact: true,
    })
    .click();
  await expect(
    page
      .getByRole("dialog", {
        name: "Sources, chart types and flight sequence",
        exact: true,
      })
      .getByLabel("Chart type", { exact: true }),
  ).toHaveValue("parking");
  await right
    .getByRole("button", {
      name: "Sources, chart types and flight sequence",
      exact: true,
    })
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
    .getByRole("button", {
      name: "Sources, chart types and flight sequence",
      exact: true,
    })
    .click();
  await page
    .getByRole("dialog", {
      name: "Sources, chart types and flight sequence",
      exact: true,
    })
    .getByLabel("Source", { exact: true })
    .selectOption("library");
  await left
    .getByRole("button", {
      name: "Sources, chart types and flight sequence",
      exact: true,
    })
    .click();
  await expect(left.getByTestId("chart-pdf")).toHaveAttribute(
    "data-ready",
    "true",
    { timeout: 25000 },
  );
  await expect(
    left.getByRole("img", { name: "Calibrated taxi route" }),
  ).toBeVisible();
  await left
    .getByRole("button", { name: "Fit to window", exact: true })
    .click();
  await expect(left.getByTestId("chart-pdf")).toHaveAttribute(
    "data-ready",
    "true",
    { timeout: 25000 },
  );
  await page.screenshot({ path: "test-results/chart-fit-real-pansa-ipad.png" });
  await left
    .getByRole("button", { name: "Exit fit to window", exact: true })
    .click();
  await expect(left.getByTestId("chart-pdf")).toHaveAttribute(
    "data-ready",
    "true",
    { timeout: 25000 },
  );
  const realSheet = left.getByTestId("chart-pdf");
  const initialScale = Number(
    await realSheet.getAttribute("data-render-scale"),
  );
  await left
    .getByRole("button", { name: "Zoom chart in", exact: true })
    .click();
  await expect(realSheet).toHaveAttribute("data-ready", "true", {
    timeout: 15000,
  });
  expect(
    Number(await realSheet.getAttribute("data-render-scale")),
  ).toBeGreaterThan(initialScale * 1.24);
  await left
    .getByRole("button", { name: "Fit chart to pane", exact: true })
    .click();
  await expect(realSheet).toHaveAttribute("data-ready", "true", {
    timeout: 15000,
  });
  const overlay = left.getByRole("img", { name: "Calibrated taxi route" });
  const beforeDrag = await overlay.boundingBox();
  const realSurface = await left.getByTestId("chart-surface").boundingBox();
  await page.mouse.move(
    realSurface!.x + realSurface!.width / 2,
    realSurface!.y + realSurface!.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    realSurface!.x + realSurface!.width / 2 + 75,
    realSurface!.y + realSurface!.height / 2,
    { steps: 12 },
  );
  await page.mouse.up();
  await expect
    .poll(async () => (await overlay.boundingBox())!.x - beforeDrag!.x)
    .toBeCloseTo(75, 0);
  await expect(realSheet).toHaveAttribute("data-ready", "true", {
    timeout: 15000,
  });
  expect((await overlay.boundingBox())!.x - beforeDrag!.x).toBeCloseTo(75, 0);
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
