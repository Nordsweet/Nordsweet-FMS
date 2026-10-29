import { expect, test } from "./test";
import { newFlight } from "../src/data/flight";
import { observeChimes, chimeNotes } from "./helpers/chimes";

test("C/TR entry warnings acknowledge one zone, record clearance, and re-arm for a later visit", async ({
  page,
}) => {
  test.setTimeout(90000);
  await observeChimes(page);
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => r.abort());
  const zone = (
    name: string,
    cls: string,
    west: number,
    east: number,
    active = true,
  ) => ({
    type: "Feature",
    bbox: [west, 49.99, east, 50.01],
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [west, 49.99],
          [east, 49.99],
          [east, 50.01],
          [west, 50.01],
          [west, 49.99],
        ],
      ],
    },
    properties: {
      name,
      class: cls,
      lower: "GND",
      upper: "FL095",
      active_now: active,
      activations: [],
      frequencies: [],
    },
  });
  await page.route("https://aviation.lab.vibecde.com/airspace**", (r) =>
    r.fulfill({
      json: {
        type: "FeatureCollection",
        features: [
          zone("TEST CLASS C", "C", 20.03, 20.08),
          zone("TR 165", "TR", 20.05, 20.1),
          zone("INACTIVE TR", "TR", 20.02, 20.1, false),
        ],
        sources: { test: "ok" },
      },
    }),
  );
  await page.addInitScript(
    (flight) => {
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
            activeLeg: 0,
          },
        }),
      );
      navigator.geolocation.watchPosition = (callback) => {
        const send = () =>
          callback({
            timestamp: Date.now(),
            coords: {
              latitude: 50,
              longitude: Number(
                localStorage.getItem("test.entry.lon") ?? 19.99,
              ),
              altitude: 1524,
              altitudeAccuracy: 5,
              accuracy: 5,
              speed: (120 * 1852) / 3600,
              heading: 90,
            },
          } as GeolocationPosition);
        send();
        return window.setInterval(send, 1000);
      };
      navigator.geolocation.clearWatch = (id) => clearInterval(id);
    },
    {
      ...newFlight(),
      departure: { ident: "A", lat: 50, lon: 19.9 },
      destination: { ident: "B", lat: 50, lon: 20.5 },
    },
  );
  await page.goto("/fly");
  const popups = page.getByTestId("airspace-entry-popup");
  await expect(popups).toHaveCount(2, { timeout: 30000 });
  const controlled = popups.filter({ hasText: "TEST CLASS C" });
  await expect(controlled).toContainText("Approaching");
  await page.keyboard.press("Shift");
  const initialNotes = await chimeNotes(page);
  await controlled
    .getByRole("button", { name: "I am Cleared to Enter", exact: true })
    .click();
  await expect(popups).toHaveCount(1);
  await expect(popups).toContainText("TR 165");
  await page.evaluate(() => localStorage.setItem("test.entry.lon", "20.04"));
  await expect(controlled).toHaveCount(0);
  await page.waitForTimeout(1500);
  await expect(controlled).toHaveCount(0);
  await page.evaluate(() => localStorage.setItem("test.entry.lon", "20.12"));
  await expect(popups).toHaveCount(0);
  await page.evaluate(() => localStorage.setItem("test.entry.lon", "19.99"));
  await expect(controlled).toHaveCount(1, { timeout: 15000 });
  await expect
    .poll(
      async () =>
        (await chimeNotes(page)).filter((note) => note === 587.33).length,
    )
    .toBeGreaterThan(initialNotes.filter((note) => note === 587.33).length);
  const notes = await chimeNotes(page);
  for (const [index, note] of notes.entries())
    if (note === 587.33) expect(notes[index - 1]).toBe(880);
  // GPS updates and a remount of the same visit must not chime again.
  const sounded = notes.filter((note) => note === 587.33);
  await page.waitForTimeout(1500);
  expect((await chimeNotes(page)).filter((note) => note === 587.33)).toEqual(
    sounded,
  );
  await page
    .getByRole("button", { name: "Notifications", exact: true })
    .click();
  const history = page.getByRole("dialog", {
    name: "Notifications",
    exact: true,
  });
  await expect(history).toContainText(
    "Pilot confirmed clearance to enter TEST CLASS C",
  );
  await expect(history).not.toContainText(
    "Pilot confirmed clearance to enter TR 165",
  );
});
