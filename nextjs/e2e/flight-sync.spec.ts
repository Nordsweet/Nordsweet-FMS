import { expect, test, type Page } from "@playwright/test";
import { stubSession } from "./test";
import { newFlight } from "../src/data/flight";
import {
  type ServerFlight,
  type FlightSnapshot,
} from "../src/data/flight-session";
import { type TrackPoint } from "../src/domain/track";

async function setup(page: Page) {
  let saved: ServerFlight | null = null;
  let offline = false;
  await stubSession(page);
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => r.abort());
  await page.route("**/flight-sync/sessions**", async (r) => {
    if (offline) return r.abort();
    expect(r.request().headers().authorization).toMatch(
      /^Bearer [a-f0-9]{64}$/,
    );
    if (r.request().method() === "GET") {
      if (r.request().url().endsWith("/sessions"))
        return r.fulfill({ json: saved?.ended ? null : saved });
      return saved
        ? r.fulfill({ json: saved })
        : r.fulfill({ status: 404, json: {} });
    }
    const body = r.request().postDataJSON() as {
      name: string;
      startedAt: string;
      registration: string;
      revision: number;
      offset: number;
      points: TrackPoint[];
      snapshot: FlightSnapshot;
      ended: boolean;
    };
    const id = r.request().url().split("/").at(-1)!;
    const track = [...(saved?.track ?? [])];
    if (!saved || body.revision > saved.revision) {
      expect(body.offset).toBe(track.length);
      track.push(...body.points);
      saved = { ...body, id, track, updatedAt: body.startedAt };
    }
    return r.fulfill({
      json: { revision: saved.revision, trackCount: saved.track.length },
    });
  });
  await page.clock.install({ time: new Date("2026-10-19T21:30:00Z") });
  await page.clock.pauseAt(new Date("2026-10-19T21:30:01Z"));
  await page.addInitScript(
    (flight) => {
      localStorage.setItem("nordsweet.language.v1", "en");
      if (!localStorage.getItem("sync-test-seeded")) {
        localStorage.setItem("sync-test-seeded", "yes");
        localStorage.setItem(
          "nordsweet.flight.v2",
          JSON.stringify({ version: 1, state: { flight } }),
        );
      }
      let lat = 50;
      navigator.geolocation.watchPosition = (success) => {
        const send = () => {
          lat += 0.003;
          success({
            timestamp: Date.now(),
            coords: {
              latitude: lat,
              longitude: 20,
              altitude: 1500,
              accuracy: 5,
              altitudeAccuracy: 5,
              speed: 50,
              heading: 0,
            },
          } as GeolocationPosition);
        };
        send();
        return window.setInterval(send, 5000);
      };
      navigator.geolocation.clearWatch = clearInterval;
    },
    {
      ...newFlight(),
      name: "Server recovery",
      registration: "SP-OKO",
      departure: { ident: "AAAA", lat: 50, lon: 20 },
      destination: { ident: "BBBB", lat: 52, lon: 20 },
    },
  );
  const advance = async () => {
    for (let i = 0; i < 4; i++) {
      await page.clock.fastForward(3000);
      await page.waitForTimeout(50);
    }
  };
  return {
    get saved() {
      return saved;
    },
    set offline(value: boolean) {
      offline = value;
    },
    advance,
  };
}

test("uploads track during flight and restores the server track after local flight data is lost", async ({
  page,
}) => {
  const cloud = await setup(page);
  await page.goto("/fly");
  await page.getByRole("button", { name: "Start flight", exact: true }).click();
  await cloud.advance();
  await expect
    .poll(() => cloud.saved?.track.length ?? 0)
    .toBeGreaterThanOrEqual(2);
  const downloaded = cloud.saved!.track;
  expect(cloud.saved!.name).toMatch(/^SPOKO\d{10}$/);
  // Remove after the old document's final pagehide flush, before the new app hydrates.
  await page.addInitScript(() => {
    if (!localStorage.getItem("lose-flight-once")) return;
    localStorage.removeItem("lose-flight-once");
    localStorage.removeItem("nordsweet.inflight.v1");
    localStorage.removeItem("nordsweet.flight.v2");
    const sync = JSON.parse(
      localStorage.getItem("nordsweet.flightSync.v1")!,
    ) as { state: { pending: unknown[]; upload: unknown } };
    sync.state.pending = [];
    sync.state.upload = null;
    localStorage.setItem("nordsweet.flightSync.v1", JSON.stringify(sync));
  });
  await page.evaluate(() => localStorage.setItem("lose-flight-once", "true"));
  await page.reload();
  const dialog = page.getByTestId("resume-flight");
  await expect(dialog).toContainText(cloud.saved!.name);
  await page.getByTestId("resume-flight-yes").click();
  await expect(dialog).toHaveCount(0);
  await expect
    .poll(async () =>
      page.evaluate((length) => {
        const s = JSON.parse(
          localStorage.getItem("nordsweet.inflight.v1")!,
        ) as { state: { track: TrackPoint[] } };
        return s.state.track.slice(0, length);
      }, downloaded.length),
    )
    .toEqual(downloaded);
  await expect(page.locator("canvas").first()).toBeVisible();
  await expect(page.getByTestId("map")).toHaveAttribute(
    "data-map-ready",
    "true",
  );
  await expect
    .poll(async () =>
      Number(await page.getByTestId("map").getAttribute("data-track-points")),
    )
    .toBeGreaterThanOrEqual(downloaded.length);
  const plan = await page.evaluate(
    () =>
      JSON.parse(localStorage.getItem("nordsweet.flight.v2")!) as {
        state: { flight: { registration: string; name: string } };
      },
  );
  expect(plan.state.flight.registration).toBe("SP-OKO");
  expect(plan.state.flight.name).toBe("Server recovery");
  await page.screenshot({ path: "test-results/flight-server-recovered.png" });
});

test("queues points offline, retries without duplicates and archives when continuation is declined", async ({
  page,
}) => {
  const cloud = await setup(page);
  await page.goto("/fly");
  await page.getByRole("button", { name: "Start flight", exact: true }).click();
  await cloud.advance();
  await expect
    .poll(() => cloud.saved?.track.length ?? 0)
    .toBeGreaterThanOrEqual(2);
  const count = cloud.saved!.track.length;
  cloud.offline = true;
  await cloud.advance();
  await expect(page.getByTestId("flight-sync-status")).toContainText("retry");
  expect(cloud.saved!.track.length).toBe(count);
  cloud.offline = false;
  await cloud.advance();
  await expect.poll(() => cloud.saved!.track.length).toBeGreaterThan(count);
  expect(new Set(cloud.saved!.track.map((p) => p.time)).size).toBe(
    cloud.saved!.track.length,
  );
  await page.reload();
  await expect(page.getByTestId("resume-flight")).toBeVisible();
  await page.getByRole("button", { name: "No, start a new flight" }).click();
  await cloud.advance();
  await expect.poll(() => cloud.saved!.ended).toBe(true);
  expect(cloud.saved!.track.length).toBeGreaterThanOrEqual(count);
  await page.reload();
  await expect(page.getByTestId("resume-flight")).toHaveCount(0);
});
