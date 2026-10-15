import { expect, test } from "@playwright/test";
import { newFlight } from "../src/data/flight";
import { destinationPoint } from "../src/domain/geo";
import { flyByRoute } from "../src/domain/fly-by";

test("normal route sequences at fly-by entry and guides along the curved turn", async ({
  page,
}) => {
  const b = { ident: "BBBB", lat: 50, lon: 20 };
  const a = { ident: "AAAA", ...destinationPoint(b, 270, 10) };
  const c = { ident: "CCCC", ...destinationPoint(b, 180, 10) };
  const route = [a, b, c];
  const arc = flyByRoute(route, { tasKt: 100 }).turns.get(1)!;
  const initial = destinationPoint(b, 270, arc.entryNm + 0.1);
  const flight = {
    ...newFlight(),
    departure: a,
    destination: c,
    waypoints: [b],
    cruiseTasKt: 100,
  };
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (request) =>
    request.abort(),
  );
  await page.addInitScript(
    ({ flight, route, initial }) => {
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
            startedAt: "2026-10-15T12:00:00Z",
            route,
            activeLeg: 0,
            phase: "cruise",
            trafficPattern: null,
          },
        }),
      );
      const listeners = new Map<number, PositionCallback>();
      let id = 0;
      const sample = (p: { lat: number; lon: number }) =>
        ({
          coords: {
            latitude: p.lat,
            longitude: p.lon,
            altitude: 1000,
            accuracy: 5,
            altitudeAccuracy: 5,
            speed: (100 * 1852) / 3600,
            heading: 90,
          },
          timestamp: Date.now(),
        }) as GeolocationPosition;
      Object.defineProperty(navigator, "geolocation", {
        value: {
          watchPosition(callback: PositionCallback) {
            const key = ++id;
            listeners.set(key, callback);
            queueMicrotask(() => callback(sample(initial)));
            return key;
          },
          clearWatch(key: number) {
            listeners.delete(key);
          },
        },
      });
      Object.defineProperty(window, "moveTestFix", {
        value: (p: { lat: number; lon: number }) =>
          listeners.forEach((callback) => callback(sample(p))),
      });
    },
    { flight, route, initial },
  );
  await page.goto("/fly");
  await page.getByRole("button", { name: "Info", exact: true }).click();
  await expect(page.getByTestId("fly-next")).toHaveText("BBBB");
  await page.evaluate(
    (p) =>
      (
        window as unknown as {
          moveTestFix: (p: { lat: number; lon: number }) => void;
        }
      ).moveTestFix(p),
    arc.points[1]!,
  );
  await expect(page.getByTestId("fly-next")).toHaveText("CCCC");
  await expect(page.getByTestId("fly-xte")).toHaveText(/^0\.0 [LR]$/);
  await expect(page.getByTestId("turn-constraint")).toHaveCount(0);
});
