import { expect, test } from "@playwright/test";

const flight = {
  id: "e2e",
  name: "E2E",
  savedAt: "2026-10-12T08:00:00.000Z",
  aircraftId: null,
  departure: { ident: "AAAA", lat: 50, lon: 19 },
  destination: { ident: "CCCC", lat: 50, lon: 21 },
  alternate: null,
  waypoints: [{ ident: "BBBB", lat: 50, lon: 20 }],
  cruiseAltitudeFt: 3000,
  cruiseTasKt: 100,
  wind: { directionDeg: 0, speedKt: 0 },
  legWinds: null,
  fuelFlowLph: 30,
  fuel: { blockL: 0, taxiL: 5, climbExtraL: 0 },
  stationsKg: {},
};

test.use({
  permissions: ["geolocation"],
  geolocation: { latitude: 50.02, longitude: 19.3, accuracy: 5 },
});

test("flies the route: sequencing, direct-to and debrief", async ({
  page,
  context,
}) => {
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => route.abort());
  await page.addInitScript((f) => {
    if (!localStorage.getItem("nordsweet.flight.v2")) {
      localStorage.setItem("nordsweet.language.v1", "en");
      localStorage.setItem(
        "nordsweet.flight.v2",
        JSON.stringify({ state: { flight: f }, version: 1 }),
      );
    }
  }, flight);

  await page.goto("/fly");
  await page.getByRole("button", { name: "Start flight" }).click();
  await expect(page.getByTestId("fly-next")).toHaveText("BBBB");
  await expect(page.getByTestId("fly-xte")).toHaveText(/^1\.\d L$/); // 0.02° north of the (great-circle) track

  await context.setGeolocation({ latitude: 50, longitude: 20.05, accuracy: 5 }); // abeam BBBB
  await expect(page.getByTestId("fly-next")).toHaveText("CCCC");
  await page.reload(); // in-flight state survives a reload
  await expect(page.getByTestId("fly-next")).toHaveText("CCCC");

  await page.getByRole("combobox", { name: "Direct to…" }).click();
  await page.getByRole("option", { name: "CCCC" }).click();
  await expect(page.getByTestId("fly-xte")).toHaveText(/0\.0/);

  await page.getByRole("button", { name: "End flight" }).click();
  await expect(page.getByTestId("debrief")).toContainText("track points");
});
