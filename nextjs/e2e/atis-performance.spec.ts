import fs from "node:fs";
import { expect, test, selectFlightPhase, type Page } from "./test";
import { newFlight } from "../src/data/flight";
import { atisReducer, emptyAtisPad } from "../src/domain/atis-pad";

const airportFixture = JSON.parse(
  fs.readFileSync("src/api/aviation/fixtures/airport.json", "utf8"),
) as Record<string, unknown>;

async function seed(page: Page, manual = false) {
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => r.abort());
  const point = { ident: "EPKK", lat: 50.0778, lon: 19.7855 };
  const flight = {
    ...newFlight(),
    aircraftId: "R172K",
    departure: point,
    destination: point,
  };
  let pad = emptyAtisPad();
  for (const [field, value] of [
    ["qnh", "QNH 1005"],
    ["temperature", "M05"],
    ["wind", "250/08KT"],
  ] as const)
    pad = atisReducer(pad, { type: "preset", field, value });
  await page.addInitScript(
    ({ flight, manual, pad }) => {
      localStorage.setItem("nordsweet.language.v1", "en");
      if (!localStorage.getItem("nordsweet.flight.v2"))
        localStorage.setItem(
          "nordsweet.flight.v2",
          JSON.stringify({ version: 1, state: { flight } }),
        );
      if (manual && !localStorage.getItem("nordsweet.atis.v1"))
        localStorage.setItem(
          "nordsweet.atis.v1",
          JSON.stringify({ version: 1, state: { airport: "EPKK", pad } }),
        );
    },
    { flight, manual, pad },
  );
}

async function openPerformance(page: Page) {
  await page.goto("/fly");
  await selectFlightPhase(page, "Take-off");
  await page.getByRole("button", { name: "RWY", exact: true }).click();
  await expect(page.getByTestId("perf-takeoff")).toBeVisible();
}

test("downloads phase-specific ATIS automatically and preserves pilot corrections until ATIS changes", async ({
  page,
}) => {
  await seed(page);
  let qnh = 1021;
  await page.route("https://aviation.lab.vibecde.com/airports/EPKK", (r) =>
    r.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ...airportFixture,
        atis: [
          {
            kind: "departure",
            letter: "A",
            received_at: new Date().toISOString(),
            age_minutes: 1,
            stale: false,
            qnh_hpa: qnh,
            qnh_matches_metar: true,
            text:
              "EPKK DEP ATIS A RWY 25. WIND 250 DEG, 15 KT. T 30, DP 10. QNH " +
              qnh +
              ".",
          },
          {
            kind: "arrival",
            letter: "B",
            received_at: new Date().toISOString(),
            age_minutes: 1,
            stale: false,
            qnh_hpa: 1002,
            qnh_matches_metar: true,
            text: "EPKK ARR ATIS B RWY 07. WIND 070 DEG, 5 KT. T 5, DP 2. QNH 1002.",
          },
        ],
      }),
    }),
  );
  await openPerformance(page);
  const takeoff = page.getByTestId("perf-takeoff"),
    landing = page.getByTestId("perf-landing");
  await expect(takeoff.getByLabel("QNH", { exact: true })).toHaveValue("1021");
  await expect(takeoff.getByLabel("Temperature", { exact: true })).toHaveValue(
    "30",
  );
  await expect(takeoff.getByLabel("Wind speed", { exact: true })).toHaveValue(
    "15",
  );
  await expect(
    takeoff.getByRole("combobox", { name: "Runway", exact: true }),
  ).toContainText("25");
  await expect(landing.getByLabel("QNH", { exact: true })).toHaveValue("1002");
  await expect(
    landing.getByRole("combobox", { name: "Runway", exact: true }),
  ).toContainText("07");
  await takeoff.getByLabel("QNH", { exact: true }).fill("1025");
  await takeoff.getByLabel("QNH", { exact: true }).blur();
  await openPerformance(page);
  await expect(takeoff.getByLabel("QNH", { exact: true })).toHaveValue("1025");
  qnh = 1010;
  await openPerformance(page);
  await expect(takeoff.getByLabel("QNH", { exact: true })).toHaveValue("1010");
  await expect(page.getByTestId("perf-takeoff-atis")).toBeVisible();
});

test("migrated manual ATIS feeds performance automatically and survives offline reload", async ({
  page,
}) => {
  await seed(page, true);
  await openPerformance(page);
  const takeoff = page.getByTestId("perf-takeoff");
  await expect(takeoff.getByLabel("QNH", { exact: true })).toHaveValue("1005");
  await expect(takeoff.getByLabel("Temperature", { exact: true })).toHaveValue(
    "-5",
  );
  await expect(takeoff.getByLabel("Wind speed", { exact: true })).toHaveValue(
    "8",
  );
  await expect(
    takeoff.getByLabel("Wind direction", { exact: true }),
  ).toHaveValue("250");
  await openPerformance(page);
  await expect(takeoff.getByLabel("QNH", { exact: true })).toHaveValue("1005");
});
