import { test as base } from "@playwright/test";
export * from "@playwright/test";

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
