import { expect, test, type Page } from "./test";
import { newFlight } from "../src/data/flight";

async function enterFuel(page: Page, fuelL: number) {
  await page.getByRole("button", { name: "Options", exact: true }).click();
  await page.getByRole("button", { name: "FREDA CHECK", exact: true }).click();
  await page
    .getByLabel("Left tank [L]", { exact: true })
    .fill(String(fuelL / 2));
  await page
    .getByLabel("Right tank [L]", { exact: true })
    .fill(String(fuelL / 2));
  await page
    .getByRole("button", { name: "Complete FREDA check", exact: true })
    .click();
  await page
    .getByRole("dialog", { name: "Options", exact: true })
    .getByRole("button", { name: "Close", exact: true })
    .click();
}

test("reserve popups use FREDA readings, escalate after dismissal, persist and retain timestamped history", async ({
  page,
}) => {
  test.setTimeout(90000);
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => r.abort());
  await page.addInitScript(
    (flight) => {
      localStorage.setItem("nordsweet.language.v1", "en");
      if (!localStorage.getItem("nordsweet.flight.v2"))
        localStorage.setItem(
          "nordsweet.flight.v2",
          JSON.stringify({ version: 1, state: { flight } }),
        );
      if (!localStorage.getItem("nordsweet.inflight.v1"))
        localStorage.setItem(
          "nordsweet.inflight.v1",
          JSON.stringify({
            version: 1,
            state: {
              startedAt: new Date().toISOString(),
              phase: "cruise",
              phaseManual: true,
              route: [flight.departure, flight.destination],
              activeLeg: 0,
            },
          }),
        );
      // Fuel monitoring also works without GPS; no automatic take-off or position-driven popup interferes.
      navigator.geolocation.watchPosition = () => 1;
      navigator.geolocation.clearWatch = () => undefined;
    },
    {
      ...newFlight(),
      aircraftId: "R172K",
      fuelDisplayUnit: "L",
      fuel: { blockL: 100 },
      departure: { ident: "EPKK", lat: 50.077778, lon: 19.784722 },
      destination: { ident: "EPNT", lat: 49.46283, lon: 20.05067 },
      fuelOverrides: { alternate: { fuelL: 30 } },
    },
  );
  await page.goto("/fly");
  await expect(page.getByTestId("map")).toHaveAttribute(
    "data-map-ready",
    "true",
  );
  await expect(page.getByTestId("fuel-reserve-alternate")).toHaveCount(0);
  await expect(page.getByTestId("fuel-reserve-final")).toHaveCount(0);
  await enterFuel(page, 30);
  const alternate = page.getByTestId("fuel-reserve-alternate");
  await expect(alternate).toHaveText(/Using Alternate Fuel/);
  await expect(alternate).toHaveClass(/border-yellow-400/);
  await alternate.getByRole("button").click();
  await page.reload();
  await expect(page.getByTestId("map")).toHaveAttribute(
    "data-map-ready",
    "true",
  );
  await expect(alternate).toHaveCount(0);
  await enterFuel(page, 10);
  const final = page.getByTestId("fuel-reserve-final");
  await expect(final).toHaveText(/Using Final Reserve Fuel/);
  await expect(final).toHaveClass(/border-red-500/);
  await expect(alternate).toHaveCount(0);
  await final.screenshot({ path: "test-results/final-reserve-popup.png" });
  await final.getByRole("button").click();
  await page
    .getByRole("button", { name: "Notifications", exact: true })
    .click();
  const history = page.getByTestId("notification-history");
  const reserveEntries = history
    .getByRole("listitem")
    .filter({ hasText: /Using (Alternate|Final Reserve) Fuel/ });
  await expect(reserveEntries).toHaveCount(2);
  for (const entry of await reserveEntries.all())
    await expect(entry.locator("time")).toHaveAttribute(
      "datetime",
      /\d{4}-\d{2}-\d{2}T/,
    );
});
