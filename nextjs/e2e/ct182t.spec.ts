import { test, expect } from "./test";

test("CT182T selection and supplied procedures are available", async ({
  page,
}) => {
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => r.abort());
  await page.addInitScript(() =>
    localStorage.setItem("nordsweet.language.v1", "en"),
  );
  await page.goto("/");
  await page.getByRole("combobox", { name: "Aircraft type" }).click();
  await page
    .getByRole("option", { name: "CT182T (C82S)", exact: true })
    .click();
  const reference = page.getByTestId("aircraft-reference");
  await reference.getByText("Aircraft reference data and sources").click();
  await expect(reference).toContainText("175 KIAS");
  await expect(reference).toContainText("90.85 L/h");
  await page.reload();
  await expect(
    page.getByRole("combobox", { name: "Aircraft type" }),
  ).toContainText("CT182T");
  await page.goto("/checklists");
  await page
    .getByRole("button", { name: "Normal Takeoff", exact: true })
    .click();
  await expect(
    page.getByRole("checkbox", { name: /Mixture Control.*24 GPH/ }),
  ).toBeVisible();
  const emergency = page.getByRole("region", {
    name: "Emergency Checklists",
    exact: true,
  });
  await emergency
    .getByRole("button", { name: "Engine Out", exact: true })
    .click();
  await emergency
    .getByRole("button", {
      name: "Browse source reference (CT182T)",
      exact: true,
    })
    .click();
  await emergency
    .getByRole("button", {
      name: "Engine Failure During Flight (Restart Procedures)",
      exact: true,
    })
    .click();
  await expect(emergency.getByTestId("emergency-procedure")).toContainText(
    "75 KIAS",
  );
  await page.screenshot({
    path: "test-results/ct182t-reference.png",
    fullPage: true,
  });
});
