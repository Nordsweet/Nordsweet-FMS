import { expect, test } from "./test";
import { newFlight } from "../src/data/flight";

for (const litres of [true, false]) {
  test(`FPL forecasts remaining fuel in ${litres ? "selected litres" : "C172S default gallons"} and recalculates after removal`, async ({
    page,
  }) => {
    test.setTimeout(60000);
    await page.setViewportSize(
      litres ? { width: 1280, height: 800 } : { width: 768, height: 1024 },
    );
    await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => r.abort());
    await page.addInitScript(
      ({ flight }) => {
        localStorage.setItem("nordsweet.language.v1", "en");
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
              phase: "cruise",
              phaseManual: true,
              activeLeg: 0,
              route: [
                { ident: "START", lat: 50, lon: 19 },
                { ident: "CORNER", lat: 50.5, lon: 19.5 },
                { ident: "END", lat: 50, lon: 20 },
              ],
            },
          }),
        );
        navigator.geolocation.watchPosition = (callback) => {
          const send = () =>
            callback({
              timestamp: Date.now(),
              coords: {
                latitude: 50.1,
                longitude: 19.1,
                altitude: 1524,
                altitudeAccuracy: 5,
                accuracy: 5,
                speed: (100 * 1852) / 3600,
                heading: 45,
              },
            } as GeolocationPosition);
          send();
          return window.setInterval(send, 1000);
        };
        navigator.geolocation.clearWatch = clearInterval;
      },
      {
        flight: {
          ...newFlight(),
          aircraftId: "C172S",
          fuelDisplayUnit: litres ? "L" : null,
          fuel: { blockL: 100 },
        },
      },
    );
    await page.goto("/fly");
    await page.getByRole("button", { name: "FPL", exact: true }).click();
    const table = page.getByTestId("flight-plan-table");
    await expect(table).toContainText(litres ? "Fuel L" : "Fuel US gal");
    const rows = table.getByRole("listitem");
    await expect(rows.first().getByTestId("fpl-fuel")).toHaveText("—");
    await expect(rows.nth(1).getByTestId("fpl-fuel")).toHaveText(/^\d+$/);
    const middle = Number(
      await rows.nth(1).getByTestId("fpl-fuel").innerText(),
    );
    const last = Number(await rows.last().getByTestId("fpl-fuel").innerText());
    expect(middle).toBeGreaterThan(last);
    expect(middle).toBeLessThan(litres ? 100 : 26);
    expect(last).toBeGreaterThan(litres ? 50 : 13);
    await expect(
      rows.last().getByRole("button", { name: "Point options: END" }),
    ).toBeVisible();
    await table.screenshot({
      path: `test-results/fpl-fuel-${litres ? "desktop" : "ipad"}.png`,
    });
    await rows
      .nth(1)
      .getByRole("button", { name: "Remove CORNER from route" })
      .click();
    await expect(rows).toHaveCount(2);
    await expect
      .poll(async () =>
        Number(await rows.last().getByTestId("fpl-fuel").innerText()),
      )
      .toBeGreaterThan(last);
  });
}
