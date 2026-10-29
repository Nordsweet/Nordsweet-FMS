import { type Flight } from "../src/data/flight";
import { selectFlightPhase, type Page, expect, test } from "./test";

test.beforeEach(async ({ page }) => {
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => route.abort());
  await page.addInitScript(() => {
    if (!localStorage.getItem("nordsweet.settings.v2"))
      localStorage.setItem("nordsweet.language.v1", "en");
  });
});

async function pickPoint(page: Page, label: string, ident: string) {
  await page.getByLabel(label, { exact: true }).fill("");
  await page.getByLabel(label, { exact: true }).fill(ident);
  await page.getByRole("option").filter({ hasText: ident }).first().click();
}

async function select(page: Page, name: string, option: RegExp) {
  await page.getByRole("combobox", { name, exact: true }).click();
  await page.getByRole("option", { name: option }).click();
}

test("expanded text follows the plan; point actions persist removal and Clear route preserves aircraft data", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("tab", { name: "Route", exact: true }).click();
  await pickPoint(page, "Departure", "EPWA");
  await pickPoint(page, "Arrival", "EPKK");
  const text = page.getByRole("textbox", { name: "Route", exact: true });
  await text.fill("ABAKU N871 SUWGI");
  await text.blur();
  await expect(text).toHaveValue(/EPWA.*ABAKU.*POLON.*SUWGI.*EPKK/);
  await page.screenshot({
    path: "test-results/planner-route-controls.png",
    fullPage: true,
  });
  const before = await page.evaluate(
    () =>
      (
        JSON.parse(localStorage.getItem("nordsweet.flight.v2")!) as {
          state: { flight: Flight };
        }
      ).state.flight,
  );
  await page
    .getByRole("button", { name: "Remove POLON from route", exact: true })
    .click();
  await expect(text).not.toHaveValue(/POLON/);
  await expect(page.getByTestId("route-strip")).not.toContainText("POLON");
  await page.reload();
  await page.getByRole("tab", { name: "Route", exact: true }).click();
  await expect(text).not.toHaveValue(/POLON/);
  await page
    .getByRole("button", { name: "Point options: ABAKU", exact: true })
    .click();
  await expect(page).toHaveURL(/\/map$/);
  await expect(
    page.getByRole("dialog", { name: "Details", exact: true }),
  ).toContainText("ABAKU");
  await page.goto("/");
  await page.getByRole("tab", { name: "Route", exact: true }).click();
  await page.getByRole("button", { name: "Clear route", exact: true }).click();
  await expect(text).toHaveValue("");
  await expect(page.getByTestId("route-strip")).toHaveCount(0);
  const after = await page.evaluate(
    () =>
      (
        JSON.parse(localStorage.getItem("nordsweet.flight.v2")!) as {
          state: { flight: Flight };
        }
      ).state.flight,
  );
  expect(after.aircraftId).toBe(before.aircraftId);
  expect(after.fuel).toEqual(before.fuel);
  expect(after.waypoints).toEqual([]);
  expect(after.departure).toBeNull();
  expect(after.destination).toBeNull();
});

// Expected values recorded from the legacy planner with the same inputs (main 1888742).
test("builds the legacy route: AUTO SID/STAR, TOC/TOD, restrictions", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("combobox", { name: "Aircraft type" }).click();
  await page.getByRole("option", { name: /^P2006T \(/ }).click();
  await page.getByRole("tab", { name: "Route", exact: true }).click();
  await pickPoint(page, "Departure", "EPKK");
  await pickPoint(page, "Arrival", "EPGD");
  await expect(page.getByTestId("route-summary")).toHaveText(
    "EPKK -> EPGD · 262.5 NM · ETE 02:12",
  );

  await select(page, "SID", /^AUTO - NAVUR 6J \/ RWY 25/);
  await select(page, "STAR", /^AUTO - OGDAV 5R \/ RWY 11/);
  await expect(page.getByTestId("route-strip")).toContainText(
    "EPKK THR25 → NIFCU → KK606 → KK609 → UXBAF → KK633 → USJOK → EGLUC → HIDBE → TOC → TIGJA → NAVUR → OGDAV → TOD → GD823 → UGNUR → GD822 → GD821 → EPGD THR11",
  );
  await expect(page.getByTestId("route-summary")).toHaveText(
    "EPKK -> EPGD · 347.4 NM · ETE 02:54",
  );
  const nifcu = page
    .getByRole("list", { name: "Route legs" })
    .getByRole("listitem")
    .first();
  await expect(nifcu).toContainText("252 deg / 5.2 NM");
  await expect(nifcu).toContainText("+2800ft / 230 kt");
  await expect(nifcu.getByRole("spinbutton")).toHaveAttribute(
    "placeholder",
    "3900",
  );
  await expect(page.getByTestId("route-status")).toContainText(
    "Destination threshold coordinates missing for EPGD RWY 11",
  );

  // Vertical profile: TOC/TOD and the climb gradient from the P2006T climb table.
  await page.getByRole("button", { name: "Vertical Profile" }).click();
  const profile = page.getByRole("dialog");
  await expect(profile).toContainText("608 ft/NM");
  await expect(profile.getByTestId("profile-table")).toContainText("TOC");
  await page.keyboard.press("Escape");

  // The flight view's PROC button draws the selected SID (legacy Nordchart).
  await page.getByRole("link", { name: /start a flight/i }).click();
  await selectFlightPhase(page, "Take-off");
  await page.getByRole("button", { name: "PROC", exact: true }).click();
  await expect(
    page.getByRole("img", { name: "NAVUR 6J procedure chart" }),
  ).toBeVisible();
});

test("free-text route, waypoint WX and schedule", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("tab", { name: "Route", exact: true }).click();
  await pickPoint(page, "Departure", "EPWA");
  await pickPoint(page, "Arrival", "EPKK");
  await page
    .getByRole("textbox", { name: "Route", exact: true })
    .fill("ABAKU N871 SUWGI ZZZZZ");
  await expect(page.getByTestId("route-strip")).toContainText(
    "EPWA → TOC → ABAKU → POLON → KUKOP → MULZA → UVROB → ASBIM → SUWGI → TOD → EPKK",
  );
  await expect(page.getByTestId("route-status")).toContainText(
    "Airways: N871. Unknown token skipped: ZZZZZ",
  );

  // A 20 kt headwind at the destination slows the whole route.
  const before = await page.getByTestId("route-summary").innerText();
  const legs = page.getByRole("list", { name: "Route legs" });
  await legs.getByRole("button", { name: "WX" }).last().click();
  const wx = page.getByRole("dialog");
  await wx.getByLabel("Altitude 1").fill("0");
  await wx.getByLabel("Direction 1").fill("200");
  await wx.getByLabel("Speed 1").fill("20");
  await wx.getByLabel("Speed 1").blur();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("route-tiles")).toContainText("Head");
  await expect(page.getByTestId("route-summary")).not.toHaveText(before);

  // Departure time set: landing follows the ETE.
  await page
    .getByRole("button", { name: "Set departure date and time" })
    .click();
  await page.getByLabel("Departure date / time").fill("2026-10-13T10:00");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: /^Landing: / })).toBeVisible();
});

test("airport field: arrow keys and Enter pick a search hit, Escape closes", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("tab", { name: "Route", exact: true }).click();
  const field = page.getByRole("combobox", { name: "Departure", exact: true });
  const options = page.getByRole("option");
  await field.fill("EPK");
  await expect(options.nth(1)).toBeVisible();
  await field.press("ArrowDown");
  await field.press("ArrowDown");
  await expect(options.nth(1)).toHaveAttribute("aria-selected", "true");
  const ident = await options.nth(1).locator("span").first().innerText();
  await field.press("Enter");
  await expect(options).toHaveCount(0);
  await expect(field).toHaveValue(ident);
  await field.fill("EPW");
  await expect(options.first()).toBeVisible();
  await field.press("Escape");
  await expect(options).toHaveCount(0);
  await expect(field).toHaveValue(ident);
});
