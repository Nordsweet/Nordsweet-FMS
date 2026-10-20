import { test as base, type Page } from "@playwright/test";
export * from "@playwright/test";

/** Choose a manual phase through the compact instrument-bar dropdown. */
export async function selectFlightPhase(page: Page, phase: string) {
  await page.getByTestId("flight-phase").click();
  await page.getByRole("menuitem", { name: phase, exact: true }).click();
}

/** Existing navigation/flight regressions choose to continue a persisted flight; recovery specs exercise the choice explicitly. */
export const test = base.extend({
  page: async ({ page }, provide) => {
    await page.addLocatorHandler(
      page.getByTestId("resume-flight"),
      async () => {
        await page.getByTestId("resume-flight-yes").click();
      },
    );
    await provide(page);
  },
});
