import { expect, test, type Page } from "./test";
import { newFlight } from "../src/data/flight";

async function setup(page: Page, planned = false) {
  const requests: string[] = [];
  const confirmations: string[] = [];
  const submissions: {
    reporterId: string;
    information: string;
    atisObservedAt: string;
    fields: Record<string, string>;
  }[] = [];
  const devices = new Set(["first-device-0001"]);
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => route.abort());
  await page.route("https://aviation.lab.vibecde.com/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    requests.push(path);
    if (path === "/community/atis") {
      const body = route
        .request()
        .postDataJSON() as (typeof submissions)[number];
      submissions.push(body);
      return route.fulfill({ json: { id: "new-report" } });
    }
    if (path === "/community/atis/report-q/confirm") {
      const body = route.request().postDataJSON() as { reporterId: string };
      confirmations.push(body.reporterId);
      devices.add(body.reporterId);
      return route.fulfill({
        json: {
          id: "report-q",
          confirmation_count: devices.size,
          verified: devices.size >= 2,
        },
      });
    }
    if (path === "/airports/EPKK/weather")
      return route.fulfill({
        json: {
          icao: "EPKK",
          metar: {
            raw: "EPKK 151000Z 27010KT CAVOK 15/08 Q1013",
            observed_at: new Date().toISOString(),
            age_minutes: 1,
            stale: false,
            status: "confirmed",
            sources: ["test"],
            disagreeing: {},
          },
          taf: "TAF EPKK 151000Z 1512/1612 CAVOK",
          sources: { weather: "ok" },
        },
      });
    if (path === "/airports/EPKK/atis")
      return route.fulfill({
        json: {
          icao: "EPKK",
          atis: [
            {
              id: "report-q",
              kind: "combined",
              letter: "Q",
              received_at: new Date().toISOString(),
              observed_at: new Date().toISOString(),
              age_minutes: 1,
              stale: false,
              source: "community",
              verified: devices.size >= 2,
              confirmation_count: devices.size,
              text: "PILOT REPORT Q WIND 27010KT QNH 1014",
              fields: { wind: "270/10KT", qnh: "QNH 1014" },
              qnh_hpa: 1014,
              qnh_matches_metar: false,
            },
          ],
          sources: { community: "ok" },
        },
      });
    if (path === "/airports/EPKK/notams")
      return route.fulfill({
        json: {
          icao: "EPKK",
          notams: [
            {
              id: "N01",
              number: "N01",
              location: "EPKK",
              starts_at: null,
              ends_at: null,
              summary: "TEST NOTAM",
              text: "TEST NOTAM",
            },
          ],
          sources: { notac: "ok" },
        },
      });
    return route.fulfill({
      json: {
        places: [],
        sources: {},
        aircraft: [],
        count: 0,
        type: "FeatureCollection",
        features: [],
      },
    });
  });
  await page.addInitScript(
    (flight) => {
      localStorage.setItem("nordsweet.language.v1", "en");
      if (flight && !localStorage.getItem("nordsweet.flight.v2"))
        localStorage.setItem(
          "nordsweet.flight.v2",
          JSON.stringify({ version: 1, state: { flight } }),
        );
    },
    planned
      ? {
          ...newFlight(),
          departure: { ident: "EPKK", lat: 50.077778, lon: 19.784722 },
          destination: { ident: "EPNT", lat: 49.462378, lon: 20.050147 },
          waypoints: [{ ident: "WXTEST", lat: 50, lon: 20 }],
        }
      : null,
  );
  await page.goto("/map");
  await expect(page.getByTestId("map")).toHaveAttribute(
    "data-map-ready",
    "true",
  );
  await page.getByRole("button", { name: "Search", exact: true }).click();
  const search = page.getByRole("dialog", { name: "Search", exact: true });
  await search.getByRole("textbox").fill("EPKK");
  await search.getByRole("button", { name: "Search", exact: true }).click();
  const details = page.getByRole("dialog", { name: "Details", exact: true });
  await expect(details).toContainText("EPKK");
  return { details, requests, confirmations, submissions };
}

test("point WX moves below TAF as Insert PIREP and retains the existing editable weather data", async ({
  page,
}) => {
  test.setTimeout(60_000);
  const { details } = await setup(page, true);
  await expect(
    details.getByRole("button", { name: "WX", exact: true }),
  ).toHaveCount(0);
  await expect(
    details.getByRole("button", { name: "Insert PIREP", exact: true }),
  ).toHaveCount(0);
  await details.getByRole("button", { name: "Weather", exact: true }).click();
  const weather = page.getByTestId("wx-selected");
  await expect(weather).toContainText("TAF EPKK");
  const insert = weather.getByRole("button", {
    name: "Insert PIREP",
    exact: true,
  });
  expect(
    await insert.evaluate((button) =>
      button.parentElement?.previousElementSibling?.textContent?.startsWith(
        "TAF",
      ),
    ),
  ).toBe(true);
  await insert.click();
  const editor = page.getByRole("dialog", {
    name: "Waypoint WX - EPKK",
    exact: true,
  });
  await editor.getByLabel("Altitude 1").fill("3000");
  await editor.getByLabel("Direction 1").fill("240");
  await editor.getByLabel("Speed 1").fill("15");
  await editor.getByLabel("Speed 1").blur();
  await page.keyboard.press("Escape");
  await expect(
    weather.getByRole("button", { name: "Insert ATIS", exact: true }),
  ).toBeVisible();
  await insert.click();
  await expect(editor.getByLabel("Direction 1")).toHaveValue("240");
  await expect(editor.getByLabel("Speed 1")).toHaveValue("15");
  await page.reload();
  const stored = await page.evaluate(
    () =>
      (
        JSON.parse(localStorage.getItem("nordsweet.flight.v2")!) as {
          state: { flight: { waypointWx: Record<string, unknown> } };
        }
      ).state.flight.waypointWx.EPKK,
  );
  expect(stored).toEqual([
    { altitudeFt: "3000", windDirection: "240", windSpeed: "15" },
  ]);
  await page.locator('[data-route-marker="WXTEST"]').click();
  await details.getByRole("button", { name: "Weather", exact: true }).click();
  await expect(
    weather.getByRole("button", { name: "Insert ATIS", exact: true }),
  ).toHaveCount(0);
  await weather
    .getByRole("button", { name: "Insert PIREP", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Waypoint WX - WXTEST", exact: true }),
  ).toBeVisible();
});

test("Weather loads only METAR, TAF and ATIS; one device is a suggestion in Insert ATIS", async ({
  page,
}) => {
  const { details, requests, confirmations } = await setup(page);
  await details.getByRole("button", { name: "Weather", exact: true }).click();
  const weather = page.getByTestId("wx-selected");
  await expect(weather).toContainText("EPKK 151000Z 27010KT");
  await expect(weather).toContainText("TAF EPKK");
  await expect(weather).not.toContainText(
    /Charts|NOTAM|Share the ATIS|PILOT REPORT Q/,
  );
  expect(requests).toContain("/airports/EPKK/weather");
  expect(requests).toContain("/airports/EPKK/atis");
  expect(requests).not.toContain("/airports/EPKK");
  expect(requests).not.toContain("/airports/EPKK/notams");
  await weather
    .getByRole("button", { name: "Insert ATIS", exact: true })
    .click();
  const pad = page.getByRole("dialog", { name: "ATIS Pad", exact: true });
  const suggestions = pad.getByRole("region", {
    name: "ATIS suggestions",
    exact: true,
  });
  await suggestions
    .getByText("Single-device report — suggestion only", { exact: false })
    .click();
  await expect(suggestions).toContainText("PILOT REPORT Q");
  await suggestions
    .getByRole("button", { name: "QNH: QNH 1014", exact: true })
    .click();
  await expect(pad.getByTestId("atis-tile-qnh")).toContainText("1014");
  expect(confirmations).toEqual([]);
  await suggestions
    .getByRole("button", { name: "I heard this ATIS · Confirm", exact: true })
    .click();
  await expect(suggestions).toContainText("Confirmation saved.");
  await expect(suggestions).toContainText("confirmed by 2 devices");
  await suggestions
    .getByRole("button", { name: "I heard this ATIS · Confirm", exact: true })
    .click();
  await expect.poll(() => confirmations.length).toBe(2);
  expect(confirmations[0]).toBe(confirmations[1]);
  await pad.getByRole("button", { name: "Close", exact: true }).click();
  await expect(weather).toContainText("confirmed by 2 devices");
  await expect(weather).toContainText("ATIS / D-ATIS");
});

test("NOTAM has its own panel and does not load Weather", async ({ page }) => {
  const { details, requests } = await setup(page);
  await details.getByRole("button", { name: "NOTAM", exact: true }).click();
  await expect(details).toContainText("TEST NOTAM");
  await expect(page.getByTestId("wx-selected")).toHaveCount(0);
  expect(requests).not.toContain("/airports/EPKK/weather");
  expect(requests).not.toContain("/airports/EPKK/atis");
});

test("new reports are submitted explicitly inside Insert ATIS from the copied pad", async ({
  page,
}) => {
  const { details, submissions } = await setup(page);
  await details.getByRole("button", { name: "Weather", exact: true }).click();
  await page
    .getByTestId("wx-selected")
    .getByRole("button", { name: "Insert ATIS", exact: true })
    .click();
  const pad = page.getByRole("dialog", { name: "ATIS Pad", exact: true });
  const suggestions = pad.getByRole("region", {
    name: "ATIS suggestions",
    exact: true,
  });
  await suggestions
    .getByText("Single-device report — suggestion only", { exact: false })
    .click();
  for (const name of [/^ATIS Information:/, /^Time:/, /^Wind:/, /^QNH:/]) {
    await suggestions.getByRole("button", { name }).click();
  }
  expect(submissions).toHaveLength(0);
  await suggestions
    .getByRole("button", { name: "Confirm the ATIS I heard", exact: true })
    .click();
  await expect(suggestions).toContainText("Confirmation saved.");
  expect(submissions).toHaveLength(1);
  expect(submissions[0]).toMatchObject({
    information: "Q",
    fields: { qnh: "QNH 1014", wind: "270/10KT" },
  });
  expect(submissions[0]!.reporterId).toMatch(/^[a-z0-9-]{16,100}$/i);
  expect(submissions[0]!.atisObservedAt).toMatch(/Z$/);
});
