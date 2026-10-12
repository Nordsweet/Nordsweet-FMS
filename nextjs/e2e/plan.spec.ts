import { type Page, expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  // Deterministic: no live API (VFR points degrade gracefully), English UI.
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => route.abort());
  await page.addInitScript(() => {
    if (!localStorage.getItem("nordsweet.settings.v2"))
      localStorage.setItem("nordsweet.language.v1", "en");
  });
});

async function pickPoint(
  page: Page,
  label: string,
  query: string,
  ident: string,
) {
  await page.getByLabel(label, { exact: true }).fill(query);
  await page.getByRole("option").filter({ hasText: ident }).first().click();
}

test("plans a flight end to end and keeps it across reloads", async ({
  page,
}) => {
  await page.goto("/v2");
  await page.getByRole("combobox", { name: "Type / registration" }).click();
  await page.getByRole("option", { name: "Cessna R172K" }).click();

  await pickPoint(page, "Departure", "EPNT", "EPNT");
  await pickPoint(page, "Destination", "EPKK", "EPKK");
  await pickPoint(page, "Add waypoint", "ABAKU", "ABAKU");

  // Climb and descent split the first and last legs at TOC and TOD.
  await expect(page.getByRole("cell", { name: /^EPNT → TOC/ })).toBeVisible();
  await expect(page.getByRole("cell", { name: /^TOC → ABAKU/ })).toBeVisible();
  await expect(page.getByRole("cell", { name: /^TOD → EPKK/ })).toBeVisible();
  await expect(page.getByTestId("climb-summary")).toContainText("65 L/h");

  // Route economy from the R172K POH cruise table fills TAS and fuel flow.
  await expect(page.getByTestId("cruise-economy")).toContainText(
    "2600 RPM / 24 inHg",
  );
  await page
    .getByRole("button", { name: "Use 2600 RPM / 22 inHg" })
    .first()
    .click();
  await expect(page.getByLabel("True airspeed (TAS)")).not.toHaveValue("100");
  await expect(page.getByTestId("fuel-extra")).toBeVisible();
  await expect(page.getByTestId("wb-takeoff")).toContainText("kg");
  await expect(page.getByTestId("perf-takeoff-ground-roll")).toHaveText(
    /\d+ m/,
  );
  await expect(page.getByTestId("perf-landing-obstacle")).toHaveText(/\d+ m/);

  await page.getByLabel("Flight name").fill("Test flight");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page.getByRole("list", { name: "Saved flights list" }),
  ).toContainText("Test flight");

  await page.reload();
  await expect(page.getByRole("cell", { name: /^TOC → ABAKU/ })).toBeVisible();
  await expect(
    page.getByRole("list", { name: "Saved flights list" }),
  ).toContainText("Test flight");
});

test("imports a legacy .nord flight", async ({ page }) => {
  await page.goto("/v2");
  await page
    .getByLabel("Import .nord")
    .setInputFiles("public/savedflights/P2006T0508261012.nord");
  const saved = page.getByRole("list", { name: "Saved flights list" });
  await expect(saved).toContainText("EPNT -> EPML");
  await saved.getByRole("button", { name: "Load" }).first().click();
  await expect(
    page.getByRole("cell", { name: /→ EPML descent/ }),
  ).toBeVisible();
});

test("adds a SID, shows the taxi route and charts", async ({ page }) => {
  await page.goto("/v2");
  await pickPoint(page, "Departure", "EPKK", "EPKK");
  await pickPoint(page, "Destination", "EPNT", "EPNT");

  await page.getByRole("combobox", { name: "SID" }).click();
  await page.getByRole("option", { name: /^NAVUR 5F/ }).click();
  await expect(page.getByRole("cell", { name: /KK801/ }).first()).toBeVisible();

  await expect(page.getByTestId("taxi-departure-route")).toHaveText(
    "Stand 1 → Taxiway G → Taxiway B4 → Taxiway C → HP07",
  );
  await expect(page.getByTestId("taxi-arrival")).toContainText("EPNT");

  await expect(
    page.getByRole("link", { name: "EPKK · National AIP · AD2" }),
  ).toHaveAttribute("href", "/charts/Poland/EPKK/National%20AIP/AD2.pdf");
});
