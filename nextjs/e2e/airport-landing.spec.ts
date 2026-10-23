import fs from "node:fs";
import { test, expect, selectFlightPhase, type Page } from "./test";
import { newFlight } from "../src/data/flight";
import { airportSchema } from "../src/data/schemas";

const airports = airportSchema
  .array()
  .parse(JSON.parse(fs.readFileSync("public/data/airports.json", "utf8")));
const airport = airports.find((a) => a.ident === "EPKK")!;
const start = { ident: "START", lat: 50, lon: 19 };
const corner = { ident: "CORNER", lat: 50.5, lon: 19.5 };

async function search(page: Page, ident: string) {
  await page.getByRole("button", { name: "Search", exact: true }).click();
  const panel = page.getByRole("dialog", { name: "Search", exact: true });
  await panel.getByRole("textbox").fill(ident);
  await panel.getByRole("button", { name: "Search", exact: true }).click();
}

test("runway sits beside airport actions; departure uses TODA without GPS and home arrival uses LDA", async ({
  page,
}) => {
  test.setTimeout(60000);
  const home = airports.find((a) => a.ident === "EPNT")!;
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => r.abort());
  await page.addInitScript(
    ({ flight, home }) => {
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
            phase: "taxiout",
            phaseManual: true,
            route: [home, { ident: "TURN", lat: 49.8, lon: 20.4 }, home],
            activeLeg: 0,
          },
        }),
      );
      navigator.geolocation.watchPosition = (_success, error) => {
        error?.({ code: 1, message: "denied" } as GeolocationPositionError);
        return 1;
      };
      navigator.geolocation.clearWatch = () => undefined;
    },
    {
      home,
      flight: {
        ...newFlight(),
        aircraftId: "R172K",
        departure: home,
        destination: home,
        fuel: { blockL: 100 },
        departureRunway: { airport: "EPNT", designator: "12", source: "taxi" },
      },
    },
  );
  await page.goto("/fly");
  await expect(page.getByTestId("map")).toHaveAttribute(
    "data-map-ready",
    "true",
    { timeout: 15000 },
  );
  await search(page, "EPNT");
  const card = page.getByTestId("airport-landing-card");
  await expect(card).toHaveAttribute("data-operation", "takeoff");
  await expect(card).toContainText("TODA USED");
  await expect(card.getByTestId("landing-distances")).toHaveText(
    /^\d+ m \/ \d+ m$/,
  );
  await expect(
    card.getByRole("combobox", { name: "Take-off runway" }),
  ).toContainText("12");
  const left = await page.getByTestId("airport-point-actions").boundingBox();
  const right = await card.boundingBox();
  expect(right!.x).toBeGreaterThanOrEqual(left!.x + left!.width);
  await page.screenshot({ path: "test-results/airport-toda-side-panel.png" });
  await selectFlightPhase(page, "Landing");
  await expect(card).toHaveAttribute("data-operation", "landing");
  await expect(card).toContainText("LDA USED");
  await expect(card).toContainText("A current position is needed");
  await expect(
    card.getByRole("combobox", { name: "Landing runway" }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(card).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("airport cards predict FPL or Direct arrival, show runway use, shortages and missing LDA", async ({
  page,
}) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => r.abort());
  await page.route("**/data/airports.json*", (r) =>
    r.fulfill({
      json: airports.map((a) =>
        a.ident === "EPML"
          ? {
              ...a,
              runways: a.runways.map((r) => ({
                ...r,
                ldaM: r.designator === "09" ? 100 : null,
              })),
            }
          : a,
      ),
    }),
  );
  await page.route("https://aviation.lab.vibecde.com/airports/EPKK/atis", (r) =>
    r.fulfill({
      json: {
        icao: "EPKK",
        sources: {},
        atis: [
          {
            kind: "arrival",
            source: "atis.guru",
            letter: "A",
            received_at: new Date().toISOString(),
            age_minutes: 0,
            stale: false,
            qnh_hpa: 1015,
            qnh_matches_metar: true,
            text: "EPKK ARR ATIS A. RWY 07. WIND 070 DEG, 5 KT. T 15, DP 5. QNH 1015.",
          },
        ],
      },
    }),
  );
  await page.addInitScript(
    ({ airport, start, corner, flight }) => {
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
            route: [start, corner, airport],
            activeLeg: 0,
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
              speed: (120 * 1852) / 3600,
              heading: 45,
            },
          } as GeolocationPosition);
        send();
        return window.setInterval(send, 1000);
      };
      navigator.geolocation.clearWatch = clearInterval;
    },
    {
      airport,
      start,
      corner,
      flight: {
        ...newFlight(),
        aircraftId: "R172K",
        departure: airports.find((a) => a.ident === "EPNT")!,
        destination: airport,
        fuel: { blockL: 100 },
      },
    },
  );
  await page.goto("/fly");
  await expect(page.getByTestId("map")).toHaveAttribute(
    "data-map-ready",
    "true",
    { timeout: 15000 },
  );
  await search(page, "EPKK");
  const card = page.getByTestId("airport-landing-card");
  await expect(card).toBeVisible();
  await expect(card.getByTestId("landing-arrival")).toContainText("Along FPL");
  await expect(
    card.getByRole("combobox", { name: "Landing runway", exact: true }),
  ).toContainText("07");
  await expect(card).toContainText("QNH 1015");
  await expect(card.getByTestId("landing-distances")).toHaveText(
    /^\d+ m \/ 2550 m$/,
  );
  await expect(card.getByTestId("landing-percent")).toHaveText(/^\d+\.\d%$/);
  await card.screenshot({ path: "test-results/airport-landing-fpl.png" });
  await page
    .getByRole("dialog", { name: "Details", exact: true })
    .getByRole("button", { name: "Close", exact: true })
    .click();
  await search(page, "EPML");
  await expect(card.getByTestId("landing-arrival")).toContainText(
    "Direct from present position",
  );
  await card.getByRole("combobox").click();
  await page.getByRole("option", { name: "RWY 09", exact: true }).click();
  await expect(card).toContainText(/\d+ m short/);
  await expect(card.getByTestId("landing-percent")).toHaveClass(
    /text-destructive/,
  );
  await card.getByRole("combobox").click();
  await page.getByRole("option", { name: "RWY 27", exact: true }).click();
  await expect(card).toContainText("Published LDA unavailable");
  await expect(card.getByTestId("landing-percent")).toHaveText("—");
  await page
    .getByRole("dialog", { name: "Details", exact: true })
    .getByRole("button", { name: "Close", exact: true })
    .click();
  const aircraftTile = page
    .getByRole("navigation", { name: "In flight", exact: true })
    .getByRole("button", { name: "Aircraft", exact: true });
  await aircraftTile.click();
  const aircraftPanel = page.getByRole("dialog", {
    name: "Aircraft",
    exact: true,
  });
  await expect(
    aircraftPanel.getByRole("combobox", { name: "Aircraft type", exact: true }),
  ).toContainText("R172K");
  await aircraftPanel.getByLabel("MTH", { exact: true }).fill("1234.5");
  await aircraftPanel.getByLabel("MTH", { exact: true }).blur();
  await aircraftPanel
    .getByRole("button", { name: "Close", exact: true })
    .click();
  await aircraftTile.click();
  await expect(aircraftPanel.getByLabel("MTH", { exact: true })).toHaveValue(
    "01234.50",
  );
  expect(errors).toEqual([]);
});
