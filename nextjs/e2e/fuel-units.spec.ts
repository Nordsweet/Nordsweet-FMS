import { test, expect } from "@playwright/test";
import { newFlight } from "../src/data/flight";
import { newTimers } from "../src/domain/flight-timers";

test.beforeEach(async ({ page }) => {
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => r.abort());
  await page.addInitScript(() =>
    localStorage.setItem("nordsweet.language.v1", "en"),
  );
});

test("registration chooses its own model and state, gallons convert without rounding stored fuel", async ({
  page,
}) => {
  await page.addInitScript(
    ({ flight }) => {
      if (localStorage.getItem("nordsweet.flight.v2")) return;
      localStorage.setItem(
        "nordsweet.flight.v2",
        JSON.stringify({ version: 1, state: { flight } }),
      );
      const reading = {
        fuelIndicationMode: null,
        mth: "00123.40",
        fuelRemainingL: 50,
        fuelAddedL: 23,
        fuelUsedL: null,
        updatedAt: 1,
      };
      localStorage.setItem(
        "nordsweet.aircraftState.v2",
        JSON.stringify({
          version: 1,
          state: {
            states: {
              "C172S::SPABC": reading,
              "C172S::DEFAULT": { ...reading, mth: "00999.00" },
            },
          },
        }),
      );
    },
    {
      flight: {
        ...newFlight(),
        aircraftId: "C152",
        departure: { ident: "EPKK", lat: 50.0778, lon: 19.7847 },
        destination: { ident: "EPNT", lat: 49.4628, lon: 20.0507 },
        fuel: { blockL: 73.42 },
      },
    },
  );
  await page.goto("/");
  await page.getByLabel("Registration", { exact: true }).fill("sp-abc");
  await expect(
    page.getByRole("combobox", { name: "Aircraft type", exact: true }),
  ).toContainText("C172S");
  await expect(page.getByLabel("MTH", { exact: true })).toHaveValue("00123.40");
  await page.getByRole("tab", { name: "Fuel", exact: true }).click();
  const unit = page.getByRole("combobox", { name: "Fuel unit", exact: true });
  await expect(unit).toContainText("US gal");
  await expect(page.getByTestId("fuel-on-board")).toHaveText("19 US gal");
  const block = page.getByLabel("Block Fuel fuel US gallons", { exact: true });
  await block.fill("20");
  await block.blur();
  const canonical = () =>
    page.evaluate(
      () =>
        (
          JSON.parse(localStorage.getItem("nordsweet.flight.v2")!) as {
            state: { flight: { fuel: { blockL: number } } };
          }
        ).state.flight.fuel.blockL,
    );
  expect(await canonical()).toBeCloseTo(75.70823568, 9);
  await unit.click();
  await page.getByRole("option", { name: "L", exact: true }).click();
  await expect(
    page.getByLabel("Block Fuel fuel litres", { exact: true }),
  ).toHaveValue("76");
  await page.getByLabel("Block Fuel fuel litres", { exact: true }).focus();
  await page.getByLabel("Block Fuel fuel litres", { exact: true }).blur();
  expect(await canonical()).toBeCloseTo(75.70823568, 9);
  await expect(page.getByTestId("fuel-on-board")).toHaveText("73 L");
  await expect(page.getByLabel("Fuel added (L)", { exact: true })).toHaveValue(
    "23",
  );
  await unit.click();
  await page.getByRole("option", { name: "US gal", exact: true }).click();
  await page.reload();
  await page.getByRole("tab", { name: "Fuel", exact: true }).click();
  await expect(unit).toContainText("US gal");
  await expect(block).toHaveValue("20");
  expect(await canonical()).toBeCloseTo(75.70823568, 9);
  await page.getByRole("tab", { name: "Aircraft", exact: true }).click();
  await page.getByLabel("Registration", { exact: true }).fill("SP-XYZ");
  await expect(page.getByLabel("MTH", { exact: true })).toHaveValue("");
  await page.getByRole("tab", { name: "Fuel", exact: true }).click();
  await expect(page.getByTestId("fuel-on-board")).toHaveText("--");
});

test("database registration lookup selects the exact supported model", async ({
  page,
}) => {
  await page.route("https://api.adsbdb.com/v0/aircraft/**", (r) =>
    r.fulfill({
      json: {
        response: {
          aircraft: {
            registration: "SP-XYZ",
            mode_s: "48abcd",
            icao_type: "C172",
            type: "Cessna 172S Skyhawk",
          },
        },
      },
    }),
  );
  await page.goto("/");
  await page.getByLabel("Registration", { exact: true }).fill("SP-XYZ");
  await page.getByLabel("Registration", { exact: true }).blur();
  await expect(
    page.getByRole("combobox", { name: "Aircraft type", exact: true }),
  ).toContainText("C172S");
});

test("C172S FREDA accepts gallons and logs the check in gallons", async ({
  page,
}) => {
  await page.addInitScript(
    ({ flight, timers }) => {
      localStorage.setItem(
        "nordsweet.flight.v2",
        JSON.stringify({ version: 1, state: { flight } }),
      );
      localStorage.setItem(
        "nordsweet.inflight.v1",
        JSON.stringify({
          version: 1,
          state: {
            startedAt: new Date().toISOString(),
            route: [flight.departure, flight.destination],
            timers,
            fredaOpen: true,
          },
        }),
      );
    },
    {
      flight: {
        ...newFlight(),
        aircraftId: "C172S",
        fuel: { blockL: 100 },
        departure: { ident: "EPKK", lat: 50.0778, lon: 19.7847 },
        destination: { ident: "EPNT", lat: 49.4628, lon: 20.0507 },
      },
      timers: newTimers(),
    },
  );
  await page.goto("/fly");
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("FREDA", { exact: true })).toBeVisible();
  await dialog.getByLabel("Left tank [US gal]").fill("10");
  await dialog.getByLabel("Right tank [US gal]").fill("11");
  await dialog.getByRole("button", { name: /Complete/i }).click();
  const state = await page.evaluate(
    () =>
      (
        JSON.parse(localStorage.getItem("nordsweet.inflight.v1")!) as {
          state: unknown;
        }
      ).state,
  );
  expect(JSON.stringify(state)).toContain("21 US gal");
});
