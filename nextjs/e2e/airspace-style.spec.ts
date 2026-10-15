import { expect, test } from "@playwright/test";

const zones = [
  { name: "ATZ EPNT", active_now: true, remarks: "PJE", west: 20 },
  { name: "ATZ EPKR", active_now: false, remarks: "PJE / GLD", west: 20.22 },
  { name: "CTR EPKK", active_now: false, remarks: null, west: 20.44 },
].map((zone) => ({
  type: "Feature",
  bbox: [zone.west, 50, zone.west + 0.18, 50.18],
  geometry: {
    type: "Polygon",
    coordinates: [
      [
        [zone.west, 50],
        [zone.west + 0.18, 50],
        [zone.west + 0.18, 50.18],
        [zone.west, 50.18],
        [zone.west, 50],
      ],
    ],
  },
  properties: {
    name: zone.name,
    class: "G",
    lower: "GND",
    upper: "FL55",
    active_now: zone.active_now,
    activations: [
      {
        designator: zone.name,
        country: "PL",
        lower: "GND",
        upper: "FL55",
        starts_at: "2026-10-15T12:00:00Z",
        ends_at: "2026-10-15T18:00:00Z",
        unit: null,
        remarks: zone.remarks,
        source: "pansa.uup",
      },
    ],
  },
}));

test("zone inspector keeps class colors, dims inactive fill and identifies PJE ATZ", async ({
  page,
}, testInfo) => {
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => route.abort());
  await page.route("https://aviation.lab.vibecde.com/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    return route.fulfill({
      json:
        path === "/airspace"
          ? { type: "FeatureCollection", features: zones, sources: {} }
          : { places: [], sources: {} },
    });
  });
  await page.addInitScript(() =>
    localStorage.setItem("nordsweet.language.v1", "en"),
  );
  await page.goto("/map");
  await expect(page.getByTestId("map")).toHaveAttribute(
    "data-map-ready",
    "true",
  );
  for (const [name, color, opacity, pje] of [
    ["ATZ EPNT", "#126cac", "0.38", true],
    ["ATZ EPKR", "#126cac", "0.19", true],
    ["CTR EPKK", "#b35a00", "0.19", false],
  ] as const) {
    await page.getByRole("button", { name: "Search", exact: true }).click();
    const search = page.getByRole("dialog", { name: "Search", exact: true });
    await search.getByRole("textbox").fill(name);
    await search.getByRole("button", { name: "Search", exact: true }).click();
    const details = page.getByRole("dialog", { name: "Details", exact: true });
    await expect(details).toContainText(name);
    await expect(details.locator(`rect[fill="${color}"]`)).toHaveAttribute(
      "fill-opacity",
      opacity,
    );
    await expect(
      details.getByRole("img", { name: "Parachuting (PJE)", exact: true }),
    ).toHaveCount(pje ? 1 : 0);
    await details.getByRole("button", { name: "Close", exact: true }).click();
  }
  await page.getByRole("button", { name: "Search", exact: true }).click();
  const search = page.getByRole("dialog", { name: "Search", exact: true });
  await search.getByRole("textbox").fill("ATZ EPKR");
  await search.getByRole("button", { name: "Search", exact: true }).click();
  await page
    .getByRole("dialog", { name: "Details", exact: true })
    .getByRole("button", { name: "Close", exact: true })
    .click();
  await page.getByLabel("Labels", { exact: true }).uncheck();
  await expect(page.getByLabel("Labels", { exact: true })).not.toBeChecked();
  await page.screenshot({ path: testInfo.outputPath("inactive-atz-pje.png") });
});
