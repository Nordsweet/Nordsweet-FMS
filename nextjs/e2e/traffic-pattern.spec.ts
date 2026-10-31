import fs from "node:fs";
import { selectFlightPhase, test, expect, type Page } from "./test";
import { airportSchema } from "../src/data/schemas";
import { newFlight, type Flight } from "../src/data/flight";
import {
  trafficPatternGeometry,
  patternRunwayGeometry,
} from "../src/domain/traffic-pattern";
import { type TrafficPattern } from "../src/data/traffic-pattern";
import { destinationPoint, distanceNm } from "../src/domain/geo";
import { flyByRoute } from "../src/domain/fly-by";
import { settleStorage } from "./helpers/storage";
const raw = JSON.parse(
  fs.readFileSync("public/data/airports.json", "utf8"),
) as { ident: string }[];
const airport = airportSchema.parse(raw.find((a) => a.ident === "EPNT"));
const departure = airportSchema.parse(raw.find((a) => a.ident === "EPKK"));
const runway = airport.runways.find((r) => r.designator === "30")!;
const geometry = patternRunwayGeometry(airport, runway)!;
const pattern: TrafficPattern = {
  id: "e2e-pattern",
  airport,
  runway: {
    ...runway,
    threshold: geometry.threshold,
    departureEnd: geometry.departureEnd,
  },
  direction: "left",
  join: "downwind",
  altitudeAalFt: 1000,
  finalDistanceNm: 2,
};
async function mocks(
  page: Page,
  atis = true,
  flight: Flight = {
    ...newFlight(),
    aircraftId: "P2006T",
    departure,
    destination: airport,
  },
) {
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => route.abort());
  await page.route("https://aviation.lab.vibecde.com/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/weather"))
      return route.fulfill({
        json: {
          icao: "EPNT",
          metar: {
            raw: "EPNT 151200Z 12010KT 9999 SKC 15/10 Q1013",
            observed_at: new Date().toISOString(),
            age_minutes: 0,
            stale: false,
            status: "confirmed",
            sources: [],
            disagreeing: {},
          },
          taf: null,
          sources: {},
        },
      });
    if (path.endsWith("/atis"))
      return route.fulfill({
        json: {
          icao: "EPNT",
          atis: atis
            ? [
                {
                  kind: "arrival",
                  letter: "A",
                  received_at: new Date().toISOString(),
                  age_minutes: 0,
                  stale: false,
                  qnh_hpa: 1013,
                  qnh_matches_metar: true,
                  text: "LANDING RUNWAY 30",
                  fields: { runway: "30" },
                  source: "atis.guru",
                },
              ]
            : [],
          sources: {},
        },
      });
    return route.fulfill({ json: { places: [], sources: {} } });
  });
  await page.addInitScript((flight) => {
    localStorage.setItem("nordsweet.language.v1", "en");
    if (!localStorage.getItem("nordsweet.flight.v2"))
      localStorage.setItem(
        "nordsweet.flight.v2",
        JSON.stringify({ version: 1, state: { flight } }),
      );
  }, flight);
}

for (const [join, direction, label, direct] of [
  ["downwind", "left", "Downwind", false],
  ["crosswind", "right", "Crosswind", false],
  ["downwind", "right", "Downwind", true],
] as const) {
  test(`Mielec ${direction} ${label}${direct ? " from EPKC at 100 KIAS" : ""} has smooth turns in preview, accepted route and reload`, async ({
    page,
  }, testInfo) => {
    test.setTimeout(60_000);
    await page.setViewportSize({ width: 1440, height: 1000 });
    const mielec = airportSchema.parse(raw.find((a) => a.ident === "EPML"));
    const runway = mielec.runways.find((r) => r.designator === "09")!;
    const runwayGeometry = patternRunwayGeometry(mielec, runway)!;
    const sample: TrafficPattern = {
      ...pattern,
      airport: mielec,
      runway: { ...runway, ...runwayGeometry },
      join,
      direction,
      turnPerformance: { tasKt: 100 },
    };
    const start = trafficPatternGeometry(sample).positions[join];
    const inbound = { ident: "INBOUND", ...destinationPoint(start, 255, 20) };
    await mocks(page, false, {
      ...newFlight(),
      aircraftId: "P2006T",
      departure: direct
        ? airportSchema.parse(raw.find((a) => a.ident === "EPKC"))
        : departure,
      destination: mielec,
      waypoints: direct ? [] : [inbound],
      cruiseTasKt: direct ? 100 : 120,
    });
    await page.route("**/EPML/weather", (r) =>
      r.fulfill({
        json: { icao: "EPML", metar: null, taf: null, sources: {} },
      }),
    );
    await page.goto("/map");
    const panel = await open(page, "EPML");
    await choose(
      page,
      "Pattern direction",
      direction === "right" ? "Right" : "Left",
    );
    await choose(page, "Join position", label);
    await expect(page.locator("[data-pattern-preview='true']")).toBeVisible();
    await expect(page.getByTestId("turn-constraint")).toHaveCount(0);
    for (let i = 0; i < 2; i++)
      await page.getByRole("button", { name: "Zoom in", exact: true }).click();
    await page.getByRole("button", { name: "Layers", exact: true }).click();
    await page.screenshot({
      path: testInfo.outputPath(`mielec-${join}-preview.png`),
    });
    await panel
      .getByRole("button", { name: "Accept traffic pattern", exact: true })
      .click();
    const accepted = await savedPattern(page);
    expect(accepted?.airport.ident).toBe("EPML");
    expect(accepted?.join).toBe(join);
    expect(accepted?.direction).toBe(direction);
    await expect(page.getByTestId("map-planner-points")).toContainText(
      "TPJ1/EPML",
    );
    await expect(
      page.getByRole("dialog", { name: "Details", exact: true }),
    ).toBeHidden();
    await page.screenshot({
      path: testInfo.outputPath(`mielec-${join}-accepted.png`),
    });
    await page.reload();
    expect(await savedPattern(page)).toEqual(accepted);
    await expect(page.getByTestId("map-planner-points")).toContainText(
      "TPJ1/EPML",
    );
    await expect(page.getByTestId("turn-constraint")).toHaveCount(0);
    const reopened = await open(page, "EPML");
    await expect(
      reopened.getByRole("combobox", { name: "Join position", exact: true }),
    ).toHaveText(label);
  });
}
async function open(
  page: Page,
  code = "EPNT",
  action: "Departure" | "Arrival" = "Arrival",
) {
  await page.getByRole("button", { name: "Search", exact: true }).click();
  const search = page.getByRole("dialog", { name: "Search", exact: true });
  await search.getByRole("textbox").fill(code);
  await search.getByRole("button", { name: "Search", exact: true }).click();
  const details = page.getByRole("dialog", { name: "Details", exact: true });
  await details.getByRole("button", { name: action, exact: true }).click();
  return details.getByRole("region", { name: "Traffic Pattern", exact: true });
}
async function choose(page: Page, label: string, option: string) {
  await page.getByRole("combobox", { name: label, exact: true }).click();
  await page.getByRole("option", { name: option, exact: true }).click();
}
const savedPattern = (page: Page) =>
  page.evaluate(
    () =>
      (
        JSON.parse(localStorage.getItem("nordsweet.flight.v2")!) as {
          state: { flight: { trafficPattern: TrafficPattern | null } };
        }
      ).state.flight.trafficPattern,
  );

test("departure offers Leave, ignores circuit altitude, and coexists with the arrival pattern", async ({
  page,
}, testInfo) => {
  test.setTimeout(60000);
  await mocks(page);
  await page.goto("/map");
  const panel = await open(page, "EPKK", "Departure");
  await expect(
    panel.getByRole("combobox", { name: "Leave traffic pattern", exact: true }),
  ).toBeVisible();
  await expect(
    panel.getByRole("combobox", { name: "Join position", exact: true }),
  ).toHaveCount(0);
  await expect(
    panel.getByRole("spinbutton", {
      name: "Pattern altitude (ft above airfield)",
      exact: true,
    }),
  ).toHaveCount(0);
  await choose(page, "Runway", "RWY 25");
  await choose(page, "Pattern direction", "Right");
  await choose(page, "Leave traffic pattern", "Downwind");
  await expect(page.getByTestId("turn-constraint")).toHaveCount(0);
  await panel
    .getByRole("button", { name: "Accept traffic pattern", exact: true })
    .click();
  const saved = () =>
    page.evaluate(
      () =>
        (
          JSON.parse(localStorage.getItem("nordsweet.flight.v2")!) as {
            state: {
              flight: {
                departurePattern: TrafficPattern | null;
                trafficPattern: TrafficPattern | null;
                destination: { ident: string };
              };
            };
          }
        ).state.flight,
    );
  expect((await saved()).departurePattern).toMatchObject({
    operation: "leave",
    join: "downwind",
    direction: "right",
    airport: { ident: "EPKK" },
  });
  expect((await saved()).destination.ident).toBe("EPNT");
  await expect(page.getByTestId("turn-constraint")).toHaveCount(0);
  for (let i = 0; i < 8; i++)
    await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  await page.getByRole("button", { name: "Layers", exact: true }).click();
  await page.screenshot({
    path: testInfo.outputPath("right-downwind-departure.png"),
  });
  const arrival = await open(page);
  await expect(
    arrival.getByRole("combobox", { name: "Join position", exact: true }),
  ).toBeVisible();
  await arrival
    .getByRole("button", { name: "Accept traffic pattern", exact: true })
    .click();
  await page.reload();
  expect((await saved()).departurePattern?.operation).toBe("leave");
  expect((await saved()).trafficPattern?.airport.ident).toBe("EPNT");
  const departure = await open(page, "EPKK", "Departure");
  await departure
    .getByRole("button", { name: "Remove traffic pattern", exact: true })
    .click();
  expect((await saved()).departurePattern).toBeNull();
  expect((await saved()).trafficPattern?.airport.ident).toBe("EPNT");
});

for (const active of [false, true]) {
  test(`same-airport Departure and Arrival are independent ${active ? "during taxi-out" : "in the planner"}`, async ({
    page,
  }) => {
    test.setTimeout(90000);
    const waypoint = {
      ident: "TURN",
      lat: airport.lat + 0.4,
      lon: airport.lon,
    };
    const flight = {
      ...newFlight(),
      departure: airport,
      destination: airport,
      waypoints: [waypoint],
    };
    await mocks(page, true, flight);
    if (active) {
      await page.addInitScript(
        ({ airport, waypoint }) => {
          if (!localStorage.getItem("nordsweet.inflight.v1"))
            localStorage.setItem(
              "nordsweet.inflight.v1",
              JSON.stringify({
                version: 1,
                state: {
                  startedAt: new Date().toISOString(),
                  phase: "taxiout",
                  route: [airport, waypoint, airport],
                  activeLeg: 0,
                },
              }),
            );
        },
        { airport, waypoint },
      );
    }
    const saved = async () => {
      await settleStorage(page);
      return page.evaluate(() => {
        const flight = (
          JSON.parse(localStorage.getItem("nordsweet.flight.v2")!) as {
            state: { flight: Flight };
          }
        ).state.flight;
        const navigation = (
          JSON.parse(
            localStorage.getItem("nordsweet.inflight.v1") ?? "null",
          ) as {
            state: { route: { ident: string; patternOperation?: string }[] };
          } | null
        )?.state;
        return { flight, route: navigation?.route };
      });
    };
    await page.goto(active ? "/fly" : "/map");
    const departurePanel = await open(page, "EPNT", "Departure");
    await expect(
      departurePanel.getByRole("combobox", {
        name: "Leave traffic pattern",
        exact: true,
      }),
    ).toBeVisible();
    const details = page.getByRole("dialog", { name: "Details", exact: true });
    await details.getByRole("button", { name: "Arrival", exact: true }).click();
    await expect(
      details.getByRole("combobox", { name: "Join position", exact: true }),
    ).toBeVisible();
    await expect(
      details.getByRole("combobox", {
        name: "Leave traffic pattern",
        exact: true,
      }),
    ).toHaveCount(0);
    expect((await saved()).flight.departurePattern).toBeNull();
    expect((await saved()).flight.trafficPattern).toBeNull();
    await details
      .getByRole("button", { name: "Departure", exact: true })
      .click();
    await departurePanel
      .getByRole("button", { name: "Accept traffic pattern", exact: true })
      .click();
    const departurePattern = (await saved()).flight.departurePattern;
    expect(departurePattern?.operation).toBe("leave");

    const arrivalPanel = await open(page, "EPNT", "Arrival");
    await expect(
      arrivalPanel.getByRole("combobox", {
        name: "Join position",
        exact: true,
      }),
    ).toBeVisible();
    await arrivalPanel
      .getByRole("button", { name: "Accept traffic pattern", exact: true })
      .click();
    expect((await saved()).flight.departurePattern).toEqual(departurePattern);
    expect((await saved()).flight.trafficPattern?.operation).toBe("join");
    await page.reload();
    await open(page, "EPNT", "Arrival");
    await arrivalPanel
      .getByRole("button", { name: "Remove traffic pattern", exact: true })
      .click();
    let state = await saved();
    expect(state.flight.trafficPattern).toBeNull();
    expect(state.flight.departurePattern).toEqual(departurePattern);
    if (active) {
      expect(state.route?.some((p) => p.patternOperation === "leave")).toBe(
        true,
      );
      expect(state.route?.some((p) => p.patternOperation === "join")).toBe(
        false,
      );
      expect(state.route?.at(-1)?.ident).toBe("EPNT");
    }

    await open(page, "EPNT", "Arrival");
    await arrivalPanel
      .getByRole("button", { name: "Accept traffic pattern", exact: true })
      .click();
    const arrivalPattern = (await saved()).flight.trafficPattern;
    await open(page, "EPNT", "Departure");
    await departurePanel
      .getByRole("button", { name: "Remove traffic pattern", exact: true })
      .click();
    state = await saved();
    expect(state.flight.departurePattern).toBeNull();
    expect(state.flight.trafficPattern).toEqual(arrivalPattern);
    if (active) {
      expect(state.route?.some((p) => p.patternOperation === "leave")).toBe(
        false,
      );
      expect(state.route?.some((p) => p.patternOperation === "join")).toBe(
        true,
      );
      expect(state.route?.at(-1)?.ident).toBe("EPNT");
    }
  });
}

test("departure Straight-out replaces Final, exits before the first turn and survives reload", async ({
  page,
}) => {
  test.setTimeout(60000);
  await mocks(page);
  await page.goto("/map");
  const panel = await open(page, "EPKK", "Departure");
  await choose(page, "Runway", "RWY 25");
  await page
    .getByRole("combobox", { name: "Leave traffic pattern", exact: true })
    .click();
  await expect(
    page.getByRole("option", { name: "Final", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("option", { name: "Straight-out", exact: true }).click();
  await expect(
    panel.getByRole("combobox", { name: "Final distance", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByTestId("turn-constraint")).toHaveCount(0);
  await panel
    .getByRole("button", { name: "Accept traffic pattern", exact: true })
    .click();
  const stored = await page.evaluate(() => {
    const value = JSON.parse(localStorage.getItem("nordsweet.flight.v2")!) as {
      state: { flight: { departurePattern: TrafficPattern } };
    };
    return value.state.flight.departurePattern;
  });
  expect(stored).toMatchObject({
    operation: "leave",
    join: "final",
    runway: { designator: "25" },
  });
  expect(trafficPatternGeometry(stored).points).toHaveLength(2);
  await expect(page.getByTestId("map-planner-points")).toContainText(
    "TPD1/EPKK",
  );
  await expect(page.getByTestId("map-planner-points")).not.toContainText(
    "TPD2/EPKK",
  );
  await page.reload();
  const reopened = await open(page, "EPKK", "Departure");
  await expect(
    reopened.getByRole("combobox", {
      name: "Leave traffic pattern",
      exact: true,
    }),
  ).toHaveText("Straight-out");
  const arrival = await open(page);
  await choose(page, "Join position", "Final");
  await expect(
    arrival.getByRole("combobox", { name: "Final distance", exact: true }),
  ).toBeVisible();
});

test("Overhead departure completes the circuit before runway overflight and survives reload", async ({
  page,
}, testInfo) => {
  test.setTimeout(60000);
  await mocks(page);
  await page.goto("/map");
  const panel = await open(page, "EPKK", "Departure");
  await choose(page, "Runway", "RWY 25");
  await choose(page, "Pattern direction", "Right");
  await choose(page, "Leave traffic pattern", "Overhead");
  await expect(page.getByTestId("turn-constraint")).toHaveCount(0);
  await panel
    .getByRole("button", { name: "Accept traffic pattern", exact: true })
    .click();
  await expect(page.getByTestId("turn-constraint")).toHaveCount(0);
  await page.goto("/fly");
  await page.getByRole("button", { name: "Start flight", exact: true }).click();
  await page.getByRole("button", { name: "FPL", exact: true }).click();
  const fpl = page.getByRole("dialog", { name: "FPL", exact: true });
  for (const leg of [
    "TPD1/EPKK",
    "TPD2/EPKK",
    "TPD3/EPKK",
    "TPD4/EPKK",
    "TPD5/EPKK",
  ])
    await expect(fpl.getByText(leg, { exact: true })).toBeVisible();
  await page.goto("/map");
  for (let i = 0; i < 8; i++)
    await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  await page.getByRole("button", { name: "Layers", exact: true }).click();
  await page.screenshot({
    path: testInfo.outputPath("overhead-full-circuit.png"),
  });
  await page.reload();
  await page.goto("/fly");
  await page.getByRole("button", { name: "FPL", exact: true }).click();
  await expect(fpl.getByText("TPD5/EPKK", { exact: true })).toBeVisible();
  await expect(page.getByTestId("turn-constraint")).toHaveCount(0);
});

test("automatic departure circuit follows Take-off then Taxi-out runway selections", async ({
  page,
}) => {
  test.setTimeout(60000);
  await mocks(page);
  await page.addInitScript(
    ({ departure, airport }) => {
      if (!localStorage.getItem("nordsweet.inflight.v1"))
        localStorage.setItem(
          "nordsweet.inflight.v1",
          JSON.stringify({
            version: 1,
            state: {
              startedAt: "2026-10-16T00:00:00Z",
              phase: "taxiout",
              route: [departure, airport],
              activeLeg: 0,
            },
          }),
        );
    },
    { departure, airport },
  );
  await page.goto("/fly");
  await selectFlightPhase(page, "Take-off");
  await page.getByRole("button", { name: "RWY", exact: true }).click();
  await page
    .getByTestId("perf-takeoff")
    .getByRole("combobox", { name: "Runway", exact: true })
    .click();
  await page.getByRole("option", { name: /^07\s/ }).click();
  await page.goto("/map");
  const panel = await open(page, "EPKK", "Departure");
  await expect(
    panel.getByRole("combobox", { name: "Runway", exact: true }),
  ).toContainText("07 · Take-off");
  await panel
    .getByRole("button", { name: "Accept traffic pattern", exact: true })
    .click();
  await page.goto("/fly");
  await selectFlightPhase(page, "Taxi-Out");
  await page.getByRole("button", { name: "TAXI", exact: true }).click();
  await page
    .getByTestId("taxi-departure")
    .getByRole("combobox", { name: "To", exact: true })
    .click();
  await page.getByRole("option", { name: "HP25", exact: true }).click();
  await page.goto("/map");
  const updated = await open(page, "EPKK", "Departure");
  await expect(
    updated.getByRole("combobox", { name: "Runway", exact: true }),
  ).toContainText("25 · Taxi-out");
  await choose(page, "Runway", "RWY 07");
  await updated
    .getByRole("button", { name: "Accept traffic pattern", exact: true })
    .click();
  await page.reload();
  const manual = await open(page, "EPKK", "Departure");
  await expect(
    manual.getByRole("combobox", { name: "Runway", exact: true }),
  ).toContainText("RWY 07");
});

test("previews defaults without editing the FPL; ATIS wins over wind, Custom Final persists after acceptance", async ({
  page,
}, testInfo) => {
  await mocks(page);
  await page.goto("/map");
  const panel = await open(page);
  await expect(
    panel.getByRole("combobox", { name: "Runway", exact: true }),
  ).toContainText("30 · ATIS");
  await expect(
    panel.getByRole("combobox", { name: "Pattern direction", exact: true }),
  ).toContainText("Left");
  await expect(
    panel.getByRole("combobox", { name: "Join position", exact: true }),
  ).toContainText("Downwind");
  await expect(
    panel.getByLabel("Pattern altitude (ft above airfield)", { exact: true }),
  ).toHaveValue("1000");
  await expect(page.locator(".legacy-map")).toHaveAttribute(
    "data-pattern-preview",
    "true",
  );
  expect(await savedPattern(page)).toBeNull();
  await panel.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.locator(".legacy-map")).toHaveAttribute(
    "data-pattern-preview",
    "false",
  );
  expect(await savedPattern(page)).toBeNull();
  await page
    .getByRole("dialog", { name: "Details", exact: true })
    .getByRole("button", { name: "Arrival", exact: true })
    .click();
  await choose(page, "Pattern direction", "Right");
  await choose(page, "Join position", "Final");
  await expect(
    panel.getByRole("combobox", { name: "Final distance", exact: true }),
  ).toContainText("Final (4 NM)");
  await choose(page, "Final distance", "Custom Final");
  await panel
    .getByLabel("Distance from threshold (NM)", { exact: true })
    .fill("0");
  await expect(
    panel.getByRole("button", { name: "Accept traffic pattern", exact: true }),
  ).toBeDisabled();
  await panel
    .getByLabel("Distance from threshold (NM)", { exact: true })
    .fill("5.5");
  await panel
    .getByLabel("Pattern altitude (ft above airfield)", { exact: true })
    .fill("1200");
  await page.screenshot({ path: testInfo.outputPath("pattern-preview.png") });
  await panel
    .getByRole("button", { name: "Accept traffic pattern", exact: true })
    .click();
  await expect(page.locator(".legacy-map")).toHaveAttribute(
    "data-pattern-preview",
    "false",
  );
  expect(await savedPattern(page)).toMatchObject({
    join: "final",
    direction: "right",
    finalDistanceNm: 5.5,
    altitudeAalFt: 1200,
    runway: { designator: "30" },
  });
  await expect(page.locator("[data-route-marker]")).toHaveCount(1);
  await expect(page.getByTestId("map-planner-points")).toContainText(
    "TP1/EPNT",
  );
  await page.reload();
  await expect(page.getByTestId("map-planner-points")).toContainText(
    "TP1/EPNT",
  );
  const reopened = await open(page);
  await reopened
    .getByRole("button", { name: "Remove traffic pattern", exact: true })
    .click();
  expect(await savedPattern(page)).toBeNull();
  await expect(page.getByTestId("map-planner-points")).not.toContainText(
    "TP1/EPNT",
  );
});

test("falls back to wind and offers all entry positions and Final presets", async ({
  page,
}) => {
  await mocks(page, false);
  await page.goto("/map");
  const panel = await open(page);
  await expect(
    panel.getByRole("combobox", { name: "Runway", exact: true }),
  ).toContainText("12 · Wind");
  for (const name of ["Overhead", "Crosswind", "Downwind", "Base", "Final"]) {
    await choose(page, "Join position", name);
    await expect(page.locator(".legacy-map")).toHaveAttribute(
      "data-pattern-preview",
      "true",
    );
  }
  for (const name of [
    "Long Final (8 NM)",
    "Final (4 NM)",
    "Short Final (2 NM)",
  ])
    await choose(page, "Final distance", name);
  await panel
    .getByRole("button", { name: "Accept traffic pattern", exact: true })
    .click();
  expect(await savedPattern(page)).toMatchObject({
    join: "final",
    finalDistanceNm: 2,
    runway: { designator: "12" },
  });
});

test("accepted pattern reports downwind once at its midpoint and Short Final at final start; survives reload", async ({
  page,
  context,
}) => {
  await mocks(page);
  const g = trafficPatternGeometry(pattern);
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({
    latitude: g.positions.downwind.lat,
    longitude: g.positions.downwind.lon,
    accuracy: 5,
  });
  await page.addInitScript(
    ({ pattern, route }) => {
      if (!localStorage.getItem("nordsweet.inflight.v1"))
        localStorage.setItem(
          "nordsweet.inflight.v1",
          JSON.stringify({
            version: 1,
            state: {
              startedAt: "2026-10-15T12:00:00Z",
              route,
              activeLeg: 1,
              phase: "cruise",
              trafficPattern: pattern,
              patternReports: [],
            },
          }),
        );
    },
    { pattern, route: [{ ident: "DCT", lat: 49, lon: 20 }, ...g.points] },
  );
  await page.goto("/fly");
  const midpoint = {
    latitude: (g.positions.downwind.lat + g.positions.base.lat) / 2,
    longitude: (g.positions.downwind.lon + g.positions.base.lon) / 2,
    accuracy: 5,
  };
  await context.setGeolocation(midpoint);
  await expect(page.getByTestId("pattern-report")).toHaveText(
    /Report downwind/,
  );
  await page
    .getByRole("button", { name: "Dismiss Comms", exact: true })
    .click();
  await page.reload();
  await expect(page.getByTestId("pattern-report")).toHaveCount(0);
  await context.setGeolocation({
    latitude: g.positions.base.lat,
    longitude: g.positions.base.lon,
    accuracy: 5,
  });
  await expect(page.getByTestId("pattern-report")).toHaveCount(0);
  await context.setGeolocation({
    latitude: flyByRoute(g.points, { tasKt: 100 })
      .turns.get(
        g.points.findIndex(
          (point) => distanceNm(point, g.positions.final) < 0.000001,
        ),
      )!
      .points.at(-1)!.lat,
    longitude: flyByRoute(g.points, { tasKt: 100 })
      .turns.get(
        g.points.findIndex(
          (point) => distanceNm(point, g.positions.final) < 0.000001,
        ),
      )!
      .points.at(-1)!.lon,
    accuracy: 5,
  });
  await expect(page.getByTestId("pattern-report")).toHaveText(
    /Report Short Final/,
  );
});

test("arrival ends at ARP and removing it during flight continues there from ownship", async ({
  page,
  context,
}) => {
  await mocks(page);
  const g = trafficPatternGeometry(pattern);
  const position = {
    lat: (g.positions.downwind.lat + g.positions.base.lat) / 2,
    lon: (g.positions.downwind.lon + g.positions.base.lon) / 2,
  };
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({
    latitude: position.lat,
    longitude: position.lon,
    accuracy: 5,
  });
  await page.addInitScript(
    ({ pattern, route, flight }) => {
      if (localStorage.getItem("nordsweet.inflight.v1")) return;
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
              startedAt: "2026-10-16T00:00:00Z",
              route,
              trafficPattern: pattern,
              activeLeg: 1,
              phase: "cruise",
            },
          }),
        );
    },
    {
      pattern,
      route: [{ ident: "DCT", lat: 49, lon: 20 }, ...g.points],
      flight: {
        ...newFlight(),
        aircraftId: "P2006T",
        departure,
        destination: airport,
        trafficPattern: pattern,
      },
    },
  );
  await page.goto("/fly");
  const active = () =>
    page.evaluate(
      () =>
        (
          JSON.parse(localStorage.getItem("nordsweet.inflight.v1")!) as {
            state: {
              route: {
                ident: string;
                lat: number;
                lon: number;
                patternId?: string;
              }[];
              activeLeg: number;
              startedAt: string;
              trafficPattern: TrafficPattern | null;
            };
          }
        ).state,
    );
  const panel = await open(page);
  expect((await active()).route.at(-1)).toMatchObject({
    ident: airport.ident,
    lat: airport.lat,
    lon: airport.lon,
  });
  expect((await active()).route.at(-2)?.ident).toBe("EPNT THR30");
  await panel
    .getByRole("button", { name: "Remove traffic pattern", exact: true })
    .click();
  await expect.poll(async () => (await active()).trafficPattern).toBeNull();
  const removed = await active();
  expect(removed.route).toHaveLength(2);
  expect(removed.route[0]).toMatchObject({ ident: "DCT", ...position });
  expect(removed.route[1]).toMatchObject({
    ident: airport.ident,
    lat: airport.lat,
    lon: airport.lon,
  });
  expect(removed.activeLeg).toBe(0);
  await page.reload();
  expect((await active()).route).toEqual(removed.route);
  expect(await savedPattern(page)).toBeNull();
});

test("accepting a Base join during flight preserves the flight and reports halfway along Base", async ({
  page,
  context,
}) => {
  await mocks(page);
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({
    latitude: 49.5,
    longitude: 20.2,
    accuracy: 5,
  });
  await page.addInitScript(
    ({ departure, airport }) => {
      if (!localStorage.getItem("nordsweet.inflight.v1"))
        localStorage.setItem(
          "nordsweet.inflight.v1",
          JSON.stringify({
            version: 1,
            state: {
              startedAt: "2026-10-15T12:00:00Z",
              route: [departure, airport],
              activeLeg: 0,
              phase: "cruise",
              trafficPattern: null,
              patternReports: [],
            },
          }),
        );
    },
    { departure, airport },
  );
  await page.goto("/fly");
  const panel = await open(page);
  await choose(page, "Join position", "Base");
  await page.screenshot({ path: "test-results/base-entry-preview.png" });
  await panel
    .getByRole("button", { name: "Accept traffic pattern", exact: true })
    .click();
  await settleStorage(page);
  const active = await page.evaluate(
    () =>
      (
        JSON.parse(localStorage.getItem("nordsweet.inflight.v1")!) as {
          state: {
            startedAt: string;
            phase: string;
            route: { ident: string; lat: number; lon: number }[];
            trafficPattern: TrafficPattern;
          };
        }
      ).state,
  );
  expect(active.startedAt).toBe("2026-10-15T12:00:00Z");
  expect(active.phase).toBe("cruise");
  expect(active.route[0]?.ident).toBe("DCT");
  expect(active.trafficPattern.join).toBe("base");
  await page.screenshot({ path: "test-results/base-entry-accepted.png" });
  const g = trafficPatternGeometry(active.trafficPattern);
  // Fly the added rate-one entry guides before reaching the beginning of Base.
  const baseIndex = active.route.findIndex((p) => p.ident === "TP1/EPNT");
  for (let i = 1; i < baseIndex; i++) {
    const point = active.route[i]!;
    await context.setGeolocation({
      latitude: point.lat,
      longitude: point.lon,
      accuracy: 5,
    });
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            (
              JSON.parse(localStorage.getItem("nordsweet.inflight.v1")!) as {
                state: { activeLeg: number };
              }
            ).state.activeLeg,
        ),
      )
      .toBeGreaterThanOrEqual(i);
  }
  await context.setGeolocation({
    latitude: g.positions.base.lat,
    longitude: g.positions.base.lon,
    accuracy: 5,
  });
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (
            JSON.parse(localStorage.getItem("nordsweet.inflight.v1")!) as {
              state: { activeLeg: number };
            }
          ).state.activeLeg,
      ),
    )
    .toBe(baseIndex);
  await context.setGeolocation({
    latitude: (g.positions.base.lat + g.positions.final.lat) / 2,
    longitude: (g.positions.base.lon + g.positions.final.lon) / 2,
    accuracy: 5,
  });
  await expect(page.getByTestId("pattern-report")).toHaveText(/Report Base/);
});

test("joining widens the circuit for touching fly-by arcs and keeps the remaining arrival fix", async ({
  page,
  context,
}) => {
  await mocks(page);
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({
    latitude: departure.lat,
    longitude: departure.lon,
    accuracy: 5,
  });
  const arrivalFix = { ident: "EPNTD", ...destinationPoint(airport, 90, 8) };
  await page.addInitScript(
    ({ departure, arrivalFix, airport }) => {
      if (!localStorage.getItem("nordsweet.inflight.v1"))
        localStorage.setItem(
          "nordsweet.inflight.v1",
          JSON.stringify({
            version: 1,
            state: {
              startedAt: "2026-10-15T12:00:00Z",
              route: [departure, arrivalFix, airport],
              activeLeg: 0,
              phase: "cruise",
              trafficPattern: null,
              patternReports: [],
            },
          }),
        );
    },
    { departure, arrivalFix, airport },
  );
  await page.goto("/fly");
  const panel = await open(page);
  await expect(panel.getByTestId("pattern-dimensions")).toContainText(
    "100 KIAS",
  );
  await panel
    .getByRole("button", { name: "Accept traffic pattern", exact: true })
    .click();
  await settleStorage(page);
  const active = () =>
    page.evaluate(
      () =>
        (
          JSON.parse(localStorage.getItem("nordsweet.inflight.v1")!) as {
            state: {
              route: { ident: string; patternId?: string }[];
              activeLeg: number;
              startedAt: string;
              trafficPattern: TrafficPattern;
            };
          }
        ).state,
    );
  const accepted = await active();
  expect(accepted.route.slice(0, 2).map((p) => p.ident)).toEqual([
    "EPKK",
    "EPNTD",
  ]);
  expect(accepted.route[2]?.patternId).toBe(accepted.trafficPattern.id);
  expect(accepted.activeLeg).toBe(0);
  expect(accepted.startedAt).toBe("2026-10-15T12:00:00Z");
  const circuit = trafficPatternGeometry(accepted.trafficPattern);
  expect(circuit.lateralOffsetNm).toBeGreaterThan(1.06);
  expect(accepted.trafficPattern.speedKias).toBe(100);
  const curved = flyByRoute(circuit.points, { tasKt: 180 });
  expect(curved.issues).toEqual([]);
  expect(curved.turns.size).toBe(2);
  await page.reload();
  expect((await active()).route.slice(0, 2).map((p) => p.ident)).toEqual([
    "EPKK",
    "EPNTD",
  ]);
  expect((await active()).trafficPattern).toEqual(accepted.trafficPattern);
});

for (const gps of ["denied", "unavailable", "stale"] as const) {
  test(`pattern can be accepted during flight with ${gps} GPS and survives reload`, async ({
    page,
  }) => {
    await mocks(page);
    const origin = { ident: "DCT", lat: 49.5, lon: 20.2 };
    const recorded = {
      lat: 49.6,
      lon: 20.3,
      altitudeFt: 3000,
      time: new Date(Date.now() - 120000).toISOString(),
    };
    const staleFix = { lat: 49.7, lon: 20.4 };
    await page.addInitScript(
      ({ gps, origin, recorded, staleFix, airport }) => {
        Object.defineProperty(navigator, "geolocation", {
          value: {
            watchPosition(
              success: PositionCallback,
              error?: PositionErrorCallback,
            ) {
              queueMicrotask(() => {
                if (gps === "stale")
                  success({
                    coords: {
                      latitude: staleFix.lat,
                      longitude: staleFix.lon,
                      altitude: 1000,
                      accuracy: 10,
                      altitudeAccuracy: 10,
                      speed: 50,
                      heading: 120,
                    },
                    timestamp: Date.now() - 60000,
                  } as GeolocationPosition);
                else
                  error?.({
                    code: gps === "denied" ? 1 : 2,
                    message: gps,
                    PERMISSION_DENIED: 1,
                    POSITION_UNAVAILABLE: 2,
                    TIMEOUT: 3,
                  });
              });
              return 1;
            },
            clearWatch: () => undefined,
          },
        });
        if (!localStorage.getItem("nordsweet.inflight.v1"))
          localStorage.setItem(
            "nordsweet.inflight.v1",
            JSON.stringify({
              version: 1,
              state: {
                startedAt: "2026-10-15T12:00:00Z",
                route: [origin, airport],
                activeLeg: 0,
                phase: "cruise",
                trafficPattern: null,
                patternReports: [],
                track: gps === "unavailable" ? [recorded] : [],
              },
            }),
          );
      },
      { gps, origin, recorded, staleFix, airport },
    );
    await page.goto("/fly");
    const panel = await open(page);
    await expect(
      panel.getByText(
        "A current GPS position is needed to join during flight.",
      ),
    ).toHaveCount(0);
    const accept = panel.getByRole("button", {
      name: "Accept traffic pattern",
      exact: true,
    });
    await expect(accept).toBeEnabled();
    await expect(page.locator("[data-pattern-preview='true']")).toBeVisible();
    await accept.click();
    await settleStorage(page);
    const readActive = () =>
      page.evaluate(
        () =>
          (
            JSON.parse(localStorage.getItem("nordsweet.inflight.v1")!) as {
              state: {
                startedAt: string;
                activeLeg: number;
                phase: string;
                route: {
                  ident: string;
                  lat: number;
                  lon: number;
                  patternId?: string;
                }[];
                trafficPattern: TrafficPattern;
                track: unknown[];
              };
            }
          ).state,
      );
    const active = await readActive();
    const expected =
      gps === "stale" ? staleFix : gps === "unavailable" ? recorded : origin;
    expect(active.route[0]).toEqual({
      ident: "DCT",
      lat: expected.lat,
      lon: expected.lon,
    });
    expect(active.route[1]?.patternId).toBe(active.trafficPattern.id);
    expect(active.startedAt).toBe("2026-10-15T12:00:00Z");
    expect(active.phase).toBe("cruise");
    expect(active.activeLeg).toBe(0);
    expect(active.track).toHaveLength(gps === "unavailable" ? 1 : 0);
    await page.reload();
    expect((await readActive()).route).toEqual(active.route);
  });
}

test("multiple patterns checkbox persists without adding navigation legs", async ({
  page,
}) => {
  await mocks(page);
  await page.goto("/map");
  const panel = await open(page);
  const checkbox = panel.getByRole("checkbox", {
    name: "Multiple Traffic Patterns",
  });
  await expect(checkbox).not.toBeChecked();
  await checkbox.check();
  await panel
    .getByRole("button", { name: "Accept traffic pattern", exact: true })
    .click();
  expect((await savedPattern(page))?.multipleTrafficPatterns).toBe(true);
  await page.reload();
  const reopened = await open(page);
  await expect(
    reopened.getByRole("checkbox", { name: "Multiple Traffic Patterns" }),
  ).toBeChecked();
});
