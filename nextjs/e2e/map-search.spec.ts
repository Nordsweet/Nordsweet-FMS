import { expect, test, type Page } from "./test";
import recordedTraffic from "../src/api/aviation/fixtures/traffic.json" with { type: "json" };

test.beforeEach(async ({ page }) => {
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => route.abort());
  await page.route("https://aviation.lab.vibecde.com/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/traffic")
      return route.fulfill({
        json: {
          count: 1,
          sources: {},
          aircraft: [
            {
              hex: "48abcd",
              callsign: "RYR6AJ",
              registration: "SP-GUN",
              type: "B738",
              lat: 50.2,
              lon: 20.2,
              altitude_ft: 30000,
              on_ground: false,
              ground_speed_kt: 0,
              track_deg: 90,
              vertical_rate_fpm: 0,
              squawk: null,
              position_time: new Date().toISOString(),
              sources: ["adsb.lol"],
            },
          ],
        },
      });
    if (path === "/airspace")
      return route.fulfill({
        json: {
          type: "FeatureCollection",
          sources: {},
          features: [
            {
              type: "Feature",
              bbox: [20, 50, 20.4, 50.4],
              geometry: {
                type: "Polygon",
                coordinates: [
                  [
                    [20, 50],
                    [20.4, 50],
                    [20.4, 50.4],
                    [20, 50.4],
                    [20, 50],
                  ],
                ],
              },
              properties: {
                name: "TR 165",
                class: "G",
                lower: "GND",
                upper: "FL95",
                activations: [],
                active_now: null,
              },
            },
          ],
        },
      });
    if (path.endsWith("/history"))
      return route.fulfill({ json: { hex: "48abcd", history: [] } });
    return route.fulfill({ json: { places: [], sources: {} } });
  });
  await page.route("https://api.adsbdb.com/v0/callsign/FR1923", (route) =>
    route.fulfill({
      json: {
        response: {
          flightroute: {
            callsign: "FR1923",
            callsign_iata: "FR1923",
            callsign_icao: "RYR6AJ",
            destination: { icao_code: "EPKK", name: "Kraków" },
          },
        },
      },
    }),
  );
  await page.addInitScript(() =>
    localStorage.setItem("nordsweet.language.v1", "en"),
  );
});

async function search(page: Page, text: string) {
  await page.getByRole("button", { name: "Search", exact: true }).click();
  const panel = page.getByRole("dialog", { name: "Search", exact: true });
  await panel.getByRole("textbox").fill(text);
  await panel.getByRole("button", { name: "Search", exact: true }).click();
}

async function expectDetailsAtMapCenter(page: Page) {
  await expect
    .poll(async () => {
      const map = await page.getByTestId("map").boundingBox();
      const panel = await page
        .getByRole("dialog", { name: "Details", exact: true })
        .boundingBox();
      if (!map || !panel) return Infinity;
      const centerX = map.x + map.width / 2;
      const centerY = map.y + map.height / 2;
      const horizontalGap = Math.min(
        Math.abs(panel.x - centerX),
        Math.abs(panel.x + panel.width - centerX),
      );
      const verticalGap = Math.abs(panel.y + panel.height / 2 - centerY);
      // The wide zone inspector cannot fit beside the center on this viewport;
      // clamping it inside the map necessarily overlaps its anchor.
      const overlapsAnchor =
        panel.x <= centerX && panel.x + panel.width >= centerX;
      const tooWideForOneSide = panel.width + 22 > map.width / 2;
      const outsideMap =
        panel.x < map.x + 6 || panel.x + panel.width > map.x + map.width - 6;
      if (outsideMap) return Infinity;
      return Math.max(
        tooWideForOneSide && overlapsAnchor ? 0 : horizontalGap,
        verticalGap,
      );
    })
    .toBeLessThan(22);
}

test("airport and waypoint search center and open the existing route options", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      "nordsweet.map.v1",
      JSON.stringify({
        version: 1,
        state: { layers: { airports: false, ifr: false } },
      }),
    ),
  );
  await page.goto("/map");
  await expect(page.getByTestId("map")).toHaveAttribute(
    "data-map-ready",
    "true",
  );
  await search(page, "EPKK");
  const details = page.getByRole("dialog", { name: "Details", exact: true });
  await expect(details).toContainText("EPKK");
  await expect(page.getByLabel("Airports", { exact: true })).toBeChecked();
  await expect(
    details.getByRole("button", { name: "Departure", exact: true }),
  ).toBeVisible();
  await expect
    .poll(async () =>
      Number(await page.getByTestId("map").getAttribute("data-center-lon")),
    )
    .toBeCloseTo(19.784722, 5);
  await expectDetailsAtMapCenter(page);
  const before = (await details.boundingBox())!;
  const header = (await details
    .getByText("Details", { exact: true })
    .boundingBox())!;
  await page.mouse.move(header.x + 25, header.y + header.height / 2);
  await page.mouse.down();
  await page.mouse.move(header.x - 75, header.y + header.height / 2 + 65, {
    steps: 8,
  });
  await page.mouse.up();
  await expect
    .poll(async () => (await details.boundingBox())!.x)
    .toBeCloseTo(before.x - 100, 0);
  await expect
    .poll(async () => (await details.boundingBox())!.y)
    .toBeCloseTo(before.y + 65, 0);
  await expect
    .poll(async () =>
      Number(await page.getByTestId("map").getAttribute("data-center-lon")),
    )
    .toBeCloseTo(19.784722, 5);
  await expect
    .poll(async () =>
      Number(await page.getByTestId("map").getAttribute("data-center-lat")),
    )
    .toBeCloseTo(50.077778, 5);
  await details.getByRole("button", { name: "Close", exact: true }).click();
  await search(page, "KELEL");
  await expect(details).toContainText("KELEL");
  await expect
    .poll(async () =>
      Number(await page.getByTestId("map").getAttribute("data-center-lon")),
    )
    .toBeCloseTo(20.175278, 5);
  const waypoint = (await details.boundingBox())!;
  const waypointHeader = (await details
    .getByText("Details", { exact: true })
    .boundingBox())!;
  await page.mouse.move(
    waypointHeader.x + 25,
    waypointHeader.y + waypointHeader.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    waypointHeader.x - 55,
    waypointHeader.y + waypointHeader.height / 2 + 40,
    { steps: 8 },
  );
  await page.mouse.up();
  await expect
    .poll(async () => (await details.boundingBox())!.x)
    .toBeCloseTo(waypoint.x - 80, 0);
  await expect(page.getByTestId("map")).toHaveAttribute(
    "data-selected-ident",
    "KELEL",
  );
  await details
    .getByRole("button", { name: "Add waypoint", exact: true })
    .click();
  await page
    .getByRole("dialog", { name: "Flight Plan · Add KELEL" })
    .getByRole("button", { name: "Insert here", exact: true })
    .click();
  await expect
    .poll(async () =>
      page.evaluate(() => localStorage.getItem("nordsweet.flight.v2")),
    )
    .toContain("KELEL");
});

test("spaced and compact zone names select the zone and fit its bounds", async ({
  page,
}) => {
  await page.goto("/map");
  await expect(page.getByTestId("map")).toHaveAttribute(
    "data-map-ready",
    "true",
  );
  for (const name of ["TR165", "TR 165"]) {
    await search(page, name);
    const details = page.getByRole("dialog", { name: "Details", exact: true });
    await expect(details).toContainText("TR 165");
    await expect(page.getByTestId("map")).toHaveAttribute(
      "data-selected-kind",
      "airspace",
    );
    await expect
      .poll(async () =>
        Number(await page.getByTestId("map").getAttribute("data-center-lon")),
      )
      .toBeCloseTo(20.2, 1);
    await expectDetailsAtMapCenter(page);
    await details.getByRole("button", { name: "Close", exact: true }).click();
  }
});

test("aircraft callsign, normalized registration, hex and flight number open traffic details", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      "nordsweet.map.v1",
      JSON.stringify({ version: 1, state: { layers: { traffic: false } } }),
    ),
  );
  await page.goto("/map");
  await expect(page.getByTestId("map")).toHaveAttribute(
    "data-map-ready",
    "true",
  );
  for (const name of ["SP-GUN", "SPGUN", "RYR6AJ", "48ABCD", "FR1923"]) {
    await search(page, name);
    const details = page.getByRole("dialog", { name: "Details", exact: true });
    await expect(details).toContainText("RYR6AJ");
    await expect(page.getByTestId("map")).toHaveAttribute(
      "data-selected-ident",
      "48abcd",
    );
    await expect
      .poll(async () =>
        Number(await page.getByTestId("map").getAttribute("data-center-lon")),
      )
      .toBeCloseTo(20.2, 2);
    await details.getByRole("button", { name: "Close", exact: true }).click();
  }
  await search(page, "NOTFOUNDXYZ");
  await expect(
    page.getByRole("dialog", { name: "Search", exact: true }),
  ).toContainText("No object found");
});

test("search tile is immediately below Options in the flight rail", async ({
  page,
}) => {
  // Mock an existing persisted flight; this does not start a real flight or touch a user's draft.
  await page.addInitScript(() =>
    localStorage.setItem(
      "nordsweet.inflight.v1",
      JSON.stringify({
        version: 1,
        state: {
          startedAt: new Date().toISOString(),
          route: [
            { ident: "EPKK", lat: 50.07, lon: 19.78 },
            { ident: "EPNT", lat: 49.46, lon: 20.04 },
          ],
        },
      }),
    ),
  );
  await page.goto("/fly");
  await expect(page.getByTestId("map")).toHaveAttribute(
    "data-map-ready",
    "true",
  );
  const options = page.getByRole("button", { name: "Options", exact: true });
  await expect(
    options.locator("xpath=following-sibling::button[1]"),
  ).toHaveAttribute("aria-label", "Search");
  await search(page, "EPKK");
  await expect(
    page.getByRole("dialog", { name: "Details", exact: true }),
  ).toContainText("EPKK");
});

test("SP-TDI displays the owner-confirmed C172 type from its Mode S address", async ({
  page,
}) => {
  await page.route("https://aviation.lab.vibecde.com/traffic?*", (route) =>
    route.fulfill({
      json: {
        count: 1,
        sources: {},
        aircraft: [
          {
            ...recordedTraffic.aircraft[0],
            hex: "48e9fa",
            callsign: "SPTDI",
            registration: "SP-TDI",
            type: "C152",
            lat: 50.2,
            lon: 20.2,
            ground_speed_kt: 0,
            position_time: new Date().toISOString(),
          },
        ],
      },
    }),
  );
  await page.goto("/map");
  await expect(page.getByTestId("map")).toHaveAttribute(
    "data-map-ready",
    "true",
  );
  await search(page, "SP-TDI");
  const details = page.getByRole("dialog", { name: "Details", exact: true });
  await expect(details).toContainText("C172");
  await expect(details).not.toContainText("C152");
});
