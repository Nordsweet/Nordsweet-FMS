import fs from "node:fs";
import { test, expect } from "./test";
import { newFlight } from "../src/data/flight";
import { airportSchema } from "../src/data/schemas";
const airports = JSON.parse(
  fs.readFileSync("public/data/airports.json", "utf8"),
) as { ident: string }[];
const airport = airportSchema.parse(airports.find((a) => a.ident === "EPBC"));
test("two touch and gos notify at minimum speed time and survive reload into logbook", async ({
  page,
}) => {
  test.setTimeout(120000);
  await page.addInitScript(
    ({ airport, plan }) => {
      localStorage.setItem("nordsweet.language.v1", "en");
      if (!localStorage.getItem("nordsweet.flight.v2"))
        localStorage.setItem(
          "nordsweet.flight.v2",
          JSON.stringify({ version: 1, state: { flight: plan } }),
        );
      Object.defineProperty(navigator, "geolocation", {
        configurable: true,
        value: {
          watchPosition: (cb: PositionCallback) => {
            (
              window as unknown as {
                touchSend: (agl: number, speed: number) => number;
              }
            ).touchSend = (agl, speed) => {
              const at = Date.now();
              cb({
                timestamp: at,
                coords: {
                  latitude: airport.lat,
                  longitude: airport.lon,
                  altitude: (airport.elevationFt + agl) * 0.3048,
                  altitudeAccuracy: 1,
                  accuracy: 1,
                  heading: 90,
                  speed: (speed * 1852) / 3600,
                },
              } as GeolocationPosition);
              return at;
            };
            return 1;
          },
          clearWatch: () => undefined,
        },
      });
    },
    {
      airport,
      plan: {
        ...newFlight(),
        registration: "SP-TGO",
        departure: { ident: "EPKK", lat: 50.08, lon: 19.78 },
        destination: airport,
      },
    },
  );

  await page.goto("/fly");

  await page.getByRole("button", { name: "Start flight", exact: true }).click();

  await page.getByRole("button", { name: "Options", exact: true }).click();

  await page.getByRole("button", { name: "TAKE-OFF", exact: true }).click();

  await page.reload();

  await expect(page.getByTestId("resume-flight")).toBeHidden();
  const send = async (agl: number, speed: number) => {
    await page.waitForFunction(
      () =>
        typeof (window as unknown as { touchSend?: unknown }).touchSend ===
        "function",
    );
    const at = await page.evaluate(
      ({ agl, speed }) =>
        (
          window as unknown as {
            touchSend: (agl: number, speed: number) => number;
          }
        ).touchSend(agl, speed),
      { agl, speed },
    );
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            (
              JSON.parse(localStorage.getItem("nordsweet.inflight.v1")!) as {
                state: { timers: { last: { at: number } | null } };
              }
            ).state.timers.last?.at,
        ),
      )
      .toBe(at);
    return at;
  };
  for (const number of [1, 2]) {
    await send(200, 80);
    await send(0, 70);
    const minimumAt = await send(0, 64);
    await send(0, 75);
    await send(101, 80);

    await expect(
      page
        .getByRole("status")
        .filter({ hasText: "#" + number + " Touch and go" }),
    ).toBeVisible();
    const event = await page.evaluate(() =>
      (
        JSON.parse(localStorage.getItem("nordsweet.inflight.v1")!) as {
          state: {
            timers: { events: { at: number; touchAndGoNumber?: number }[] };
          };
        }
      ).state.timers.events.at(-1),
    );
    expect(event).toMatchObject({ at: minimumAt, touchAndGoNumber: number });
    await page.reload();
    await expect(page.getByTestId("resume-flight")).toBeHidden();
  }
  await page.getByRole("button", { name: "Close flight", exact: true }).click();
  await page.goto("/logbook");
  const row = page.getByTestId("logbook-row").filter({ hasText: "SPTGO" });
  await expect(row.locator("td").nth(4)).toHaveText("2");
  await page.reload();
  await expect(page.getByTestId("resume-flight")).toBeHidden();
  await expect(row.locator("td").nth(4)).toHaveText("2");
});
