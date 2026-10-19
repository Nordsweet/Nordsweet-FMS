import { test, expect } from "@playwright/test";
import { newFlight } from "../src/data/flight";
import { newTimers } from "../src/domain/flight-timers";

test("accepts actual postflight readings, shows four statistic groups and retains them after reload", async ({
  page,
}) => {
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => r.abort());
  await page.addInitScript(
    ({ flight, timers }) => {
      localStorage.setItem("nordsweet.language.v1", "en");
      if (!localStorage.getItem("nordsweet.flight.v2"))
        localStorage.setItem(
          "nordsweet.flight.v2",
          JSON.stringify({ version: 1, state: { flight } }),
        );
      if (!localStorage.getItem("nordsweet.aircraftState.v2"))
        localStorage.setItem(
          "nordsweet.aircraftState.v2",
          JSON.stringify({
            version: 1,
            state: {
              states: {
                "C172S::SPABC": {
                  mth: "00123.40",
                  fuelRemainingL: 80,
                  fuelAddedL: 20,
                  fuelUsedL: null,
                  fuelIndicationMode: null,
                  updatedAt: 1,
                },
              },
            },
          }),
        );
      if (!localStorage.getItem("nordsweet.inflight.v1"))
        localStorage.setItem(
          "nordsweet.inflight.v1",
          JSON.stringify({
            version: 1,
            state: {
              startedAt: "2026-10-18T23:40:00Z",
              route: [flight.departure, flight.destination],
              timers,
              debrief: {
                flightId: flight.id,
                name: flight.name,
                aircraftType: "C172S",
                registration: "SPABC",
                mthBefore: 123.4,
                fuelBeforeL: 100,
                endedAt: null,
                times: {
                  offBlockAt: null,
                  onBlockAt: null,
                  takeoffAt: null,
                  landingAt: null,
                },
                accepted: null,
              },
            },
          }),
        );
    },
    {
      flight: {
        ...newFlight(),
        aircraftId: "C172S",
        registration: "SP-ABC",
        fuel: { blockL: 100 },
        departure: { ident: "EPKK", lat: 50.0778, lon: 19.7847 },
        destination: { ident: "EPNT", lat: 49.4628, lon: 20.0507 },
      },
      timers: {
        ...newTimers(),
        offBlock: {
          ...newTimers().offBlock,
          startedAt: Date.parse("2026-10-18T23:40:00Z"),
          stoppedAt: Date.parse("2026-10-19T01:10:00Z"),
        },
        airTime: {
          ...newTimers().airTime,
          startedAt: Date.parse("2026-10-18T23:50:00Z"),
          stoppedAt: Date.parse("2026-10-19T01:00:00Z"),
        },
      },
    },
  );
  await page.goto("/fly");
  await page.getByRole("button", { name: "Close flight", exact: true }).click();
  await page.getByLabel("MTH after flight", { exact: true }).fill("123.70");
  await page
    .getByLabel("Fuel after flight (US gal)", { exact: true })
    .fill("20");
  await page.getByRole("button", { name: "Accept", exact: true }).click();
  for (const [id, text] of [
    ["mth-used", "0.30 MTH"],
    ["mth-after", "123.70 MTH"],
    ["fuel-used", "6 US gal"],
    ["fuel-after", "20 US gal"],
    ["block-time", "01:30:00"],
    ["air-time", "01:10:00"],
  ])
    await expect(page.getByTestId(`debrief-${id}`)).toHaveText(text!);
  await expect(page.getByTestId("debrief-block-events")).toHaveText(
    "23:40:00Z → 01:10:00Z",
  );
  await page.reload();
  await expect(page.getByTestId("debrief-mth-used")).toHaveText("0.30 MTH");
  await page.getByRole("button", { name: "Edit readings" }).click();
  await page.getByLabel("MTH after flight", { exact: true }).fill("120");
  await page.getByRole("button", { name: "Accept", exact: true }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "cannot be lower" }),
  ).toBeVisible();
  await page.getByLabel("MTH after flight", { exact: true }).fill("123.80");
  await page.getByRole("button", { name: "Accept", exact: true }).click();
  await expect(page.getByTestId("debrief-mth-used")).toHaveText("0.40 MTH");
  await page.screenshot({ path: "test-results/debrief-statistics.png" });
  expect(
    await page.evaluate(() => {
      const saved = JSON.parse(
        localStorage.getItem("nordsweet.aircraftState.v2")!,
      ) as { state: { states: Record<string, { fuelRemainingL: number }> } };
      return saved.state.states["C172S::SPABC"]?.fuelRemainingL;
    }),
  ).toBeCloseTo(75.70823568, 9);
  await page.setViewportSize({ width: 390, height: 844 });
  const panel = page.locator('.fly-popover[data-debrief="true"]');
  expect(
    await panel.evaluate((el) => el.scrollWidth - el.clientWidth),
  ).toBeLessThanOrEqual(1);
  await page.screenshot({ path: "test-results/debrief-statistics-phone.png" });
});
