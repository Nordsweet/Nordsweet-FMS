import { E2E_TOKEN, expect, test } from "./test";

const API = "https://aviation.lab.vibecde.com";
const empty = { count: 0, aircraft: [], sources: {} };

test.describe("signed out", () => {
  test.use({ signedIn: false });

  test("the app makes no API request until login, then sends the bearer token", async ({
    page,
  }) => {
    const calls: { path: string; authorization?: string }[] = [];
    await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => route.abort());
    await page.route(`${API}/**`, (route) => {
      const request = route.request();
      const path = new URL(request.url()).pathname;
      calls.push({ path, authorization: request.headers().authorization });
      if (path === "/auth/login")
        return route.fulfill({
          json: {
            token: E2E_TOKEN,
            username: "admin",
            role: "admin",
            expires_in: 2592000,
          },
        });
      if (path === "/auth/me")
        return route.fulfill({ json: { username: "admin", role: "admin" } });
      if (path === "/traffic") return route.fulfill({ json: empty });
      return route.fulfill({ json: { places: [], sources: {} } });
    });

    await page.goto("/map");
    await expect(page.getByLabel("Użytkownik")).toBeVisible();
    await expect(page.getByText(/poproś administratora/)).toBeVisible();
    await page.waitForTimeout(500);
    expect(calls).toEqual([]);

    await page.getByLabel("Użytkownik").fill("admin");
    await page.getByLabel("Hasło").fill("adminadmin");
    await page.getByRole("button", { name: "Zaloguj" }).click();

    await expect(page.getByTestId("map")).toBeVisible();
    await expect
      .poll(() => calls.some((c) => c.path === "/traffic"))
      .toBe(true);
    const login = calls.find((c) => c.path === "/auth/login");
    expect(login?.authorization).toBeUndefined();
    for (const call of calls.filter((c) => c.path !== "/auth/login"))
      expect(call.authorization, call.path).toBe(`Bearer ${E2E_TOKEN}`);

    await page.reload();
    await expect(page.getByTestId("map")).toBeVisible(); // the session survives a reload
  });

  test("wrong credentials and rate limiting show their own messages", async ({
    page,
  }) => {
    await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => route.abort());
    let attempt = 0;
    await page.route(`${API}/auth/login`, (route) => {
      attempt++;
      return attempt === 1
        ? route.fulfill({
            status: 401,
            json: { detail: "Wrong username or password" },
          })
        : route.fulfill({
            status: 429,
            json: { detail: "Too many attempts" },
          });
    });
    await page.goto("/");
    await page.getByLabel("Użytkownik").fill("admin");
    await page.getByLabel("Hasło").fill("nope");
    await page.getByRole("button", { name: "Zaloguj" }).click();
    await expect(page.locator("p[role=alert]")).toHaveText(
      "Nieprawidłowy użytkownik lub hasło.",
    );
    await page.getByRole("button", { name: "Zaloguj" }).click();
    await expect(page.locator("p[role=alert]")).toHaveText(
      "Za dużo nieudanych prób. Spróbuj ponownie za minutę.",
    );
  });
});

test("sign out revokes the token and returns to login", async ({ page }) => {
  let logoutAuthorization: string | undefined;
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => route.abort());
  await page.route(`${API}/auth/logout`, (route) => {
    logoutAuthorization = route.request().headers().authorization;
    return route.fulfill({ status: 204 });
  });
  await page.goto("/");
  await page.getByRole("button", { name: /admin/ }).click();
  await expect(page.getByLabel("Użytkownik")).toBeVisible();
  expect(logoutAuthorization).toBe(`Bearer ${E2E_TOKEN}`);
  await page.reload();
  await expect(page.getByLabel("Użytkownik")).toBeVisible();
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
  await expect(page.getByLabel("Użytkownik")).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Użytkownik")).toBeVisible();
});
