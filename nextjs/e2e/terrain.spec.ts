import { expect, test, type Page } from "@playwright/test";
import { newFlight } from "../src/data/flight";
import { newTimers } from "../src/domain/flight-timers";

async function seed(
  page: Page,
  flightMode = false,
  hills = false,
  gnss = false,
) {
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => r.abort());
  await page.route(
    "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/**",
    (r) =>
      r.fulfill({
        path: hills
          ? "e2e/fixtures/terrain-hill.png"
          : "e2e/fixtures/terrain-flat.png",
        contentType: "image/png",
        headers: { "Access-Control-Allow-Origin": "*" },
      }),
  );
  await page.route("https://tile.openstreetmap.org/**", (r) =>
    r.fulfill({
      path: "e2e/fixtures/terrain-texture.png",
      contentType: "image/png",
      headers: { "Access-Control-Allow-Origin": "*" },
    }),
  );
  const departure = { ident: "EPKK", lat: 50.077778, lon: 19.784722 },
    destination = { ident: "EPNT", lat: 49.46283, lon: 20.05067 };
  const flight = {
      ...newFlight(),
      aircraftId: "FR172H",
      departure,
      destination,
    },
    timers = newTimers();
  timers.airTime = {
    ...timers.airTime,
    autoArmed: false,
    startedAt: flightMode ? Date.now() - 600000 : null,
    source: flightMode ? "manual" : null,
  };
  await page.addInitScript(
    ({ flight, departure, destination, timers, flightMode, gnss }) => {
      localStorage.setItem("nordsweet.language.v1", "en");
      if (!localStorage.getItem("nordsweet.flight.v2"))
        localStorage.setItem(
          "nordsweet.flight.v2",
          JSON.stringify({ version: 1, state: { flight } }),
        );
      if (flightMode && !localStorage.getItem("nordsweet.inflight.v1"))
        localStorage.setItem(
          "nordsweet.inflight.v1",
          JSON.stringify({
            version: 1,
            state: {
              startedAt: "2026-10-18T00:00:00Z",
              phase: "cruise",
              route: [departure, destination],
              activeLeg: 0,
              timers,
            },
          }),
        );
      Object.defineProperty(navigator, "geolocation", {
        configurable: true,
        value: {
          watchPosition: (callback: PositionCallback) => {
            const altitudeStart = Date.now();
            const send = () =>
              callback({
                timestamp: Date.now(),
                coords: {
                  latitude: 49.7,
                  longitude: 19.9,
                  accuracy: 5,
                  altitude: gnss
                    ? 1200 - (2.54 * (Date.now() - altitudeStart)) / 1000
                    : 900,
                  altitudeAccuracy: gnss ? 5 : null,
                  speed: (90 * 1852) / 3600,
                  heading: 180,
                },
              } as GeolocationPosition);
            send();
            return setInterval(send, gnss ? 1000 : 2000);
          },
          clearWatch: (id: number) => clearInterval(id),
        },
      });
    },
    { flight, departure, destination, timers, flightMode, gnss },
  );
}

test("TerrainLayer toggles 3D with local workers, keeps overlays and survives reload", async ({
  page,
}) => {
  test.setTimeout(60000);
  await seed(page, false, true);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (/Binding terrain_map|Error.*terrain|shader.*error/i.test(m.text()))
      errors.push(m.text());
  });
  await page.goto("/map");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  const search = page.getByRole("dialog", { name: "Search", exact: true });
  await search.getByRole("textbox").fill("EPNT");
  await search.getByRole("button", { name: "Search", exact: true }).click();
  const details = page.getByRole("dialog", { name: "Details", exact: true });
  await expect(details).toContainText("EPNT");
  await details.getByRole("button", { name: "Close", exact: true }).click();
  await page.getByLabel("Terrain 3D", { exact: true }).check();
  await expect(page.locator("[data-terrain-3d='true']")).toBeVisible();
  await expect(
    page.getByRole("link", { name: /Terrain: Mapzen/ }),
  ).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          performance
            .getEntriesByType("resource")
            .filter((r) => r.name.includes("elevation-tiles-prod")).length,
      ),
    )
    .toBeGreaterThan(0);
  await expect
    .poll(
      async () =>
        Number(
          await page.getByTestId("map").getAttribute("data-center-elevation-m"),
        ),
      { timeout: 15000 },
    )
    .toBeGreaterThan(0);
  await page.waitForTimeout(3500);
  await page.screenshot({ path: "test-results/terrain-3d.png" });
  expect(errors.filter((s) => /terrain|shader|webgl|layer/i.test(s))).toEqual(
    [],
  );
  expect(
    await page.evaluate(() =>
      performance
        .getEntriesByType("resource")
        .some((r) => /unpkg|cdn\.jsdelivr/.test(r.name)),
    ),
  ).toBe(false);
  await page.reload();
  await expect(page.getByLabel("Terrain 3D", { exact: true })).toBeChecked();
  await page.getByLabel("Terrain 3D", { exact: true }).uncheck();
  await expect(page.locator("[data-terrain-3d='false']")).toBeVisible();
});

test("Engine Out renders a terrain/wind footprint, removes stale guidance and uses cached DEM offline", async ({
  page,
}) => {
  test.setTimeout(90000);
  const at = Date.now();
  await page.clock.setFixedTime(at);
  await seed(page, true);
  await page.goto("/fly");
  await page.getByRole("button", { name: "EMER", exact: true }).click();
  const panel = page.getByRole("region", {
    name: "Emergency Checklists",
    exact: true,
  });
  await panel.getByRole("button", { name: "Engine Out", exact: true }).click();
  await panel
    .locator("summary")
    .filter({ hasText: "Record current instrument readings" })
    .click();
  await panel
    .getByLabel("Current indicated altitude (ft AMSL, QNH corrected)")
    .fill("5000");
  await panel
    .getByLabel("Current measured vertical speed (ft/min; descent negative)")
    .fill("-500");
  await panel
    .getByRole("button", {
      name: "Record current instrument readings",
      exact: true,
    })
    .click();
  await expect(panel.getByTestId("glide-status")).toHaveAttribute(
    "data-state",
    "wind",
  );
  await panel
    .getByRole("button", { name: "Use this wind (0 kt confirms calm)" })
    .click();
  await expect(panel.getByTestId("glide-status")).toHaveAttribute(
    "data-state",
    "ready",
    { timeout: 30000 },
  );
  await expect
    .poll(async () =>
      Number(
        await page
          .locator("[data-glide-cells]")
          .getAttribute("data-glide-cells"),
      ),
    )
    .toBeGreaterThan(200);
  await page.screenshot({ path: "test-results/terrain-reach.png" });
  await page.context().setOffline(true);
  await panel.getByLabel("Terrain clearance (ft)").fill("800");
  await panel
    .getByRole("button", {
      name: "Record current instrument readings",
      exact: true,
    })
    .click();
  await expect(panel.getByTestId("glide-status")).toHaveAttribute(
    "data-state",
    "ready",
    { timeout: 30000 },
  );
  await page.clock.setFixedTime(at + 21000);
  await expect(panel.getByTestId("glide-status")).toHaveAttribute(
    "data-state",
    "inputs",
  );
  await expect(page.locator("[data-glide-cells]")).toHaveAttribute(
    "data-glide-cells",
    "0",
  );
});

test("missing DEM is unavailable rather than a green flat-earth circle", async ({
  page,
}) => {
  const at = Date.now();
  await page.clock.setFixedTime(at);
  await seed(page, true);
  await page.route(
    "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/**",
    (r) => r.abort(),
  );
  await page.goto("/fly");
  await page.getByRole("button", { name: "EMER", exact: true }).click();
  const panel = page.getByRole("region", {
    name: "Emergency Checklists",
    exact: true,
  });
  await panel.getByRole("button", { name: "Engine Out", exact: true }).click();
  await panel
    .locator("summary")
    .filter({ hasText: "Record current instrument readings" })
    .click();
  await panel
    .getByLabel("Current indicated altitude (ft AMSL, QNH corrected)")
    .fill("5000");
  await panel
    .getByLabel("Current measured vertical speed (ft/min; descent negative)")
    .fill("-500");
  await panel
    .getByRole("button", {
      name: "Record current instrument readings",
      exact: true,
    })
    .click();
  await panel
    .getByRole("button", { name: "Use this wind (0 kt confirms calm)" })
    .click();
  await expect(panel.getByTestId("glide-status")).toHaveAttribute(
    "data-state",
    "missing",
    { timeout: 30000 },
  );
  await expect(page.locator("[data-glide-cells]")).toHaveAttribute(
    "data-glide-cells",
    "0",
  );
});

test("DEM survives reload in IndexedDB with the elevation service unreachable", async ({
  page,
}) => {
  test.setTimeout(60000);
  const at = Date.now();
  await page.clock.setFixedTime(at);
  await seed(page, true);
  await page.goto("/fly");
  await page.getByRole("button", { name: "EMER", exact: true }).click();
  const panel = page.getByRole("region", {
    name: "Emergency Checklists",
    exact: true,
  });
  await panel.getByRole("button", { name: "Engine Out", exact: true }).click();
  async function record() {
    await panel
      .locator("summary")
      .filter({ hasText: "Record current instrument readings" })
      .click();
    await panel
      .getByLabel("Current indicated altitude (ft AMSL, QNH corrected)")
      .fill("5000");
    await panel
      .getByLabel("Current measured vertical speed (ft/min; descent negative)")
      .fill("-500");
    await panel
      .getByRole("button", {
        name: "Record current instrument readings",
        exact: true,
      })
      .click();
    await panel
      .getByRole("button", { name: "Use this wind (0 kt confirms calm)" })
      .click();
    await expect(panel.getByTestId("glide-status")).toHaveAttribute(
      "data-state",
      "ready",
      { timeout: 30000 },
    );
  }
  await record();
  let attempted = 0;
  await page.route(
    "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/**",
    (r) => {
      attempted++;
      return r.abort();
    },
  );
  await page.reload();
  await page.getByRole("button", { name: "EMER", exact: true }).click();
  await expect(panel.getByTestId("glide-status")).toHaveAttribute(
    "data-state",
    "inputs",
  );
  await record();
  expect(attempted).toBe(0);
});

test("quality-gated GNSS descent uses EGM96 AMSL automatically without manual readings", async ({
  page,
}) => {
  test.setTimeout(45000);
  await seed(page, true, false, true);
  await page.goto("/fly");
  await page.getByRole("button", { name: "EMER", exact: true }).click();
  const panel = page.getByRole("region", {
    name: "Emergency Checklists",
    exact: true,
  });
  await panel.getByRole("button", { name: "Engine Out", exact: true }).click();
  await expect(panel.getByTestId("glide-status")).toHaveAttribute(
    "data-state",
    "wind",
    { timeout: 30000 },
  );
  await panel
    .getByRole("button", { name: "Use this wind (0 kt confirms calm)" })
    .click();
  await expect(panel.getByTestId("glide-status")).toHaveAttribute(
    "data-state",
    "ready",
    { timeout: 30000 },
  );
  await expect(panel.getByTestId("glide-status")).toContainText(
    "GNSS + coarse EGM96",
  );
  await expect
    .poll(async () =>
      Number(
        await page
          .locator("[data-glide-cells]")
          .getAttribute("data-glide-cells"),
      ),
    )
    .toBeGreaterThan(100);
});
