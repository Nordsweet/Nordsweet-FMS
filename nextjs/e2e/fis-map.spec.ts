import { expect, test } from "./test";

test("background FIS cannot be clicked or selected on the map", async ({
  page,
}) => {
  test.setTimeout(60000);
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => r.abort());
  await page.route("https://aviation.lab.vibecde.com/traffic**", (r) =>
    r.fulfill({ json: { count: 0, sources: {}, aircraft: [] } }),
  );
  await page.route("**/data/airports.json", (r) => r.fulfill({ json: [] }));
  await page.route("**/data/navpoints.json", (r) => r.fulfill({ json: [] }));
  await page.route("https://aviation.lab.vibecde.com/airspace**", (r) =>
    r.fulfill({
      json: {
        type: "FeatureCollection",
        sources: {},
        features: [
          {
            type: "Feature",
            bbox: [-170, -80, 170, 80],
            geometry: {
              type: "Polygon",
              coordinates: [
                [
                  [-170, -80],
                  [170, -80],
                  [170, 80],
                  [-170, 80],
                  [-170, -80],
                ],
              ],
            },
            properties: {
              name: "FIS HIDDEN",
              class: "FIS",
              lower: "GND",
              upper: "FL95",
              active_now: true,
              activations: [],
              frequencies: [
                {
                  frequencyMhz: "119.275",
                  callsign: "Kraków Information",
                  serviceId: "fiss",
                  sector: null,
                },
              ],
            },
          },
        ],
      },
    }),
  );
  await page.addInitScript(() =>
    localStorage.setItem("nordsweet.language.v1", "en"),
  );
  await page.goto("/map");
  await expect(page.getByTestId("map")).toHaveAttribute(
    "data-map-ready",
    "true",
    { timeout: 15000 },
  );
  await page.getByRole("button", { name: "Search", exact: true }).click();
  const search = page.getByRole("dialog", { name: "Search", exact: true });
  await search.getByRole("textbox").fill("FIS HIDDEN");
  await search.getByRole("button", { name: "Search", exact: true }).click();
  await expect(search).toContainText("No object found");
  await search.getByRole("button", { name: "Close", exact: true }).click();
  const canvas = page.getByTestId("map").locator("canvas").first();
  const positions = await canvas.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    const points = [];
    for (const y of [0.2, 0.35, 0.5, 0.65])
      for (const x of [0.3, 0.5, 0.7]) {
        const point = { x: bounds.width * x, y: bounds.height * y };
        if (
          document.elementFromPoint(
            bounds.left + point.x,
            bounds.top + point.y,
          ) === element
        )
          points.push(point);
      }
    return points.slice(0, 3);
  });
  expect(positions).toHaveLength(3);
  for (const position of positions) {
    await canvas.click({ position });
    await expect(
      page.getByRole("dialog", { name: "Details", exact: true }),
    ).toHaveCount(0);
  }
});
