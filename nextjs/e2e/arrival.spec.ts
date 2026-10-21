import fs from "node:fs";
import { test, expect, type Page } from "./test";
import { newFlight } from "../src/data/flight";
import { airportSchema } from "../src/data/schemas";

const airports = JSON.parse(
  fs.readFileSync("public/data/airports.json", "utf8"),
) as { ident: string }[];
const departure = airportSchema.parse(airports.find((a) => a.ident === "EPKK"));
const destination = airportSchema.parse(
  airports.find((a) => a.ident === "EPWA"),
);

async function openArrival(page: Page, code: string) {
  await page.getByRole("button", { name: "Search", exact: true }).click();
  const search = page.getByRole("dialog", { name: "Search", exact: true });
  await search.getByRole("textbox").fill(code);
  await search.getByRole("button", { name: "Search", exact: true }).click();
  const details = page.getByRole("dialog", { name: "Details", exact: true });
  await details.getByRole("button", { name: "Arrival", exact: true }).click();
  return details.getByRole("region", { name: "Arrival", exact: true });
}

test("planner ICAO rules persist; Arrival defaults by airport and applies SID/STAR", async ({
  page,
}) => {
  test.setTimeout(90000);
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => route.abort());
  await page.addInitScript(
    (flight) => {
      localStorage.setItem("nordsweet.language.v1", "en");
      if (!localStorage.getItem("nordsweet.flight.v2"))
        localStorage.setItem(
          "nordsweet.flight.v2",
          JSON.stringify({ version: 1, state: { flight } }),
        );
    },
    { ...newFlight(), departure, destination },
  );
  await page.goto("/");
  await page.getByRole("tab", { name: "Route", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Flight rules", exact: true })
    .click();
  await page
    .getByRole("option", { name: "Y - IFR then VFR", exact: true })
    .click();
  await page.reload();
  await page.getByRole("tab", { name: "Route", exact: true }).click();
  await expect(
    page.getByRole("combobox", { name: "Flight rules", exact: true }),
  ).toHaveText("Y - IFR then VFR");
  await page.goto("/map");
  let arrival = await openArrival(page, "EPKK");
  await expect(
    arrival.getByRole("button", { name: "IFR", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await arrival.getByRole("combobox", { name: "SID", exact: true }).click();
  await page.getByRole("option").nth(2).click();
  await arrival.getByRole("button", { name: "Apply", exact: true }).click();
  await expect
    .poll(() =>
      page.evaluate(() => {
        const saved = JSON.parse(
          localStorage.getItem("nordsweet.flight.v2")!,
        ) as { state: { flight: { sid: string | null } } };
        return saved.state.flight.sid;
      }),
    )
    .toBeTruthy();
  await page.goto("/map");
  arrival = await openArrival(page, "EPWA");
  await expect(
    arrival.getByRole("button", { name: "VFR", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    arrival.getByRole("region", { name: "Traffic Pattern", exact: true }),
  ).toBeVisible();
  await arrival.getByRole("button", { name: "IFR", exact: true }).click();
  await expect(
    arrival.getByRole("region", { name: "Traffic Pattern", exact: true }),
  ).toHaveCount(0);
  await arrival.getByRole("combobox", { name: "STAR", exact: true }).click();
  await page.getByRole("option").nth(2).click();
  await arrival.getByRole("button", { name: "Apply", exact: true }).click();
  await page.reload();
  await expect
    .poll(() =>
      page.evaluate(() => {
        const saved = JSON.parse(
          localStorage.getItem("nordsweet.flight.v2")!,
        ) as {
          state: { flight: { star: string | null; trafficPattern: unknown } };
        };
        return [!!saved.state.flight.star, saved.state.flight.trafficPattern];
      }),
    )
    .toEqual([true, null]);
});
