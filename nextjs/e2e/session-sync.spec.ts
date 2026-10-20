import {
  expect,
  test,
  type BrowserContext,
  type Page,
  type Route,
} from "@playwright/test";

import { stubSession } from "./test";

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

async function device(
  context: BrowserContext,
  server: ReturnType<typeof syncServer>,
) {
  const page = await context.newPage();
  await stubSession(page);
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => route.abort());
  await page.route("https://aviation.lab.vibecde.com/sync/**", server.handle);
  return page;
}

const homeAirport = (page: Page) =>
  page.getByLabel("Lotnisko macierzyste (ICAO)");

test("settings follow the pilot from one device to another", async ({
  browser,
}) => {
  const server = syncServer();
  // Two contexts: separate storage, so separate devices of the same user.
  const phone = await device(await browser.newContext(), server);
  const ipad = await device(await browser.newContext(), server);

  await phone.goto("/settings");
  await homeAirport(phone).fill("EPWA");
  await expect
    .poll(() => server.items.get("settings/main")?.data?.homeAirportIcao)
    .toBe("EPWA");
  await expect(phone.getByTestId("session-sync")).toHaveAttribute(
    "data-state",
    "idle",
  );

  await ipad.goto("/settings");
  await expect(homeAirport(ipad)).toHaveValue("EPWA");

  // And back: the second device edits, the first one picks it up on its next pull.
  await homeAirport(ipad).fill("EPKK");
  await expect
    .poll(() => server.items.get("settings/main")?.data?.homeAirportIcao)
    .toBe("EPKK");
  await expect(homeAirport(phone)).toHaveValue("EPKK", { timeout: 15_000 });

  const devices = new Set(server.seen.map((call) => call.device));
  expect(devices.size).toBe(2);
  for (const call of server.seen) {
    expect(call.authorization).toBe("Bearer e2e-token");
    expect(call.device.length).toBeGreaterThanOrEqual(8);
  }
  // Voices installed on a device never leave it.
  expect(JSON.stringify([...server.items.values()])).not.toContain(
    "checklistVoiceUris",
  );
});

test("a device that is offline keeps its changes and sends them when the server is back", async ({
  browser,
}) => {
  const server = syncServer();
  const page = await device(await browser.newContext(), server);
  let down = true;
  await page.route("https://aviation.lab.vibecde.com/sync/**", (route) =>
    down ? route.abort() : server.handle(route),
  );
  await page.goto("/settings");
  await homeAirport(page).fill("EPGD");
  await expect(page.getByTestId("session-sync")).toHaveAttribute(
    "data-state",
    "offline",
  );
  await page.reload();
  await expect(homeAirport(page)).toHaveValue("EPGD");
  down = false;
  await expect
    .poll(() => server.items.get("settings/main")?.data?.homeAirportIcao, {
      timeout: 15_000,
    })
    .toBe("EPGD");
});

test("tabs of one browser share the working copy and only one of them syncs", async ({
  browser,
}) => {
  const server = syncServer();
  const context = await browser.newContext();
  const first = await device(context, server);
  const second = await device(context, server);
  await first.goto("/settings");
  await second.goto("/settings");
  await homeAirport(first).fill("EPPO");
  await expect(homeAirport(second)).toHaveValue("EPPO");
  await homeAirport(second).fill("EPLL");
  await expect(homeAirport(first)).toHaveValue("EPLL");
  await expect
    .poll(() => server.items.get("settings/main")?.data?.homeAirportIcao)
    .toBe("EPLL");
  expect(new Set(server.seen.map((call) => call.device)).size).toBe(1);
  expect(server.items.get("settings/main")?.rev).toBeLessThanOrEqual(3);
});
