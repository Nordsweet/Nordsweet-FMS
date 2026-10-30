import { expect, test } from "./test";

const API = "https://aviation.lab.vibecde.com";
const ISSUER = "https://auth.lab.vibecde.com";
const cors = { "access-control-allow-origin": "*" };

test.describe("signed out", () => {
  test.use({ signedIn: false });

  test("the app makes no API request until sign-in, and Sign in goes to Zitadel", async ({
    page,
  }) => {
    const calls: string[] = [];
    await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => route.abort());
    await page.route(`${API}/**`, (route) => {
      calls.push(new URL(route.request().url()).pathname);
      return route.abort();
    });
    await page.route(`${ISSUER}/.well-known/openid-configuration`, (route) =>
      route.fulfill({
        headers: cors,
        json: {
          issuer: ISSUER,
          authorization_endpoint: `${ISSUER}/oauth/v2/authorize`,
          token_endpoint: `${ISSUER}/oauth/v2/token`,
          jwks_uri: `${ISSUER}/oauth/v2/keys`,
          code_challenge_methods_supported: ["S256"],
        },
      }),
    );
    await page.route(`${ISSUER}/oauth/v2/authorize*`, (route) =>
      route.fulfill({ contentType: "text/html", body: "<p>Zitadel</p>" }),
    );

    await page.goto("/map");
    await expect(
      page.getByRole("button", { name: "Zaloguj się" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Załóż konto" }),
    ).toBeVisible();
    // The old username and password form is gone.
    await expect(page.locator("input")).toHaveCount(0);
    await page.waitForTimeout(500);
    expect(calls).toEqual([]);

    await page.getByRole("button", { name: "Zaloguj się" }).click();
    await page.waitForURL(`${ISSUER}/oauth/v2/authorize*`);
    const url = new URL(page.url());
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      client_id: "397275487510003715",
      response_type: "code",
      code_challenge_method: "S256",
      prompt: "login",
    });
    expect(url.searchParams.get("redirect_uri")).toMatch(/\/auth\/callback$/);
  });

  test("a callback this browser did not start shows the failure and goes back", async ({
    page,
  }) => {
    await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => route.abort());
    await page.goto("/auth/callback?code=forged&state=forged");
    await expect(page.getByText("Logowanie nie powiodło się")).toBeVisible();
    await page.getByRole("button", { name: "Wróć do logowania" }).click();
    await expect(
      page.getByRole("button", { name: "Zaloguj się" }),
    ).toBeVisible();
  });
});

test("sign out returns to the login screen", async ({ page }) => {
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => route.abort());
  await page.goto("/");
  await page.getByRole("button", { name: /admin/ }).click();
  await expect(page.getByRole("button", { name: "Zaloguj się" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: "Zaloguj się" })).toBeVisible();
});

test("a 401 mid-session ends the session and shows the login screen", async ({
  page,
}) => {
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => route.abort());
  await page.route(`${API}/**`, (route) =>
    new URL(route.request().url()).pathname === "/traffic"
      ? route.fulfill({ status: 401, json: { detail: "Not authenticated" } })
      : route.fulfill({ json: { places: [], sources: {} } }),
  );
  await page.goto("/map");
  await expect(page.getByRole("button", { name: "Zaloguj się" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: "Zaloguj się" })).toBeVisible();
});

test("an old password session is dropped", async ({ page }) => {
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => route.abort());
  await page.addInitScript(() =>
    localStorage.setItem(
      "nordsweet.auth.v1",
      JSON.stringify({
        state: { session: { token: "old", username: "admin", role: "admin" } },
        version: 0,
      }),
    ),
  );
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Zaloguj się" })).toBeVisible();
});

test("the role comes from /auth/me on every load, not from the stored session", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      "nordsweet.auth.v1",
      JSON.stringify({
        state: {
          session: { token: "e2e-token", username: "admin", role: "user" },
        },
        version: 1,
      }),
    ),
  );
  await page.goto("/settings");
  await expect(
    page.getByRole("button", { name: "Utwórz użytkownika" }),
  ).toBeVisible();
});
