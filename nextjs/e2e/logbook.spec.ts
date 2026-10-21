import { test, expect } from "./test";
import { newFlight } from "../src/data/flight";
import { type LogbookEntry } from "../src/data/logbook";

test("Fly records a session, preserves edited PIC offline and loads account history on a fresh device", async ({
  page,
}) => {
  test.setTimeout(60000);
  const entries = new Map<string, LogbookEntry>();
  let summaries = 0;
  let offline = false;
  await page.route("**/flight-sync/sessions**", (r) =>
    r.fulfill({
      json: r.request().url().includes("?")
        ? { flights: [], hasMore: false }
        : null,
    }),
  );
  await page.route("**/flight-sync/logbook**", async (r) => {
    if (offline) return r.abort();
    expect(r.request().headers().authorization).toBe("Bearer e2e-token");
    if (r.request().method() === "GET")
      return r.fulfill({
        json: { entries: [...entries.values()], hasMore: false },
      });
    const parts = new URL(r.request().url()).pathname.split("/");
    if (parts.at(-1) === "pic") {
      const id = parts.at(-2)!;
      const body = r.request().postDataJSON() as { pic: string };
      entries.set(id, { ...entries.get(id)!, pic: body.pic });
      return r.fulfill({ json: body });
    }
    const body = r.request().postDataJSON() as LogbookEntry;
    summaries++;
    const saved = { ...body, pic: entries.get(body.id)?.pic ?? body.pic };
    entries.set(body.id, saved);
    return r.fulfill({ json: saved });
  });
  await page.addInitScript(
    (flight) => {
      localStorage.setItem("nordsweet.language.v1", "en");
      if (localStorage.getItem("logbook-seeded")) return;
      localStorage.setItem("logbook-seeded", "yes");
      localStorage.setItem(
        "nordsweet.flight.v2",
        JSON.stringify({ version: 1, state: { flight } }),
      );
      localStorage.setItem(
        "nordsweet.settings.v2",
        JSON.stringify({ version: 1, state: { pilotSurname: "Kowalski" } }),
      );
    },
    {
      ...newFlight(),
      registration: "SP-LOG",
      departure: { ident: "EPBC", lat: 52.27, lon: 20.91 },
      destination: { ident: "EPWA", lat: 52.17, lon: 20.97 },
    },
  );
  await page.goto("/fly");
  await page.getByRole("button", { name: "Start flight", exact: true }).click();
  await expect.poll(() => entries.size).toBe(1);
  expect([...entries.values()][0]?.pic).toBe("Kowalski");
  await page.goto("/logbook");
  const row = page.getByTestId("logbook-row");
  await expect(row).toContainText("SPLOG");
  await expect(row).toContainText("In progress");
  await expect(page.getByText(/Entries waiting to sync:/)).toHaveCount(0);
  const syncedSummaries = summaries;
  offline = true;
  await row.getByRole("button", { name: "Edit PIC" }).click();
  await page.getByLabel("PIC", { exact: true }).fill("Nowak");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.reload();
  await expect(row).toContainText("Nowak");
  offline = false;
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await expect
    .poll(() => [...entries.values()][0]?.pic, { timeout: 15000 })
    .toBe("Nowak");
  expect(summaries).toBe(syncedSummaries);
  await page.goto("/fly");
  await page.getByRole("button", { name: "Close flight", exact: true }).click();
  await expect.poll(() => [...entries.values()][0]?.endedAt).not.toBeNull();
  expect([...entries.values()][0]?.landingAt).toBeNull();
  expect([...entries.values()][0]?.onBlockAt).toBeNull();
  await page.goto("/logbook");
  await expect(row).toContainText("Ended");
  // Remove the local history: the account endpoint must restore the corrected entry.
  await page.evaluate(() => localStorage.removeItem("nordsweet.logbook.v1"));
  await page.reload();
  await expect(row).toContainText("Nowak");
  await expect(row).toHaveCount(1);
  await page.screenshot({
    path: "test-results/logbook-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(row).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/logbook-mobile.png",
    fullPage: true,
  });
});
