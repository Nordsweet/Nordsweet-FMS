import { expect, test } from "./test";

const API = "https://aviation.lab.vibecde.com";

test("an admin creates a Zitadel user from Settings", async ({ page }) => {
  const bodies: unknown[] = [];
  await page.route(`${API}/admin/zitadel-users`, (route) => {
    bodies.push(route.request().postDataJSON());
    return route.fulfill({
      status: 201,
      json: { username: "nina", role: "admin", user_id: "u-1" },
    });
  });
  await page.goto("/settings");
  await page.locator("#new-user-username").fill("nina");
  await page.locator("#new-user-first_name").fill("Nina");
  await page.locator("#new-user-last_name").fill("Pilot");
  await page.locator("#new-user-email").fill("nina@example.com");
  await page.locator("#new-user-password").fill("initial pass 1");
  await page.locator("#new-user-role").click();
  await page.getByRole("option", { name: "Administrator" }).click();
  await page.getByRole("button", { name: "Utwórz użytkownika" }).click();

  await expect(page.getByRole("status")).toContainText("nina");
  expect(bodies).toEqual([
    {
      username: "nina",
      first_name: "Nina",
      last_name: "Pilot",
      email: "nina@example.com",
      password: "initial pass 1",
      role: "admin",
    },
  ]);
  await expect(page.locator("#new-user-password")).toHaveValue("");
});

test("a taken username is reported", async ({ page }) => {
  await page.route(`${API}/admin/zitadel-users`, (route) =>
    route.fulfill({ status: 409, json: { detail: "Username taken" } }),
  );
  await page.goto("/settings");
  await page.locator("#new-user-username").fill("nina");
  await page.locator("#new-user-first_name").fill("Nina");
  await page.locator("#new-user-last_name").fill("Pilot");
  await page.locator("#new-user-email").fill("nina@example.com");
  await page.locator("#new-user-password").fill("initial pass 1");
  await page.getByRole("button", { name: "Utwórz użytkownika" }).click();
  await expect(
    page.getByText("Ta nazwa użytkownika jest zajęta."),
  ).toBeVisible();
});
