import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => route.abort());
  await page.addInitScript(() => {
    if (!localStorage.getItem("nordsweet.settings.v2"))
      localStorage.setItem("nordsweet.language.v1", "en");
  });
});

test("renames and exports saved snapshots, then loads directly into Route", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("tab", { name: "Saved flights", exact: true }).click();
  await page
    .getByLabel("Import .nord")
    .setInputFiles("tests/fixtures/nord/P2006T0508261012.nord");
  const row = page
    .getByRole("list", { name: "Saved flights list" })
    .getByRole("listitem")
    .first();
  await row.getByRole("button", { name: "Rename", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByLabel("Flight name")
    .fill("Preparation audit");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Save", exact: true })
    .click();
  await expect(row).toContainText("Preparation audit");
  const downloaded = page.waitForEvent("download");
  await row.getByRole("button", { name: "Export .nord", exact: true }).click();
  expect((await downloaded).suggestedFilename()).toMatch(/\.nord$/);
  for (const format of ["GPX", "KML"]) {
    const file = page.waitForEvent("download");
    await row
      .getByRole("button", { name: `Export ${format}`, exact: true })
      .click();
    expect((await file).suggestedFilename()).toMatch(
      new RegExp(`\\.${format.toLowerCase()}$`),
    );
  }
  await row.getByRole("button", { name: "Load", exact: true }).click();
  await expect(
    page.getByRole("tab", { name: "Current flight", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(
    page.getByRole("tab", { name: "Route", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(page.getByTestId("route-strip")).toContainText("EPNT");
});

test("keeps preparation conditions, taxi selections and legacy preferences across navigation and reload", async ({
  page,
}) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem("nordsweet.settings.v2")) {
      localStorage.setItem("nordsweet.checklistAutoscroll.v1", "0");
      localStorage.setItem("nordsweet.atisAutoscroll.v1", "0");
      localStorage.setItem("nordsweet.checklistVoiceGender.v1", "male");
    }
  });
  await page.goto("/");
  await page.getByRole("combobox", { name: "Aircraft type" }).click();
  await page
    .getByRole("option", { name: "P2006T (P06T)", exact: true })
    .click();
  await page.getByRole("link", { name: "Settings", exact: true }).click();
  await expect(
    page.getByLabel("Checklist autoscroll", { exact: true }),
  ).not.toBeChecked();
  await expect(
    page.getByLabel("ATIS autoscroll", { exact: true }),
  ).not.toBeChecked();
  await expect(
    page.getByRole("combobox", { name: "Checklist voice", exact: true }),
  ).toContainText("Male");
  await page.getByRole("link", { name: "Flight Planner", exact: true }).click();
  await expect(
    page.getByRole("tab", { name: "Aircraft", exact: true }),
  ).toBeVisible();

  // Conditions and taxi choices are set in the flight view (RWY / ROUTE), as in legacy.
  await page.getByRole("tab", { name: "Route", exact: true }).click();
  await page.getByLabel("Departure", { exact: true }).fill("EPKK");
  await page.keyboard.press("Escape");
  await page.getByLabel("Arrival", { exact: true }).fill("EPGD");
  await page.keyboard.press("Escape");
  await page.getByRole("link", { name: "Start a flight" }).click();
  const panel = async (phase: string, name: string) => {
    await page.getByRole("button", { name: phase, exact: true }).click();
    const button = page.getByRole("button", { name, exact: true });
    if ((await button.getAttribute("aria-expanded")) !== "true")
      await button.click();
  };
  await panel("Take-off", "RWY");
  const takeoff = page.getByTestId("perf-takeoff");
  await takeoff.getByLabel("QNH").fill("1025");
  await takeoff.getByLabel("Wind speed").fill("12");
  await takeoff.getByLabel("Wind speed").blur();
  await panel("Taxi-Out", "Route");
  const taxi = page.getByTestId("taxi-departure");
  await taxi.getByRole("combobox", { name: "To", exact: true }).click();
  await page.getByRole("option", { name: "HP25", exact: true }).click();

  await page.reload();
  await panel("Take-off", "RWY");
  await expect(takeoff.getByLabel("QNH")).toHaveValue("1025");
  await expect(takeoff.getByLabel("Wind speed")).toHaveValue("12");
  await panel("Taxi-Out", "Route");
  await expect(
    taxi.getByRole("combobox", { name: "To", exact: true }),
  ).toContainText("HP25");
});
