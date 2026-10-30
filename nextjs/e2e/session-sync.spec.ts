import {
  expect,
  test,
  type BrowserContext,
  type Page,
  type Route,
} from "@playwright/test";

import { stubSession } from "./test";
import { USER_DATA_ROUTES, userDataServer } from "./helpers/user-data-server";

type Item = {
  collection: string;
  id: string;
  rev: number;
  schema_version: number;
  deleted: boolean;
  updated_at: string;
  device_id: string;
  data: Record<string, unknown> | null;
  seq: number;
};

/** The Aviation API's /sync store in memory, shared by every browser context of a test. */
function syncServer() {
  const items = new Map<string, Item>();
  let seq = 0;
  const seen: { path: string; device: string; authorization: string }[] = [];
  const handle = async (route: Route) => {
    const request = route.request();
    const url = new URL(request.url());
    const headers = request.headers();
    const device = headers["x-device-id"] ?? "";
    seen.push({
      path: url.pathname,
      device,
      authorization: headers.authorization ?? "",
    });
    if (url.pathname === "/sync/stream")
      return route.fulfill({
        contentType: "text/event-stream",
        body: ": ping\n\n",
      });
    if (url.pathname === "/sync/changes") {
      const since = Number(url.searchParams.get("since"));
      const changed = [...items.values()].filter((i) => i.seq > since);
      return route.fulfill({
        json: { items: changed, cursor: Math.max(since, seq), has_more: false },
      });
    }
    const [, , , collection = "", id = ""] = url.pathname.split("/");
    const key = `${collection}/${id}`;
    const current = items.get(key);
    const body = request.postDataJSON() as {
      data: Record<string, unknown>;
      schema_version: number;
      base_rev: number;
    } | null;
    const baseRev = body
      ? body.base_rev
      : Number(url.searchParams.get("base_rev"));
    if ((current?.rev ?? 0) !== baseRev)
      return route.fulfill({
        status: 409,
        json: { detail: { message: "rev conflict", current: current ?? null } },
      });
    const item: Item = {
      collection,
      id,
      rev: baseRev + 1,
      schema_version: body?.schema_version ?? 1,
      deleted: request.method() === "DELETE",
      updated_at: new Date().toISOString(),
      device_id: device,
      data: body?.data ?? null,
      seq: ++seq,
    };
    items.set(key, item);
    return request.method() === "DELETE"
      ? route.fulfill({ status: 204 })
      : route.fulfill({
          json: { rev: item.rev, updated_at: item.updated_at, seq: item.seq },
        });
  };
  return { items, seen, handle };
}

/** A device of the pilot: `/sync` (draft, flight in progress) and the typed user-data routes (settings, flights, ...). */
async function device(
  context: BrowserContext,
  server: ReturnType<typeof syncServer>,
  data: ReturnType<typeof userDataServer>,
) {
  const page = await context.newPage();
  await stubSession(page);
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => route.abort());
  await page.route("https://aviation.lab.vibecde.com/sync/**", server.handle);
  await page.route(USER_DATA_ROUTES, data.handle);
  return page;
}

const homeAirport = (page: Page) =>
  page.getByLabel("Lotnisko macierzyste (ICAO)");

test("settings follow the pilot from one device to another", async ({
  browser,
}) => {
  const server = syncServer();
  const data = userDataServer();
  // Two contexts: separate storage, so separate devices of the same user.
  const phone = await device(await browser.newContext(), server, data);
  const ipad = await device(await browser.newContext(), server, data);

  await phone.goto("/settings");
  await homeAirport(phone).fill("EPWA");
  await expect.poll(() => data.server.settings?.home_airport_icao).toBe("EPWA");
  await expect(phone.getByTestId("session-sync")).toHaveAttribute(
    "data-state",
    "idle",
  );

  await ipad.goto("/settings");
  await expect(homeAirport(ipad)).toHaveValue("EPWA");

  // And back: the second device edits; the first picks it up when the pilot returns to it.
  await homeAirport(ipad).fill("EPKK");
  await expect.poll(() => data.server.settings?.home_airport_icao).toBe("EPKK");
  await phone.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(homeAirport(phone)).toHaveValue("EPKK", { timeout: 15_000 });

  // The session sync still runs beside it, one device id per browser.
  expect(new Set(server.seen.map((call) => call.device)).size).toBe(2);
  for (const call of server.seen) {
    expect(call.authorization).toBe("Bearer e2e-token");
    expect(call.device.length).toBeGreaterThanOrEqual(8);
  }
  for (const call of data.server.seen)
    expect(call.authorization).toBe("Bearer e2e-token");
  // Voices installed on a device never leave it.
  expect(JSON.stringify([...server.items.values()])).not.toContain(
    "checklistVoiceUris",
  );
  expect(JSON.stringify(data.server.settings)).not.toContain(
    "checklistVoiceUris",
  );
});

test("a device that is offline keeps its changes and sends them when the server is back", async ({
  browser,
}) => {
  const server = syncServer();
  const data = userDataServer();
  const page = await device(await browser.newContext(), server, data);
  data.server.down = true;
  await page.goto("/settings");
  await homeAirport(page).fill("EPGD");
  await expect(page.getByTestId("session-sync")).toHaveAttribute(
    "data-state",
    "offline",
  );
  await page.reload();
  await expect(homeAirport(page)).toHaveValue("EPGD");
  data.server.down = false;
  await expect
    .poll(() => data.server.settings?.home_airport_icao, { timeout: 30_000 })
    .toBe("EPGD");
});

test("tabs of one browser share the working copy and only one of them syncs", async ({
  browser,
}) => {
  const server = syncServer();
  const data = userDataServer();
  const context = await browser.newContext();
  const first = await device(context, server, data);
  const second = await device(context, server, data);
  await first.goto("/settings");
  await second.goto("/settings");
  await homeAirport(first).fill("EPPO");
  await expect(homeAirport(second)).toHaveValue("EPPO");
  await homeAirport(second).fill("EPLL");
  await expect(homeAirport(first)).toHaveValue("EPLL");
  await expect.poll(() => data.server.settings?.home_airport_icao).toBe("EPLL");
  expect(new Set(server.seen.map((call) => call.device)).size).toBe(1);
});
