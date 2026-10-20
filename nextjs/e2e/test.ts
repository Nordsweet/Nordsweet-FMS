import { test as base, type Page } from "@playwright/test";
export * from "@playwright/test";

/** Choose a manual phase through the compact instrument-bar dropdown. */
export async function selectFlightPhase(page: Page, phase: string) {
  await page.getByTestId("flight-phase").click();
  await page.getByRole("menuitem", { name: phase, exact: true }).click();
}

export const E2E_TOKEN = "e2e-token";
const session = { token: E2E_TOKEN, username: "admin", role: "admin" };

/** A stubbed token in the auth store. The real API is never reached. */
export async function stubSession(page: Page) {
  // Lowest priority (spec routes are added later and win): an unmocked call must not reach the
  // live API, which would answer the stub token with a 401 and end the session.
  await page.route("https://aviation.lab.vibecde.com/**", (route) =>
    route.abort(),
  );
  await page.route("https://aviation.lab.vibecde.com/auth/me", (route) =>
    route.fulfill({ json: { username: "admin", role: "admin" } }),
  );
  // Only when absent, so a sign-out inside a spec survives its reloads.
  await page.addInitScript((value) => {
    if (!localStorage.getItem("nordsweet.auth.v1"))
      localStorage.setItem(
        "nordsweet.auth.v1",
        JSON.stringify({ state: { session: value }, version: 0 }),
      );
  }, session);
}

/**
 * Specs start signed in; `test.use({ signedIn: false })` starts at the login screen.
 * Existing navigation/flight regressions choose to continue a persisted flight; recovery specs exercise the choice explicitly.
 */
export const test = base.extend<{ signedIn: boolean }>({
  signedIn: [true, { option: true }],
  page: async ({ page, signedIn }, provide) => {
    if (signedIn) await stubSession(page);
    await page.addLocatorHandler(
      page.getByTestId("resume-flight"),
      async () => {
        await page.getByTestId("resume-flight-yes").click();
      },
    );
    await provide(page);
  },
});
