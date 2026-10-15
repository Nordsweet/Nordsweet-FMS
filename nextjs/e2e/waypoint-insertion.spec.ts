import { expect, test, type Page } from "@playwright/test";

const a = { ident: "A", lat: 49, lon: 20 },
  b = { ident: "B", lat: 49.2, lon: 20 },
  c = { ident: "C", lat: 49.8, lon: 20 };
const draft = {
  id: "insertion",
  name: "Insertion",
  savedAt: "2026-10-14T09:00:00.000Z",
  aircraftId: null,
  departure: a,
  destination: c,
  alternate: null,
  waypoints: [b],
  routeText: "",
  sid: null,
  star: null,
  approach: null,
  cruiseAltitudeFt: 3000,
  cruiseTasKt: 120,
  fuel: { blockL: 0 },
  stationsKg: {},
};

test.beforeEach(async ({ page }) => {
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => route.abort());
  await page.addInitScript(() =>
    localStorage.setItem("nordsweet.language.v1", "en"),
  );
});
async function load(page: Page, flight: typeof draft) {
  await page.addInitScript((flight) => {
    if (!localStorage.getItem("nordsweet.flight.v2"))
      localStorage.setItem(
        "nordsweet.flight.v2",
        JSON.stringify({ version: 1, state: { flight } }),
      );
  }, flight);
}
async function add(page: Page) {
  await page.getByRole("button", { name: "Search", exact: true }).click();
  const search = page.getByRole("dialog", { name: "Search", exact: true });
  await search.getByRole("textbox").fill("KELEL");
  await search.getByRole("button", { name: "Search", exact: true }).click();
  await page
    .getByRole("dialog", { name: "Details", exact: true })
    .getByRole("button", { name: "Add waypoint", exact: true })
    .click();
  return page.getByRole("dialog", {
    name: "Flight Plan · Add KELEL",
    exact: true,
  });
}
const order = async (page: Page) =>
  page
    .locator("[data-insertion-row]")
    .evaluateAll((rows) =>
      rows.map((row) => row.getAttribute("data-insertion-row")),
    );

test("previews optimal insertion, allows before-row and move controls, and saves only on confirmation", async ({
  page,
}) => {
  await load(page, draft);
  await page.goto("/map");
  await expect(page.getByTestId("map")).toHaveAttribute(
    "data-map-ready",
    "true",
  );
  const dialog = await add(page);
  await expect(dialog).toContainText("Suggested position");
  expect(await order(page)).toEqual(["A", "B", "KELEL", "C"]);
  await expect(page.locator("[data-route-marker]")).toHaveText(["A", "B", "C"]);
  await dialog
    .getByRole("option", { name: "Insert before B", exact: true })
    .click();
  expect(await order(page)).toEqual(["A", "KELEL", "B", "C"]);
  await dialog.getByRole("button", { name: "Move down", exact: true }).click();
  expect(await order(page)).toEqual(["A", "B", "KELEL", "C"]);
  await dialog.getByRole("button", { name: "Move up", exact: true }).click();
  expect(await order(page)).toEqual(["A", "KELEL", "B", "C"]);
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(page.locator("[data-route-marker]")).toHaveText(["A", "B", "C"]);
  const reopened = await add(page);
  await reopened
    .getByRole("option", { name: "Insert before B", exact: true })
    .click();
  await reopened
    .getByRole("button", { name: "Insert here", exact: true })
    .click();
  await expect(page.locator("[data-route-marker]")).toHaveText([
    "A",
    "KELEL",
    "B",
    "C",
  ]);
  await expect(
    page.getByTestId("map-planner-points").getByRole("listitem"),
  ).toContainText(["A", "KELEL", "B", "C"]);
  await page.reload();
  await expect(page.locator("[data-route-marker]")).toHaveText([
    "A",
    "KELEL",
    "B",
    "C",
  ]);
});

test("airport-based FPL keeps a manual position in the derived route and after reload", async ({
  page,
}) => {
  await load(page, {
    ...draft,
    departure: { ident: "EPKK", lat: 50.077778, lon: 19.784722 },
    destination: { ident: "EPNT", lat: 49.462378, lon: 20.050147 },
    waypoints: [],
    routeText: "SKAVI",
  });
  await page.goto("/map");
  await expect(page.locator("[data-route-marker]")).toHaveText([
    "EPKK",
    "SKAVI",
    "EPNT",
  ]);
  const dialog = await add(page);
  await dialog
    .getByRole("option", { name: "Insert before SKAVI", exact: true })
    .click();
  await dialog
    .getByRole("button", { name: "Insert here", exact: true })
    .click();
  await expect(page.locator("[data-route-marker]")).toHaveText([
    "EPKK",
    "KELEL",
    "SKAVI",
    "EPNT",
  ]);
  await page.reload();
  await expect(page.locator("[data-route-marker]")).toHaveText([
    "EPKK",
    "KELEL",
    "SKAVI",
    "EPNT",
  ]);
  await page.locator('[data-route-marker="KELEL"]').click();
  await page
    .getByRole("dialog", { name: "Details", exact: true })
    .getByRole("button", { name: "Remove from route", exact: true })
    .click();
  await expect(page.locator("[data-route-marker]")).toHaveText([
    "EPKK",
    "SKAVI",
    "EPNT",
  ]);
  await page.reload();
  await expect(page.locator("[data-route-marker]")).toHaveText([
    "EPKK",
    "SKAVI",
    "EPNT",
  ]);
  await page.getByRole("link", { name: "Flight Planner", exact: true }).click();
  await page.getByRole("tab", { name: "Route", exact: true }).click();
  await expect(page.getByText("KELEL", { exact: true })).toHaveCount(0);
});

test("Insert here also updates the persisted active flight rather than only the planned draft", async ({
  page,
}) => {
  await load(page, draft);
  await page.addInitScript(
    (route) => {
      if (!localStorage.getItem("nordsweet.inflight.v1"))
        localStorage.setItem(
          "nordsweet.inflight.v1",
          JSON.stringify({
            version: 1,
            state: {
              startedAt: "2026-10-14T09:00:00.000Z",
              route,
              activeLeg: 0,
              phase: "cruise",
            },
          }),
        );
    },
    [a, b, c],
  );
  await page.goto("/fly");
  await expect(page.locator("[data-route-marker]")).toHaveText(["A", "B", "C"]);
  const dialog = await add(page);
  await dialog
    .getByRole("option", { name: "Insert before B", exact: true })
    .click();
  await dialog
    .getByRole("button", { name: "Insert here", exact: true })
    .click();
  await expect(page.locator("[data-route-marker]")).toHaveText([
    "A",
    "KELEL",
    "B",
    "C",
  ]);
  await page.reload();
  await expect(page.locator("[data-route-marker]")).toHaveText([
    "A",
    "KELEL",
    "B",
    "C",
  ]);
  const saved = await page.evaluate(
    () =>
      JSON.parse(localStorage.getItem("nordsweet.inflight.v1")!) as {
        state: { startedAt: string; activeLeg: number };
      },
  );
  expect(saved.state.startedAt).toBe("2026-10-14T09:00:00.000Z");
  expect(saved.state.activeLeg).toBe(0);
});

test("Remove from route updates the active flight and draft, survives reload and keeps flight progress", async ({
  page,
}) => {
  const otherB = { ...b, lat: 49.4 };
  await load(page, { ...draft, waypoints: [b, otherB] });
  await page.addInitScript(
    (route) => {
      if (!localStorage.getItem("nordsweet.inflight.v1"))
        localStorage.setItem(
          "nordsweet.inflight.v1",
          JSON.stringify({
            version: 1,
            state: {
              startedAt: "2026-10-14T09:00:00.000Z",
              route,
              activeLeg: 1,
              phase: "cruise",
            },
          }),
        );
    },
    [a, b, otherB, c],
  );
  await page.goto("/fly");
  await expect(page.locator("[data-route-marker]")).toHaveText([
    "A",
    "B",
    "B",
    "C",
  ]);
  await page.locator('[data-route-marker="B"]').first().click();
  await page
    .getByRole("dialog", { name: "Details", exact: true })
    .getByRole("button", { name: "Remove from route", exact: true })
    .click();
  await expect(page.locator("[data-route-marker]")).toHaveText(["A", "B", "C"]);
  await expect(
    page.getByRole("button", { name: "Remove from route", exact: true }),
  ).toHaveCount(0);
  await page.reload();
  await expect(page.locator("[data-route-marker]")).toHaveText(["A", "B", "C"]);
  const saved = await page.evaluate(() => ({
    active: JSON.parse(localStorage.getItem("nordsweet.inflight.v1")!) as {
      state: { startedAt: string; activeLeg: number; phase: string };
    },
    draft: JSON.parse(localStorage.getItem("nordsweet.flight.v2")!) as {
      state: { flight: { waypoints: { ident: string }[] } };
    },
  }));
  expect(saved.active.state.startedAt).toBe("2026-10-14T09:00:00.000Z");
  expect(saved.active.state.activeLeg).toBe(0);
  expect(saved.active.state.phase).toBe("cruise");
  expect(saved.draft.state.flight.waypoints).toEqual([otherB]);
});

test("an active-only waypoint can be removed without changing the draft endpoints", async ({
  page,
}) => {
  await load(page, { ...draft, waypoints: [] });
  await page.addInitScript(
    (route) => {
      if (!localStorage.getItem("nordsweet.inflight.v1"))
        localStorage.setItem(
          "nordsweet.inflight.v1",
          JSON.stringify({
            version: 1,
            state: {
              startedAt: "2026-10-14T09:00:00.000Z",
              route,
              activeLeg: 0,
              phase: "cruise",
            },
          }),
        );
    },
    [a, b, c],
  );
  await page.goto("/fly");
  await page.locator('[data-route-marker="B"]').click();
  await page
    .getByRole("dialog", { name: "Details", exact: true })
    .getByRole("button", { name: "Remove from route", exact: true })
    .click();
  await expect(page.locator("[data-route-marker]")).toHaveText(["A", "C"]);
  await page.reload();
  await expect(page.locator("[data-route-marker]")).toHaveText(["A", "C"]);
});
