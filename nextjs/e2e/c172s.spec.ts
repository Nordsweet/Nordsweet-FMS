import { test, expect } from "./test";

test("C172S selection, source values and normal/emergency reference checklists persist", async ({
  page,
}) => {
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => r.abort());
  await page.addInitScript(() =>
    localStorage.setItem("nordsweet.language.v1", "en"),
  );
  await page.goto("/");
  await page.getByRole("combobox", { name: "Aircraft type" }).click();
  await page.getByRole("option", { name: "C172S (C172)", exact: true }).click();
  const reference = page.getByTestId("aircraft-reference");
  await reference.getByText("Aircraft reference data and sources").click();
  await expect(reference).toContainText("NOT INTENDED FOR REAL FLIGHTS");
  await expect(reference).toContainText("Sea level: 74 KIAS");
  await expect(reference).toContainText("68 KIAS");
  await expect(reference).toContainText("600 ft/min");
  await expect(reference).toContainText("Full Rich");
  await expect(reference).toContainText("96.5 KIAS / 104 KTAS");
  await expect(reference).toContainText("Peak EGT");
  await page.reload();
  await expect(
    page.getByRole("combobox", { name: "Aircraft type" }),
  ).toContainText("C172S");
  await page.goto("/checklists");
  await page
    .getByRole("button", { name: "Normal Takeoff", exact: true })
    .click();
  await expect(
    page.getByRole("checkbox", { name: /Elevator.*55 KIAS/ }),
  ).toBeVisible();
  await page.getByRole("checkbox", { name: /Elevator/ }).check();
  await page.reload();
  await page
    .getByRole("button", { name: "Normal Takeoff", exact: true })
    .click();
  await expect(page.getByRole("checkbox", { name: /Elevator/ })).toBeChecked();
  const emergency = page.getByRole("region", {
    name: "Emergency Checklists",
    exact: true,
  });
  await emergency
    .getByRole("button", { name: "Engine Out", exact: true })
    .click();
  await emergency
    .getByRole("button", {
      name: "Browse source reference (C172S)",
      exact: true,
    })
    .click();
  await emergency
    .getByRole("button", {
      name: "Engine Failure During Flight — Restart",
      exact: true,
    })
    .click();
  await expect(emergency.getByTestId("emergency-procedure")).toContainText(
    "68 KIAS",
  );
  await expect(emergency.getByTestId("emergency-procedure")).toContainText(
    "NOT INTENDED FOR REAL FLIGHTS",
  );
  await emergency
    .getByRole("button", { name: "Electric", exact: true })
    .click();
  await emergency
    .getByRole("button", {
      name: "Browse source reference (C172S)",
      exact: true,
    })
    .click();
  await emergency
    .getByRole("button", {
      name: "Air Data Failure — RED X PFD Airspeed",
      exact: true,
    })
    .click();
  await expect(emergency.getByTestId("emergency-procedure")).toContainText(
    "Standby Airspeed Indicator",
  );
  await page.screenshot({
    path: "test-results/c172s-reference.png",
    fullPage: true,
  });
});
