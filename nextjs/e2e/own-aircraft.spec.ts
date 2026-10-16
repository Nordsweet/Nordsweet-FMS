import { expect, test } from "@playwright/test";
import { newFlight } from "../src/data/flight";

test("map resolves the selected airframe registration, then switches to a newly typed registration", async ({
  page,
}) => {
  const lookups: string[] = [];
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => route.abort());
  await page.route("https://api.adsbdb.com/v0/aircraft/**", (route) => {
    const registration = decodeURIComponent(
      new URL(route.request().url()).pathname.split("/").at(-1)!,
    );
    lookups.push(registration);
    if (!["SP-RBB", "SP-GUN"].includes(registration))
      return route.fulfill({
        status: 404,
        json: { response: "unknown aircraft" },
      });
    return route.fulfill({
      json: {
        response: {
          aircraft: {
            registration,
            mode_s: registration === "SP-RBB" ? "48a001" : "48a002",
            icao_type: "C152",
          },
        },
      },
    });
  });
  await page.addInitScript(
    (flight) => {
      localStorage.setItem("nordsweet.language.v1", "en");
      if (!localStorage.getItem("nordsweet.flight.v2"))
        localStorage.setItem(
          "nordsweet.flight.v2",
          JSON.stringify({ version: 1, state: { flight } }),
        );
    },
    { ...newFlight(), aircraftId: "C152-SPRBB" },
  );
  await page.goto("/map");
  await expect.poll(() => lookups).toContain("SP-RBB");
  await page.goto("/");
  await page.locator("#aircraft-registration").fill("SP-GUN");
  await page.goto("/map");
  await expect.poll(() => lookups).toContain("SP-GUN");
});
