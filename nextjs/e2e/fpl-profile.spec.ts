import { expect, test } from "./test";
import { newFlight } from "../src/data/flight";

for (const available of [true, false]) {
  test(`FPL profile has TOC/TOD, live aircraft and ${available ? "cached terrain" : "explicit terrain gaps"}`, async ({
    page,
  }) => {
    test.setTimeout(60000);
    await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => route.abort());
    if (available)
      await page.route(
        "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/**",
        (route) =>
          route.fulfill({
            path: "e2e/fixtures/terrain-hill.png",
            contentType: "image/png",
            headers: { "Access-Control-Allow-Origin": "*" },
          }),
      );
    await page.addInitScript(
      (flight) => {
        localStorage.setItem("nordsweet.language.v1", "en");
        if (!localStorage.getItem("nordsweet.flight.v2"))
          localStorage.setItem(
            "nordsweet.flight.v2",
            JSON.stringify({ version: 1, state: { flight } }),
          );
        navigator.geolocation.watchPosition = (success) => {
          let lat = 50,
            altitude = 1200;
          window.addEventListener("profile-position", () => {
            lat = 49.95;
            altitude = 1400;
          });
          const send = () =>
            success({
              timestamp: Date.now(),
              coords: {
                latitude: lat,
                longitude: 19.85,
                altitude,
                altitudeAccuracy: 5,
                speed: 100 / 1.943844,
                heading: 165,
                accuracy: 5,
              },
            } as GeolocationPosition);
          send();
          return window.setInterval(send, 1000);
        };
        navigator.geolocation.clearWatch = (id) => clearInterval(id);
      },
      {
        ...newFlight(),
        aircraftId: "C172S",
        departure: { ident: "EPKK", lat: 50.077778, lon: 19.784722 },
        destination: { ident: "EPNT", lat: 49.46283, lon: 20.05067 },
        cruiseAltitudeFt: 5000,
      },
    );
    await page.goto("/fly");
    await page
      .getByRole("button", { name: "Start flight", exact: true })
      .click();
    const deviation = page.getByTestId("vertical-deviation");
    await expect(deviation).toBeVisible();
    await expect(deviation.locator("[data-deviation-pointer]")).toBeVisible();
    await expect(deviation).toHaveAttribute("data-deviation-ft", /^-?\d+$/);
    if (available)
      await page.screenshot({ path: "test-results/vertical-deviation.png" });
    for (const event of ["TOC", "TOD"]) {
      const label = page.locator(
        `[data-profile-marker="${event}"] .legacy-route-label`,
      );
      await expect(label).toHaveText(event);
      await expect
        .poll(() =>
          page.evaluate((id) => {
            const label = document.querySelector(
              `[data-profile-marker="${id}"] .legacy-route-label`,
            );
            const point = document.querySelector("[data-route-marker]");
            if (!label || !point) return false;
            const typography = (element: Element) => {
              const s = getComputedStyle(element);
              return [
                s.fontFamily,
                s.fontSize,
                s.fontWeight,
                s.letterSpacing,
              ].join("|");
            };
            return typography(label) === typography(point);
          }, event),
        )
        .toBe(true);
    }
    await page.getByRole("button", { name: "FPL", exact: true }).click();
    const table = page.getByTestId("flight-plan-table");
    for (const event of ["TOC", "TOD"]) {
      const row = table.locator(`[data-profile-event="${event}"]`);
      await expect(row).toContainText(event);
      await expect(row).toContainText("5000");
      await expect(row.getByRole("button")).toHaveCount(0);
      await expect(row).not.toHaveAttribute("aria-current");
    }
    const profile = page.getByTestId("fpl-vertical-profile");
    await expect(profile).toBeVisible();
    await expect(profile.locator("[data-profile-flight-path]")).toHaveAttribute(
      "points",
      /\d+,\d+/,
    );
    const aircraft = profile.locator("[data-profile-aircraft]");
    await expect(aircraft).toBeVisible();
    const before = Number(await aircraft.getAttribute("data-distance-nm"));
    const altitudeBefore = Number(
      await aircraft.getAttribute("data-altitude-ft"),
    );
    await page.evaluate(() =>
      window.dispatchEvent(new Event("profile-position")),
    );
    await expect
      .poll(async () => Number(await aircraft.getAttribute("data-distance-nm")))
      .toBeGreaterThan(before + 1);
    await expect
      .poll(async () => Number(await aircraft.getAttribute("data-altitude-ft")))
      .toBeGreaterThan(altitudeBefore + 600);
    if (available) {
      await expect(
        profile.locator("[data-terrain-section]").first(),
      ).toBeVisible();
      await expect(profile.getByText(/Terrain incomplete/)).toHaveCount(0);
      await page.screenshot({ path: "test-results/fpl-terrain-profile.png" });
      for (const viewport of [
        { width: 1280, height: 720 },
        { width: 1024, height: 768 },
        { width: 390, height: 844 },
      ]) {
        await page.setViewportSize(viewport);
        const chart = await profile.getByRole("img").boundingBox();
        const panel = await page
          .getByRole("dialog", { name: "FPL", exact: true })
          .boundingBox();
        expect(chart!.y + chart!.height).toBeLessThanOrEqual(
          panel!.y + panel!.height,
        );
        expect(chart!.x + chart!.width).toBeLessThanOrEqual(viewport.width);
      }
      await page.route(
        "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/**",
        (route) => route.abort(),
      );
      await page.reload();
      await page.getByRole("button", { name: "FPL", exact: true }).click();
      await expect(
        profile.locator("[data-terrain-section]").first(),
      ).toBeVisible();
      await expect(profile.getByText(/Terrain incomplete/)).toHaveCount(0);
    } else {
      await expect(profile.getByText(/Terrain incomplete/)).toBeVisible();
      await expect(profile.locator("[data-terrain-section]")).toHaveCount(0);
    }
    await expect(table.locator('[aria-current="step"]')).toHaveCount(1);
    if (available) {
      const tod = profile
        .locator("g")
        .filter({ has: page.locator("text", { hasText: /^TOD$/ }) })
        .locator("circle");
      const before = await tod.getAttribute("cx");
      const cruise = page.getByRole("spinbutton", {
        name: "Cruise altitude (ft)",
        exact: true,
      });
      await cruise.fill("6500");
      await cruise.press("Enter");
      await expect(table.locator('[data-profile-event="TOD"]')).toContainText(
        "6500",
      );
      await expect.poll(() => tod.getAttribute("cx")).not.toBe(before);
      await expect(cruise).toHaveValue("6500");
      await page.reload();
      await page.getByRole("button", { name: "FPL", exact: true }).click();
      await expect(cruise).toHaveValue("6500");
      await expect(table.locator('[data-profile-event="TOD"]')).toContainText(
        "6500",
      );
    }
  });
}
