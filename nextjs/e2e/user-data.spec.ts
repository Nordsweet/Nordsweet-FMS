import { expect, test, type BrowserContext, type Page } from "@playwright/test";

import { USER_DATA_ROUTES, userDataServer } from "./helpers/user-data-server";
import { stubSession } from "./test";

const flightList = (page: Page) =>
  page.getByRole("list", { name: "Saved flights list" });

/** One device of the pilot: its own storage (browser context), the typed user-data routes mocked. */
async function device(
  context: BrowserContext,
  data: ReturnType<typeof userDataServer>,
  seed?: () => void,
) {
  const page = await context.newPage();
  await stubSession(page);
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => route.abort());
  await page.route(USER_DATA_ROUTES, data.handle);
  await page.addInitScript(() => {
    if (!localStorage.getItem("nordsweet.settings.v2"))
      localStorage.setItem("nordsweet.language.v1", "en");
  });
  if (seed) await page.addInitScript(seed);
  return page;
}

const returnToTab = (page: Page) =>
  page.evaluate(() => window.dispatchEvent(new Event("focus")));

test("uploads what the browser holds once, then the server copy leads", async ({
  browser,
}) => {
  const data = userDataServer();
  const page = await device(await browser.newContext(), data, () => {
    if (localStorage.getItem("seeded")) return;
    localStorage.setItem("seeded", "1");
    localStorage.setItem(
      "nordsweet.customAircraft.v1",
      JSON.stringify([{ baseId: null, type: "OWN1", displayName: "Mine" }]),
    );
    localStorage.setItem(
      "nordsweet.inspiration.v1",
      JSON.stringify({ state: { favorites: ["spot-1"] }, version: 1 }),
    );
    localStorage.setItem(
      "nordsweet.aircraftState.v2",
      JSON.stringify({
        state: {
          states: {
            "SR20::SPABC": {
              fuelIndicationMode: "exact",
              mth: "120.5",
              fuelRemainingL: 33,
              fuelAddedL: null,
              fuelUsedL: null,
              updatedAt: 1_760_000_000_000,
            },
          },
          models: {},
        },
        version: 1,
      }),
    );
  });
  await page.goto("/settings");
  await expect.poll(() => data.server.imports.length).toBe(1);

  const [batch] = data.server.imports as {
    custom_aircraft: { id: string; document: { type: string } }[];
    airframe_states: Record<string, unknown>[];
    favorites: string[];
    settings: Record<string, unknown>;
  }[];
  expect(batch!.custom_aircraft).toHaveLength(1);
  expect(batch!.custom_aircraft[0]!.id).toMatch(/^[0-9a-f-]{36}$/); // minted, kept beside the draft
  expect(batch!.custom_aircraft[0]!.document.type).toBe("OWN1");
  expect(batch!.airframe_states).toEqual([
    {
      type: "SR20",
      registration: "SPABC",
      fuel_indication_mode: "exact",
      mth: 120.5, // text on the device, a number on the server
      fuel_remaining_l: 33,
      fuel_added_l: null,
      fuel_used_l: null,
      updated_at: "2025-10-09T08:53:20.000Z",
    },
  ]);
  expect(batch!.favorites).toEqual(["spot-1"]);
  expect(batch!.settings).toMatchObject({
    language: "en",
    home_airport_icao: null, // "" on the device
  });
  expect(JSON.stringify(batch!.settings)).not.toContain("checklistVoiceUris");

  // The server holds the airframe state now: nothing is sent a second time.
  const pulls = () =>
    data.server.seen.filter((call) => call.path === "/airframes").length;
  await expect.poll(pulls).toBeGreaterThan(0);
  const before = pulls();
  await page.reload();
  await expect.poll(pulls).toBeGreaterThan(before); // the sync ran again after the reload
  expect(data.server.imports).toHaveLength(1);
  expect(data.server.readings).toEqual([]);
});

test("a flight saved on one device appears on the other, and a delete follows", async ({
  browser,
}) => {
  const data = userDataServer();
  const phone = await device(await browser.newContext(), data);
  const ipad = await device(await browser.newContext(), data);

  await phone.goto("/");
  await phone.getByRole("tab", { name: "Saved flights", exact: true }).click();
  await phone
    .getByLabel("Import .nord")
    .setInputFiles("tests/fixtures/nord/P2006T0508261012.nord");
  await expect(flightList(phone)).toContainText("EPNT -> EPML");
  await expect.poll(() => data.server.collections.flights.size).toBe(1);
  const [row] = [...data.server.collections.flights.values()];
  expect(row).toMatchObject({ version: 1, deleted_at: null });
  expect(row!.document).toMatchObject({ id: row!.id });
  expect(String(row!.document!.name)).toContain("EPNT");

  await ipad.goto("/");
  await ipad.getByRole("tab", { name: "Saved flights", exact: true }).click();
  await expect(flightList(ipad)).toContainText("EPNT -> EPML");

  await phone
    .getByRole("list", { name: "Saved flights list" })
    .getByRole("button", { name: "Delete" })
    .first()
    .click();
  await expect
    .poll(() => data.server.collections.flights.get(row!.id)?.deleted_at)
    .not.toBeNull();
  expect(data.server.collections.flights.get(row!.id)).toMatchObject({
    version: 2,
    document: null,
  });
  await returnToTab(ipad);
  await expect(flightList(ipad)).not.toContainText("EPNT -> EPML", {
    timeout: 15_000,
  });
});

test("an airframe's engine hours follow the pilot to another device", async ({
  browser,
}) => {
  const data = userDataServer();
  const phone = await device(await browser.newContext(), data, () => {
    if (localStorage.getItem("seeded")) return;
    localStorage.setItem("seeded", "1");
    localStorage.setItem(
      "nordsweet.aircraftState.v2",
      JSON.stringify({
        state: {
          states: {
            "SR20::SPABC": {
              fuelIndicationMode: null,
              mth: "120.5",
              fuelRemainingL: 33,
              fuelAddedL: null,
              fuelUsedL: null,
              updatedAt: 1_760_000_000_000,
            },
          },
          models: {},
        },
        version: 1,
      }),
    );
  });
  await phone.goto("/settings");
  await expect.poll(() => data.server.airframes.size).toBe(1);

  const ipad = await device(await browser.newContext(), data);
  await ipad.goto("/settings");
  await expect
    .poll(() =>
      ipad.evaluate(() => localStorage.getItem("nordsweet.aircraftState.v2")),
    )
    .toContain('"mth":"00120.50"');
  const stored = JSON.parse(
    (await ipad.evaluate(() =>
      localStorage.getItem("nordsweet.aircraftState.v2"),
    ))!,
  ) as {
    state: { states: Record<string, { mth: string; fuelRemainingL: number }> };
  };
  expect(stored.state.states["SR20::SPABC"]).toMatchObject({
    mth: "00120.50", // the app's own MTH format
    fuelRemainingL: 33,
  });
});

test("lists finished flights from the server and deletes one with its track", async ({
  browser,
}) => {
  const data = userDataServer();
  const id = "2f6d7a52-8f55-4d9a-a1d0-6f2c9f0d9b11";
  data.server.logs.set(id, {
    id,
    aircraft_type: "P2006T",
    registration: "SPXYZ",
    started_at: "2026-10-20T10:00:00Z",
    ended_at: "2026-10-20T11:00:00Z",
    off_block_at: "2026-10-20T10:01:00Z",
    on_block_at: "2026-10-20T10:59:00Z",
    takeoff_at: "2026-10-20T10:05:00Z",
    landing_at: "2026-10-20T10:55:00Z",
    mth_before: 100.5,
    mth_after: 101.4,
    fuel_before_l: 120,
    fuel_after_l: 78,
  });
  data.server.tracks.set(id, [
    { lat: 50, lon: 19, altitudeFt: 1000, time: "2026-10-20T10:05:00Z" },
    { lat: 50.1, lon: 19, altitudeFt: 2500, time: "2026-10-20T10:25:00Z" },
  ]);
  const page = await device(await browser.newContext(), data);
  await page.goto("/history");

  const card = page.getByTestId("flight-log");
  await expect(card).toContainText("P2006T SPXYZ");
  await expect(card).toContainText("00:58"); // block time
  await expect(card).toContainText("00:50"); // air time
  await expect(card).toContainText("100.50 → 101.40");
  await expect(card).toContainText("2 points");

  await card.getByRole("button", { name: "Details" }).click();
  await expect(card).toContainText("up to 2500 ft");
  await expect(
    card.getByRole("button", { name: "Download GPX" }),
  ).toBeVisible();

  await card.getByRole("button", { name: "Delete" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Delete" })
    .click();
  await expect(page.getByText("No finished flights yet.")).toBeVisible();
  expect(data.server.logs.size).toBe(0);
  expect(data.server.tracks.size).toBe(0); // the track goes with the log
});

test("deletes all server data after the username is typed, and the device's copy with it", async ({
  browser,
}) => {
  const data = userDataServer();
  const page = await device(await browser.newContext(), data, () => {
    if (localStorage.getItem("seeded")) return;
    localStorage.setItem("seeded", "1");
    localStorage.setItem(
      "nordsweet.customAircraft.v1",
      JSON.stringify([{ baseId: null, type: "OWN1", displayName: "Mine" }]),
    );
  });
  await page.goto("/settings");
  await expect
    .poll(() => data.server.collections["aircraft/custom"].size)
    .toBe(1);

  await page.getByRole("button", { name: "Delete my server data" }).click();
  const dialog = page.getByTestId("delete-server-data");
  const submit = dialog.getByRole("button", { name: "Delete everything" });
  await expect(submit).toBeDisabled();
  await dialog.getByLabel("Username").fill("someone-else");
  await expect(submit).toBeDisabled();
  expect(data.server.deleted).toBe(false);
  await dialog.getByLabel("Username").fill("Admin");
  await submit.click();

  await expect(page.getByTestId("server-data-deleted")).toBeVisible();
  expect(data.server.deleted).toBe(true);
  // The device's copy went too: it would otherwise be uploaded again.
  expect(
    await page.evaluate(() =>
      localStorage.getItem("nordsweet.customAircraft.v1"),
    ),
  ).toBe("[]");
});
