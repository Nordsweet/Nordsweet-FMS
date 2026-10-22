import { selectFlightPhase, expect, test } from "./test";
import { newFlight } from "../src/data/flight";
import { airportSchema } from "../src/data/schemas";
import airports from "../public/data/airports.json" with { type: "json" };
import {
  patternRunwayGeometry,
  trafficPatternGeometry,
} from "../src/domain/traffic-pattern";
import { type TrafficPattern } from "../src/data/traffic-pattern";
import { newTimers } from "../src/domain/flight-timers";

test("a round trip shows TOC/TOD and home-airport Arrival joins the circuit after the departure exit", async ({
  page,
}) => {
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => r.abort());
  const airport = airportSchema.parse(airports.find((a) => a.ident === "EPNT"));
  const runway = airport.runways[0]!;
  const pattern: TrafficPattern = {
    id: "departure",
    operation: "leave",
    airport,
    runway: { ...runway, ...patternRunwayGeometry(airport, runway)! },
    direction: "left",
    join: "downwind",
    altitudeAalFt: 1000,
    finalDistanceNm: 4,
    turnPerformance: { tasKt: 100 },
  };
  const prefix = trafficPatternGeometry(pattern).points;
  const waypoint = { ident: "TURN", lat: airport.lat + 0.4, lon: airport.lon };
  await page.addInitScript(
    ({ flight, route, activeLeg }) => {
      localStorage.setItem("nordsweet.language.v1", "en");
      if (!localStorage.getItem("nordsweet.flight.v2")) {
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
              phase: "climb",
              route,
              activeLeg,
              departurePattern: flight.departurePattern,
            },
          }),
        );
      }
    },
    {
      flight: {
        ...newFlight(),
        departure: airport,
        destination: airport,
        waypoints: [waypoint],
        departurePattern: pattern,
        cruiseAltitudeFt: 6000,
      },
      route: [...prefix, waypoint, airport],
      activeLeg: prefix.length - 1,
    },
  );
  await page.goto("/fly");
  await expect(page.locator('[data-profile-marker="TOC"]')).toBeVisible();
  await expect(page.locator('[data-profile-marker="TOD"]')).toBeVisible();
  await page.locator('[data-route-marker="EPNT"]').last().click();
  await expect(
    page.getByRole("button", { name: "Departure", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Arrival", exact: true }).click();
  await expect(
    page.getByRole("combobox", { name: "Join position", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("combobox", { name: "Leave traffic pattern", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Accept traffic pattern", exact: true })
    .click();
  const patterns = await page.evaluate(
    () =>
      (
        JSON.parse(localStorage.getItem("nordsweet.flight.v2")!) as {
          state: {
            flight: {
              departurePattern: TrafficPattern;
              trafficPattern: TrafficPattern;
            };
          };
        }
      ).state.flight,
  );
  expect(patterns.departurePattern.id).toBe("departure");
  expect(patterns.trafficPattern.operation).toBe("join");
});

test("FREDA confirmed fuel becomes the next prediction baseline and arrival with unknown terrain suppresses it", async ({
  page,
}) => {
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => r.abort());
  const now = new Date();
  await page.clock.install({ time: now });
  await page.clock.pauseAt(new Date(now.getTime() + 1000));
  const timers = newTimers();
  timers.airTime.startedAt = now.getTime() - 3_600_000;
  await page.addInitScript(
    ({ flight, timers }) => {
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
            route: [flight.departure, flight.destination],
            timers,
          },
        }),
      );
    },
    {
      flight: {
        ...newFlight(),
        aircraftId: "C152",
        fuelDisplayUnit: "L" as const,
        fuel: { blockL: 100 },
        departure: { ident: "EPKK", lat: 50.0778, lon: 19.7847 },
        destination: { ident: "EPNT", lat: 49.4628, lon: 20.0507 },
        cruiseAltitudeFt: 6000,
      },
      timers,
    },
  );
  await page.goto("/fly");
  await page.getByRole("button", { name: "Options", exact: true }).click();
  await page.getByRole("button", { name: "FREDA CHECK", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "FREDA", exact: true });
  const text = await dialog.textContent();
  const flow = Number(/(\d+) L\/h planned burn/.exec(text!)![1]);
  await dialog.getByLabel("Left tank [L]").fill("30");
  await dialog.getByLabel("Right tank [L]").fill("30");
  await dialog
    .getByRole("button", { name: "Complete FREDA check", exact: true })
    .click();
  await page.clock.fastForward(1_800_000);
  await expect(dialog).toBeVisible();
  const predicted = Number(
    /(\d+) L predicted/.exec((await dialog.textContent())!)![1],
  );
  expect(Math.abs(predicted - (60 - flow / 2))).toBeLessThanOrEqual(1);
  await dialog
    .getByRole("button", { name: "Close", exact: true })
    .first()
    .click();
  await selectFlightPhase(page, "Descent");
  const options = page.getByRole("button", { name: "Options", exact: true });
  if ((await options.getAttribute("aria-expanded")) !== "true")
    await options.click();
  await expect(
    page.getByRole("button", { name: "FREDA CHECK", exact: true }),
  ).toBeDisabled();
});
