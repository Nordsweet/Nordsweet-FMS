import { expect, test } from "./test";

test("server contact age counts real responses, goes stale with Wi-Fi online, recovers and resets on reload", async ({
  page,
  context,
}) => {
  test.setTimeout(60000);
  const now = new Date("2026-10-22T12:00:00Z");
  await page.clock.install({ time: now });
  await page.clock.pauseAt(now);
  let available = true;
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => r.abort());
  await page.route("https://aviation.lab.vibecde.com/**", (r) => {
    if (!available) return r.abort();
    const path = new URL(r.request().url()).pathname;
    if (path === "/auth/me")
      return r.fulfill({ json: { username: "admin", role: "admin" } });
    if (path === "/airports/EPKK/weather")
      return r.fulfill({
        json: { icao: "EPKK", metar: null, taf: null, sources: {} },
      });
    if (path === "/airports/EPKK/atis")
      return r.fulfill({ json: { icao: "EPKK", atis: [], sources: {} } });
    return r.abort();
  });
  await page.addInitScript(() => {
    localStorage.setItem("nordsweet.language.v1", "en");
    if (!localStorage.getItem("nordsweet.inflight.v1"))
      localStorage.setItem(
        "nordsweet.inflight.v1",
        JSON.stringify({
          version: 1,
          state: {
            startedAt: new Date().toISOString(),
            route: [
              { ident: "EPKK", lat: 50.07, lon: 19.78 },
              { ident: "EPNT", lat: 49.46, lon: 20.04 },
            ],
          },
        }),
      );
  });
  await page.goto("/fly");
  const status = page.getByTestId("server-connection");
  await expect(status).toHaveAttribute("data-state", "connected");
  await expect(status).toHaveText("0 s");
  available = false;
  await page.clock.fastForward(17000);
  await expect(status).toHaveText("17 s");
  await expect(status).toHaveAttribute(
    "title",
    /Last server contact: 17 s ago/,
  );
  await page.clock.fastForward(30000);
  expect(await page.evaluate(() => navigator.onLine)).toBe(true);
  await expect(status).toHaveAttribute("data-state", "stale");
  await expect(status).toHaveText("47 s");

  available = true;
  await page.getByRole("button", { name: "Search", exact: true }).click();
  const search = page.getByRole("dialog", { name: "Search", exact: true });
  await search.getByRole("textbox").fill("EPKK");
  await search.getByRole("button", { name: "Search", exact: true }).click();
  await page
    .getByRole("dialog", { name: "Details", exact: true })
    .getByRole("button", { name: "Weather", exact: true })
    .click();
  await expect(status).toHaveAttribute("data-state", "connected");
  await expect(status).toHaveText("0 s");

  available = false;
  await context.setOffline(true);
  await expect(status).toHaveAttribute("data-state", "offline");
  await page.clock.fastForward(5000);
  await expect(status).toHaveText("5 s");
  await context.setOffline(false);
  await page.reload();
  await expect(status).toHaveAttribute("data-state", "unknown");
  await expect(status).toHaveText("—");
});
