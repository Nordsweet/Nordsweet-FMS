import { expect, test } from "@playwright/test";

test("settings migrate from the legacy planner and switch language", async ({
  page,
}) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem("nordsweet.settings.v2")) {
      localStorage.setItem("nordsweet.language.v1", "en");
      localStorage.setItem("nordsweet.homeAirport.v1", "EPNT");
    }
  });
  await page.goto("/settings");
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  await expect(page.getByLabel("Home airport (ICAO)")).toHaveValue("EPNT");
  await expect(page.getByTestId("home-airport-name")).toHaveText(
    "Nowy Targ (EPNT)",
  );
  await page.getByLabel("Home airport (ICAO)").fill("ANTONO");
  await expect(page.getByTestId("home-airport-name")).toHaveText(
    "Antonowo (ANTONOWO)",
  );
  await page.getByLabel("Home airport (ICAO)").fill("EPXX");
  await expect(page.getByTestId("home-airport-name")).toHaveText(
    "Unknown airport",
  );

  await page.getByRole("button", { name: "PL" }).click();
  await expect(page.getByRole("heading", { name: "Ustawienia" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Ustawienia" })).toBeVisible();
});

test("legacy URLs land on the new screens", async ({ page }) => {
  await page.goto("/airspaces-map.html");
  await expect(page).toHaveURL(/\/map$/);
  await page.goto("/PFD.html");
  await expect(page).toHaveURL(/\/fly$/);
  await page.goto("/index.html");
  await expect(
    page.getByRole("heading", { name: /Przygotowanie lotu|Flight setup/ }),
  ).toBeVisible();
});

test("data cached by an older release does not break the planner", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(() =>
    localStorage.setItem("nordsweet.language.v1", "en"),
  );
  await page.goto("/");
  await page.getByRole("combobox", { name: "Aircraft type" }).click();
  await page.getByRole("option", { name: "P2006T (P06T)" }).click();
  await page.waitForTimeout(1500); // the query cache persists with a short delay
  // Rewrite the persisted cache as the previous release left it: older buster, older aircraft shape.
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open("keyval-store");
        open.onerror = () => reject(new Error("no IndexedDB"));
        open.onsuccess = () => {
          const tx = open.result.transaction("keyval", "readwrite");
          const store = tx.objectStore("keyval");
          const get = store.get("nordsweet.query-cache.v1");
          get.onsuccess = () => {
            const cache = JSON.parse(get.result as string) as {
              buster: string;
              clientState: {
                queries: {
                  queryKey: unknown[];
                  state: { data: Record<string, unknown>[] };
                }[];
              };
            };
            cache.buster = "previous-release";
            for (const q of cache.clientState.queries)
              if (q.queryKey[0] === "aircraft.list")
                q.state.data = q.state.data.map(
                  ({ powerplant: _p, order: _o, ...old }) => old,
                );
            store.put(JSON.stringify(cache), "nordsweet.query-cache.v1");
            tx.oncomplete = () => resolve();
          };
        };
      }),
  );
  await page.reload();
  await expect(page.getByText("Powerplant: Reciprocating.")).toBeVisible();
  expect(errors).toEqual([]);
});
