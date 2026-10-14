import { expect, test } from "@playwright/test";

// A short local flight from EPKK (792 ft): taxi, take-off roll, climb to
// 3000 ft, cruise, descent, landing roll and stop. Altitudes are MSL.
function flightGpx() {
  const start = Date.parse("2026-10-13T10:00:00Z");
  const points: { lat: number; lon: number; ft: number }[] = [];
  let lat = 50.0777;
  let lon = 19.7848;
  let ft = 792;
  const go = (n: number, kt: number, trackDeg: number, fpm: number) => {
    for (let i = 0; i < n; i++) {
      const nm = kt / 3600;
      lat += (nm / 60) * Math.cos((trackDeg * Math.PI) / 180);
      lon +=
        ((nm / 60) * Math.sin((trackDeg * Math.PI) / 180)) /
        Math.cos((lat * Math.PI) / 180);
      ft = Math.max(792, Math.min(3000, ft + fpm / 60));
      points.push({ lat, lon, ft });
    }
  };
  go(20, 10, 180, 0); // taxi
  for (let i = 0; i < 12; i++) go(1, 20 + i * 4, 250, 0); // accelerating roll on 250
  go(140, 80, 250, 1000); // climb through +50 ft, on to 3000 ft
  go(20, 100, 250, 0); // cruise
  go(200, 90, 70, -700); // descent back towards the field
  go(20, 20, 70, 0); // landing roll
  go(20, 0, 70, 0); // stopped
  const trkpts = points
    // Keep source time/distance/altitude, but avoid 432 React commits at 20x on a CPU-only CI map.
    // Five-second GPS samples still cover every phase and the stopped/on-block dwell.
    .map(
      (p, i) =>
        `<trkpt lat="${p.lat.toFixed(6)}" lon="${p.lon.toFixed(6)}"><ele>${(p.ft * 0.3048).toFixed(1)}</ele><time>${new Date(start + i * 1000).toISOString()}</time></trkpt>`,
    )
    .filter((_, i) => i % 5 === 0 || i === points.length - 1)
    .join("");
  return `<?xml version="1.0"?><gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1"><trk><trkseg>${trkpts}</trkseg></trk></gpx>`;
}

test.beforeEach(async ({ page }) => {
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => route.abort());
  await page.addInitScript(() => {
    if (!localStorage.getItem("nordsweet.settings.v2"))
      localStorage.setItem("nordsweet.language.v1", "en");
  });
});

test("a replayed GPX flight drives the timers, events and phases", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await page.goto("/");
  await page.getByRole("tab", { name: "Route", exact: true }).click();
  await page.getByLabel("Departure", { exact: true }).fill("EPKK");
  await page.keyboard.press("Escape");
  await page.getByLabel("Arrival", { exact: true }).fill("EPKK");
  await page.keyboard.press("Escape");
  await page.getByLabel("Arrival", { exact: true }).fill("EPWA");
  await page.keyboard.press("Escape");
  await page.getByRole("link", { name: /start a flight/i }).click();

  await page.getByRole("button", { name: "Options", exact: true }).click();
  await page.getByLabel("Debug with GPX").check();
  await page.getByLabel("Load GPX").setInputFiles({
    name: "flight.gpx",
    mimeType: "application/gpx+xml",
    buffer: Buffer.from(flightGpx()),
  });
  await page.getByLabel("GPX playback speed").selectOption("20");
  await page
    .getByTestId("gpx-replay")
    .getByRole("button", { name: "START" })
    .click();

  const events = page.getByRole("list", { name: "Events" });
  await expect(
    page.getByRole("button", { name: "Climb", exact: true }),
  ).toHaveAttribute("aria-pressed", "true", { timeout: 20_000 });
  await expect(events).toContainText("Top of Climb", { timeout: 30_000 });
  await expect(
    page.getByRole("button", { name: "Cruise", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(events).toContainText("On-block", { timeout: 40_000 });
  for (const name of ["Off-block", "Take-off", "Top of Descent", "Landing"])
    await expect(events).toContainText(name);
  await expect(
    page.getByRole("button", { name: "Taxi-In", exact: true }),
  ).toHaveAttribute("aria-pressed", "true", { timeout: 10_000 });
  await expect(page.getByTestId("timer-airTime")).not.toHaveText("--:--:--");
});
