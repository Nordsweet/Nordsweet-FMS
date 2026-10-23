import { expect, test } from "./test";
import { newFlight } from "../src/data/flight";

test("calendar creates consecutive flights with predecessor airport/fuel and edits one persistent event", async ({
  page,
}) => {
  test.setTimeout(90000);
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => r.abort());
  await page.addInitScript(
    (flight) => {
      localStorage.setItem("nordsweet.language.v1", "en");
      if (!localStorage.getItem("nordsweet.flight.v2"))
        localStorage.setItem(
          "nordsweet.flight.v2",
          JSON.stringify({ version: 1, state: { flight } }),
        );
    },
    {
      ...newFlight(),
      aircraftId: "C172S",
      registration: "SP-TEST",
      departure: { ident: "EPKK", lat: 50.0777, lon: 19.7848 },
      destination: { ident: "EPNT", lat: 49.4628, lon: 20.0503 },
      fuel: { blockL: 100 },
      fuelOverrides: {
        plannedTrip: { fuelL: 20 },
        startTaxi: { fuelL: 4 },
        climb: { fuelL: 3 },
        departureArrival: { fuelL: 3 },
      },
    },
  );
  await page.goto("/");
  await page
    .getByRole("button", { name: "Save to My Planner", exact: true })
    .click();
  const save = page.getByRole("dialog", {
    name: "Save to My Planner",
    exact: true,
  });
  const today = new Date();
  const day = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  await save.getByLabel("Planned take-off (local time)").fill(`${day}T09:00`);
  await save
    .getByRole("button", { name: "Save to My Planner", exact: true })
    .click();
  await expect(save).not.toBeVisible();
  await page.getByRole("tab", { name: "My Planner", exact: true }).click();
  await expect(page.getByTestId("calendar-flight")).toHaveCount(1);
  await expect(page.getByTestId("calendar-flight")).toHaveAccessibleName(
    /09:00.*EPKK → EPNT.*min/,
  );
  await page.screenshot({
    path: "test-results/my-planner-week.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Add flight", exact: true }).click();
  const add = page.getByRole("dialog", { name: "Add flight", exact: true });
  await add.getByLabel("Planned take-off (local time)").fill(`${day}T14:00`);
  await expect(add).toContainText("Previous flight: EPKK → EPNT");
  await expect(add).toContainText("Planned fuel after landing: 18 US gal");
  await add.getByRole("button", { name: "Continue in Flight Planner" }).click();
  await expect(
    page.getByRole("tab", { name: "Current flight", exact: true }),
  ).toHaveAttribute("data-state", "active");
  await expect
    .poll(() =>
      page.evaluate(() => {
        const saved = JSON.parse(
          localStorage.getItem("nordsweet.flight.v2")!,
        ) as {
          state: {
            flight: {
              departure: { ident: string };
              destination: unknown;
              fuel: { blockL: number };
              schedule: { departure: string };
            };
          };
        };
        const f = saved.state.flight;
        return {
          departure: f.departure.ident,
          destination: f.destination,
          fuel: f.fuel.blockL,
          time: f.schedule.departure.slice(11),
        };
      }),
    )
    .toEqual({ departure: "EPNT", destination: null, fuel: 70, time: "14:00" });
  await page.getByRole("tab", { name: "My Planner", exact: true }).click();
  await page.getByRole("button", { name: "Month", exact: true }).click();
  await expect(page.getByTestId("calendar-flight")).toHaveCount(2);
  await page.reload();
  await page.getByRole("tab", { name: "My Planner", exact: true }).click();
  const event = page.getByTestId("calendar-flight").filter({ hasText: "EPKK" });
  await event.click();
  await page.getByRole("button", { name: "Edit flight", exact: true }).click();
  await page
    .getByRole("button", { name: "Save to My Planner", exact: true })
    .click();
  await save
    .getByRole("button", { name: "Save to My Planner", exact: true })
    .click();
  await page.getByRole("tab", { name: "My Planner", exact: true }).click();
  await expect(page.getByTestId("calendar-flight")).toHaveCount(2);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "test-results/my-planner-mobile.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
