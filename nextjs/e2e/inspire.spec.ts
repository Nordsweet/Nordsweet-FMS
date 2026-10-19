import { expect, test } from "@playwright/test";

import { type Flight } from "../src/data/flight";

const spot = (
  id: string,
  name: string,
  lat: number,
  lon: number,
  rest = {},
) => ({
  id,
  kind: "attraction",
  name,
  lat,
  lon,
  icao: null,
  interests: ["history"],
  summary: `${name} summary`,
  photo_url: null,
  page_url: "https://en.wikipedia.org/wiki/X",
  license: "CC BY-SA 4.0",
  distance_nm: null,
  ...rest,
});
const ideas = {
  spots: [
    spot("wawel", "Wawel Castle", 50.054, 19.935),
    spot("hel", "Hel Peninsula", 54.6, 18.8, {
      kind: "scenic",
      interests: ["coast"],
    }),
  ],
  routes: [
    {
      id: "baltic",
      name: "Baltic coast",
      interests: ["coast"],
      distance_nm: 90,
      stops: [
        {
          id: "epgd",
          name: "Gdańsk",
          lat: 54.3776,
          lon: 18.4662,
          icao: "EPGD",
        },
        { id: "hel", name: "Hel", lat: 54.6, lon: 18.8, icao: null },
        { id: "leba", name: "Łeba", lat: 54.74, lon: 17.4, icao: null },
      ],
    },
  ],
  sources: { wikipedia: "ok" },
};

test.beforeEach(async ({ page }) => {
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => route.abort());
  await page.route("https://aviation.lab.vibecde.com/inspiration*", (route) =>
    route.fulfill({ json: ideas }),
  );
  await page.addInitScript(() =>
    localStorage.setItem("nordsweet.language.v1", "en"),
  );
});

test("filters by interest, keeps favorites across reloads and says it is not a suitability check", async ({
  page,
}) => {
  await page.goto("/inspire");
  await expect(page.getByRole("note")).toContainText(
    "Nothing here checks weather",
  );
  await expect(page.getByTestId("inspire-spot-wawel")).toBeVisible();
  await expect(page.getByTestId("inspire-spot-hel")).toBeVisible();
  await expect(page.getByTestId("inspire-route-baltic")).toBeVisible();

  await page.getByRole("button", { name: "Coast", exact: true }).click();
  await expect(page.getByTestId("inspire-spot-wawel")).toHaveCount(0);
  await expect(page.getByTestId("inspire-spot-hel")).toBeVisible();

  await page
    .getByRole("button", { name: "Add Hel Peninsula to favorites" })
    .click();
  await page.reload();
  await page.getByRole("button", { name: "Favorites only" }).click();
  await expect(page.getByTestId("inspire-spot-hel")).toBeVisible();
  await expect(page.getByTestId("inspire-spot-wawel")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Remove Hel Peninsula from favorites" }),
  ).toHaveAttribute("aria-pressed", "true");
});

test("without a departure there is nothing to measure distance from", async ({
  page,
}) => {
  await page.goto("/inspire");
  await expect(page.getByText("Set a departure in the planner")).toBeVisible();
});

test("sets a destination and adds a whole route to the plan, asking before it replaces one", async ({
  page,
}) => {
  await page.goto("/inspire");
  await page
    .getByTestId("inspire-spot-wawel")
    .getByRole("button", { name: "Set as destination" })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "Added to the flight plan.",
  );

  page.once("dialog", (dialog) => {
    expect(dialog.message()).toContain("Replace the current departure");
    return dialog.dismiss();
  });
  await page.getByRole("button", { name: "Add route to planner" }).click();
  const stored = () =>
    page.evaluate(
      () =>
        (
          JSON.parse(localStorage.getItem("nordsweet.flight.v2")!) as {
            state: { flight: Flight };
          }
        ).state.flight,
    );
  expect((await stored()).destination?.ident).toBe("WAWEL");
  expect((await stored()).departure).toBeNull();

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Add route to planner" }).click();
  const flight = await stored();
  expect(flight.departure?.ident).toBe("EPGD");
  expect(flight.waypoints.map((p) => p.ident)).toEqual(["HEL"]);
  expect(flight.destination?.ident).toBe("LEBA");
  expect(flight.routeText).toBe("");

  // The new departure is the origin: Wawel is far from Gdańsk, Hel is close.
  await expect(page.getByText("Distances from EPGD.")).toBeVisible();
  await page.getByRole("combobox", { name: "Distance" }).click();
  await page.getByRole("option", { name: "Distance: up to 50 NM" }).click();
  await expect(page.getByTestId("inspire-spot-hel")).toBeVisible();
  await expect(page.getByTestId("inspire-spot-wawel")).toHaveCount(0);
});

test("the tab is in the navigation, in Polish too", async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem("nordsweet.language.v1", "pl"),
  );
  await page.goto("/");
  await page.getByRole("link", { name: "Zainspiruj mnie" }).click();
  await expect(page).toHaveURL(/\/inspire$/);
  await expect(
    page.getByRole("heading", { name: "Zainspiruj mnie" }),
  ).toBeVisible();
});
