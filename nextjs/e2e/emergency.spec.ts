import { expect, test, type Page } from "@playwright/test";
import { newFlight } from "../src/data/flight";
import { newTimers } from "../src/domain/flight-timers";

async function seed(page: Page, airborne = false, aircraftId = "FR172H") {
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => r.abort());
  const departure = { ident: "EPKK", lat: 50.077778, lon: 19.784722 };
  const destination = { ident: "EPNT", lat: 49.46283, lon: 20.05067 };
  const flight = { ...newFlight(), aircraftId, departure, destination };
  const timers = newTimers();
  timers.airTime.autoArmed = false;
  if (airborne)
    timers.airTime = {
      ...timers.airTime,
      startedAt: Date.now() - 600_000,
      source: "manual",
      autoArmed: false,
    };
  await page.addInitScript(
    ({ flight, departure, destination, timers }) => {
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
              startedAt: "2026-10-18T00:00:00Z",
              route: [departure, destination],
              activeLeg: 0,
              phase: "cruise",
              timers,
            },
          }),
        );
      Object.defineProperty(navigator, "geolocation", {
        configurable: true,
        value: {
          watchPosition: (callback: PositionCallback) => {
            const send = () =>
              callback({
                coords: {
                  latitude: 49.7,
                  longitude: 19.9,
                  altitude: 900,
                  accuracy: 5,
                  altitudeAccuracy: 5,
                  speed: (90 * 1852) / 3600,
                  heading: 180,
                },
                timestamp: Date.now(),
              } as GeolocationPosition);
            send();
            return setInterval(send, 2000);
          },
          clearWatch: (id: number) => clearInterval(id),
        },
      });
    },
    { flight, departure, destination, timers },
  );
}
async function emer(page: Page) {
  await page.goto("/fly");
  await page.getByRole("button", { name: "EMER", exact: true }).click();
  return page.getByRole("region", {
    name: "Emergency Checklists",
    exact: true,
  });
}

test("FR172H reference variants share progress across EMER/library and reload without operational promotion", async ({
  page,
}) => {
  await seed(page);
  let panel = await emer(page);
  await panel.getByRole("button", { name: "Engine Out", exact: true }).click();
  await expect(
    panel.getByLabel("Procedure phase (manual override)"),
  ).toHaveValue("");
  await expect(panel.getByTestId("emergency-route")).toHaveCount(0);
  await panel
    .getByRole("button", { name: "Browse source reference (FR172H)" })
    .click();
  await panel
    .getByRole("button", {
      name: "Engine Failure — During Flight",
      exact: true,
    })
    .click();
  await expect(panel.getByTestId("emergency-procedure")).toContainText(
    "REFERENCE ONLY",
  );
  await expect(
    panel.getByTestId("emergency-procedure").getByRole("checkbox"),
  ).toHaveCount(7);
  await page.screenshot({ path: "test-results/emergency-reference.png" });
  const dialog = page.getByRole("dialog", { name: "EMER", exact: true });
  expect(
    await dialog.evaluate((el) => el.scrollWidth - el.clientWidth),
  ).toBeLessThanOrEqual(1);
  await panel
    .getByTestId("emergency-procedure")
    .getByRole("checkbox")
    .first()
    .check();
  await panel
    .getByRole("button", { name: "Engine did not restart — secure engine" })
    .click();
  await expect(
    panel.getByTestId("emergency-procedure").getByRole("checkbox"),
  ).toHaveCount(5);
  await expect(
    panel.getByTestId("emergency-procedure").getByRole("checkbox").first(),
  ).not.toBeChecked();
  await page.goto("/checklists");
  panel = page.getByRole("region", {
    name: "Emergency Checklists",
    exact: true,
  });
  await panel
    .getByRole("button", { name: "Browse source reference (FR172H)" })
    .click();
  await panel
    .getByRole("button", {
      name: "Engine Failure — During Flight",
      exact: true,
    })
    .click();
  await expect(
    panel.getByTestId("emergency-procedure").getByRole("checkbox").first(),
  ).toBeChecked();
  await page.reload();
  await panel
    .getByRole("button", { name: "Browse source reference (FR172H)" })
    .click();
  await expect(
    panel.getByTestId("emergency-procedure").getByRole("checkbox").first(),
  ).toBeChecked();
  await panel.getByRole("button", { name: "Engine Fire", exact: true }).click();
  await expect(panel).toContainText(
    "Verified Engine Fire procedure unavailable for this aircraft",
  );
  await expect(panel.getByTestId("emergency-procedure")).toHaveCount(0);
  await expect(
    panel.getByText("Best glide speed unavailable", { exact: false }),
  ).toHaveCount(0);
});

test("Engine Out alone requests automatic threshold plan; closing preserves it and ending explicitly removes it", async ({
  page,
}) => {
  await seed(page, true);
  const panel = await emer(page);
  await expect(page.getByTestId("emergency-map-status")).toHaveCount(0);
  await panel.getByRole("button", { name: "Engine", exact: true }).click();
  await expect(page.getByTestId("emergency-map-status")).toHaveCount(0);
  await panel.getByRole("button", { name: "Engine Out", exact: true }).click();
  await expect(panel.getByTestId("emergency-route")).toBeVisible();
  await expect(page.getByTestId("emergency-map-status")).toBeVisible();
  await expect(panel).toContainText("Best glide speed unavailable");
  await expect(panel).toContainText("Range unavailable");
  await panel
    .locator("summary")
    .filter({ hasText: "Record current instrument readings" })
    .click();
  await panel
    .getByLabel("Current indicated altitude (ft AMSL, QNH corrected)")
    .fill("5000");
  await panel
    .getByLabel("Current measured vertical speed (ft/min; descent negative)")
    .fill("-500");
  await panel
    .getByRole("button", {
      name: "Record current instrument readings",
      exact: true,
    })
    .click();
  await expect(page.getByTestId("emergency-map-status")).toContainText(
    "Current-trend range",
  );
  const readSession = () =>
    page.evaluate(
      () =>
        (
          JSON.parse(localStorage.getItem("nordsweet.emergency.v1")!) as {
            state: {
              session: { target: unknown; originalRoute: unknown[] } | null;
            };
          }
        ).state.session,
    );
  const saved = await readSession();
  expect(saved?.target).toBeTruthy();
  await page
    .getByRole("dialog", { name: "EMER", exact: true })
    .getByRole("button", { name: "Close", exact: true })
    .click();
  await expect(page.getByTestId("emergency-map-status")).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "EMER", exact: true }).click();
  expect((await readSession())?.target).toEqual(saved?.target);
  await expect(panel).toContainText("Range unavailable");
  await panel.getByRole("button", { name: "End / reset emergency" }).click();
  await panel.getByRole("button", { name: "Cancel", exact: true }).click();
  expect(await readSession()).not.toBeNull();
  await panel.getByRole("button", { name: "End / reset emergency" }).click();
  await panel.getByRole("button", { name: "End session", exact: true }).click();
  expect(await readSession()).toBeNull();
  await expect(page.getByTestId("emergency-map-status")).toHaveCount(0);
  expect(
    await page.evaluate(
      () =>
        (
          JSON.parse(localStorage.getItem("nordsweet.inflight.v1")!) as {
            state: { route: unknown[] };
          }
        ).state.route,
    ),
  ).toEqual(saved?.originalRoute);
});

test("reference is not offered for a twin; takeoff sufficiency needs pilot confirmation", async ({
  page,
}) => {
  await seed(page, false, "P2006T");
  const panel = await emer(page);
  await panel.getByRole("button", { name: "Engine Out", exact: true }).click();
  await expect(
    panel.getByRole("button", { name: "Browse source reference (FR172H)" }),
  ).toHaveCount(0);
  const option = panel.getByRole("option", {
    name: "During Take-Off — sufficient runway ahead",
  });
  await expect(option).toHaveJSProperty("disabled", true);
  await panel.getByLabel("I confirm sufficient runway ahead").check();
  await expect(option).toHaveJSProperty("disabled", false);
});
