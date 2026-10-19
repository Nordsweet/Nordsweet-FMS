import { expect, test } from "@playwright/test";
test("preparation navigation exposes exactly Settings, Flight Planner, Map, Aircraft and Inspire me and shares the map plan with the form", async ({
  page,
}) => {
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => route.abort());
  await page.addInitScript(() => {
    if (!localStorage.getItem("nordsweet.settings.v2"))
      localStorage.setItem("nordsweet.language.v1", "en");
  });
  await page.goto("/");
  const navigation = page.locator("header nav");
  await expect(navigation.getByRole("link")).toHaveCount(5);
  await expect(navigation.getByRole("button")).toHaveCount(0);
  await expect(
    navigation.getByRole("link", { name: "Settings", exact: true }),
  ).toBeVisible();
  await expect(
    navigation.getByRole("link", { name: "Flight Planner", exact: true }),
  ).toBeVisible();
  await expect(
    navigation.getByRole("link", { name: "Aircraft", exact: true }),
  ).toBeVisible();
  await expect(
    navigation.getByRole("link", { name: "Inspire me", exact: true }),
  ).toBeVisible();
  await expect(
    navigation.getByRole("link", { name: "Fly", exact: true }),
  ).toHaveCount(0);
  await expect(
    navigation.getByRole("link", { name: "Checklists", exact: true }),
  ).toHaveCount(0);
  await navigation.getByRole("link", { name: "Map", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Map flight planner", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Start navigation", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByTestId("map-planner-summary")).not.toContainText(
    "NaN",
  );
  const planner = page.getByRole("complementary", {
    name: "Map flight planner",
  });
  await planner.getByLabel("Departure", { exact: true }).fill("EPKK");
  await page.getByRole("option").filter({ hasText: "EPKK" }).first().click();
  await planner.getByLabel("Arrival", { exact: true }).fill("EPNT");
  await page.getByRole("option").filter({ hasText: "EPNT" }).first().click();
  await expect(page.getByTestId("map-planner-points")).toContainText("EPKK");
  await expect(page.getByTestId("map-planner-points")).toContainText("EPNT");
  await planner.getByLabel("Altitude", { exact: true }).fill("4500");
  await planner.getByLabel("Altitude", { exact: true }).blur();
  await navigation
    .getByRole("link", { name: "Flight Planner", exact: true })
    .click();
  await page.getByRole("tab", { name: "Route", exact: true }).click();
  await expect(page.getByLabel("Departure", { exact: true })).toHaveValue(
    "EPKK",
  );
  await expect(page.getByLabel("Arrival", { exact: true })).toHaveValue("EPNT");
  await expect(page.getByLabel("Altitude", { exact: true })).toHaveValue(
    "4500",
  );
});

test("plans coordinate routes imported from GPX and removes a map waypoint", async ({
  page,
}) => {
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => route.abort());
  await page.addInitScript(() => {
    localStorage.setItem("nordsweet.language.v1", "en");
  });
  await page.goto("/map");
  await page.getByLabel("Import GPX", { exact: true }).setInputFiles({
    name: "route.gpx",
    mimeType: "application/gpx+xml",
    buffer: Buffer.from(
      '<gpx><rte><rtept lat="52" lon="19"><name>A</name></rtept><rtept lat="52.1" lon="19.1"><name>MID</name></rtept><rtept lat="52.2" lon="19.2"><name>C</name></rtept></rte></gpx>',
    ),
  });
  await expect(page.getByTestId("map-planner-points")).toContainText("MID");
  await expect(page.getByTestId("map-planner-summary")).not.toContainText(
    "NaN",
  );
  await expect(page.getByTestId("map-planner-summary")).toContainText("14.1");
  await page
    .getByRole("button", { name: "Remove point MID", exact: true })
    .click();
  await expect(page.getByTestId("map-planner-points")).not.toContainText("MID");
  await expect(page.getByTestId("map-planner-points")).toContainText("C");
  await page
    .locator("header nav")
    .getByRole("link", { name: "Flight Planner", exact: true })
    .click();
  await page.getByRole("tab", { name: "Route", exact: true }).click();
  await expect(page.getByLabel("Departure", { exact: true })).toHaveValue("A");
  await expect(page.getByLabel("Arrival", { exact: true })).toHaveValue("C");
  await page
    .locator("header nav")
    .getByRole("link", { name: "Map", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Map flight planner", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByTestId("map-planner-points")).not.toContainText("MID");
});
