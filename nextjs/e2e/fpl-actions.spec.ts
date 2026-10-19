import { expect, test, type Page } from "@playwright/test";
import { newFlight } from "../src/data/flight";
import { newTimers } from "../src/domain/flight-timers";

const route = [
  { ident: "AAAA", lat: 49.9, lon: 19.8 },
  { ident: "BBBB", lat: 50, lon: 19.8 },
  { ident: "CCCC", lat: 50.1, lon: 19.8 },
  { ident: "EPKK", lat: 50.0777, lon: 19.7848 },
];
async function seed(page: Page) {
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => r.abort());
  await page.addInitScript(
    ({ route, flight, timers }) => {
      localStorage.setItem("nordsweet.language.v1", "en");
      if (!localStorage.getItem("nordsweet.flight.v2"))
        localStorage.setItem(
          "nordsweet.flight.v2",
          JSON.stringify({ version: 1, state: { flight } }),
        );
      if (!localStorage.getItem("nordsweet.inflight.v1"))
        localStorage.setItem(
          "nordsweet.inflight.v1",
          JSON.stringify({
            version: 1,
            state: {
              route,
              activeLeg: 1,
              phase: "cruise",
              startedAt: new Date().toISOString(),
              timers,
            },
          }),
        );
      navigator.geolocation.watchPosition = (success) => {
        const sample = () =>
          success({
            timestamp: Date.now(),
            coords: {
              latitude: 50.04,
              longitude: 19.8,
              altitude: 914.4,
              speed: 100 / 1.943844,
              heading: 0,
              accuracy: 5,
              altitudeAccuracy: 5,
            },
          } as GeolocationPosition);
        sample();
        return window.setInterval(sample, 1000);
      };
      navigator.geolocation.clearWatch = (id) => window.clearInterval(id);
    },
    {
      route,
      flight: {
        ...newFlight(),
        departure: route[0],
        destination: route[3],
        waypoints: [route[1]!, route[2]!],
      },
      timers: newTimers(),
    },
  );
  await page.goto("/fly");
}
const active = (page: Page) =>
  page.evaluate(
    () =>
      (
        JSON.parse(localStorage.getItem("nordsweet.inflight.v1")!) as {
          state: {
            route: { ident: string; lat: number; lon: number }[];
            activeLeg: number;
            startedAt: string;
            routeHistory: {
              paths: unknown[][];
              lastPassed: { ident: string };
            } | null;
            divertAirport: string | null;
          };
        }
      ).state,
  );

test("every FPL row has red remove and white options; options open the existing point dialog and deletion persists", async ({
  page,
}, testInfo) => {
  await seed(page);
  await page.getByRole("button", { name: "FPL", exact: true }).click();
  const fpl = page.getByRole("dialog", { name: "FPL", exact: true });
  await expect(fpl.getByRole("listitem")).toHaveCount(4);
  for (const p of route) {
    await expect(
      fpl.getByRole("button", {
        name: `Remove ${p.ident} from route`,
        exact: true,
      }),
    ).toHaveClass(/text-red-500/);
    await expect(
      fpl.getByRole("button", {
        name: `Point options: ${p.ident}`,
        exact: true,
      }),
    ).toHaveClass(/text-white/);
  }
  await page.screenshot({
    path: testInfo.outputPath("fpl-actions-desktop.png"),
  });
  await page.setViewportSize({ width: 390, height: 844 });
  for (const p of route)
    expect(
      await fpl
        .getByText(p.ident, { exact: true })
        .evaluate((el) => el.scrollWidth <= el.clientWidth),
    ).toBe(true);
  const options = fpl.getByRole("button", {
    name: "Point options: CCCC",
    exact: true,
  });
  await options.scrollIntoViewIfNeeded();
  const box = (await options.boundingBox())!;
  expect(box.x + box.width).toBeLessThanOrEqual(390);
  await page.screenshot({ path: testInfo.outputPath("fpl-actions-phone.png") });
  await options.click();
  await expect(fpl).toHaveCount(0);
  const details = page.getByRole("dialog", { name: "Details", exact: true });
  await expect(details).toContainText("CCCC");
  await expect(
    details.getByRole("button", { name: "HOLD", exact: true }),
  ).toBeVisible();
  await details.getByRole("button", { name: "Close", exact: true }).click();
  await page.getByRole("button", { name: "FPL", exact: true }).click();
  await fpl
    .getByRole("button", { name: "Remove CCCC from route", exact: true })
    .click();
  await expect(
    fpl.getByRole("listitem").filter({ hasText: "CCCC" }),
  ).toHaveCount(0);
  await fpl
    .getByRole("button", { name: "Remove EPKK from route", exact: true })
    .click();
  await expect(fpl.getByRole("listitem")).toHaveCount(0);
  expect((await active(page)).routeHistory?.lastPassed.ident).toBe("BBBB");
  await page.reload();
  await page.getByRole("button", { name: "FPL", exact: true }).click();
  await expect(
    fpl.getByRole("listitem").filter({ hasText: "CCCC" }),
  ).toHaveCount(0);
});

test("Direct and Divert keep passed route geometry and its straight connector after reload", async ({
  page,
}) => {
  await seed(page);
  const before = await active(page);
  await page.getByRole("button", { name: "FPL", exact: true }).click();
  await page
    .getByRole("button", { name: "Point options: EPKK", exact: true })
    .click();
  const details = page.getByRole("dialog", { name: "Details", exact: true });
  await details
    .getByRole("button", { name: "Direct to…", exact: true })
    .click();
  await expect
    .poll(async () => (await active(page)).route.map((p) => p.ident))
    .toEqual(["DCT", "EPKK"]);
  const direct = await active(page);
  expect(direct.startedAt).toBe(before.startedAt);
  expect(direct.routeHistory?.lastPassed.ident).toBe("BBBB");
  expect(direct.routeHistory?.paths).toHaveLength(1);
  await expect(page.locator(".legacy-map")).toHaveAttribute(
    "data-route-history-paths",
    "2",
  );
  await details.getByRole("button", { name: "Divert", exact: true }).click();
  expect((await active(page)).routeHistory).toEqual(direct.routeHistory);
  expect((await active(page)).divertAirport).toBe("EPKK");
  await page.reload();
  await expect(page.locator(".legacy-map")).toHaveAttribute(
    "data-route-history-last-fix",
    "BBBB",
  );
  await expect(page.locator(".legacy-map")).toHaveAttribute(
    "data-route-history-paths",
    "2",
  );
  expect((await active(page)).routeHistory).toEqual(direct.routeHistory);
});
