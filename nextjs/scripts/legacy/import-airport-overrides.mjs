// Applies the legacy planner's merged airport data (ground-data.js runway/threshold/elevation
// overrides on top of airports.js) to public/data/airports.json. The merge runs inside the legacy
// runtime, so this reads `window.NORDSWEET_AIRPORTS` from the live legacy app. Run from nextjs/:
//   node scripts/legacy/import-airport-overrides.mjs
import fs from "node:fs";
import path from "node:path";

import { chromium } from "@playwright/test";

const url =
  process.env.LEGACY_URL ??
  "https://nordsweet-performance-calculator.mrnordsweet.chatgpt.site/";
const browser = await chromium.launch();
const page = await browser.newPage();
await page.route(
  (u) => !u.href.startsWith(url),
  (r) => r.abort(),
);
await page.goto(url, { waitUntil: "load" });
await page.waitForFunction(() => Array.isArray(window.NORDSWEET_AIRPORTS));
const legacy = await page.evaluate(() => window.NORDSWEET_AIRPORTS);
await browser.close();

const file = path.resolve(
  import.meta.dirname,
  "../../public/data/airports.json",
);
const airports = JSON.parse(fs.readFileSync(file, "utf8"));
const positive = (v) =>
  Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : null;
const surfaces = new Set(["asphalt", "concrete", "paved", "grass", "unknown"]);
let changed = 0;
for (const airport of airports) {
  const l = legacy.find((a) => a.icao === airport.ident);
  if (!l) continue;
  const before = JSON.stringify(airport);
  airport.elevationFt = Number(l.elevation);
  airport.lat = Number(l.lat);
  airport.lon = Number(l.lon);
  airport.runways = l.runways.map((r) => {
    const ours = airport.runways.find((o) => o.designator === r.id);
    const t = r.threshold ?? {};
    const hasThreshold =
      Number.isFinite(t.lat) &&
      Number.isFinite(t.lon) &&
      (t.lat !== 0 || t.lon !== 0);
    return {
      designator: r.id,
      trueHeadingDeg: Number(r.hdg),
      surface:
        ours?.surface ?? (surfaces.has(r.surface) ? r.surface : "unknown"),
      lengthM: positive(r.length_m),
      widthM: positive(r.width_m) ?? ours?.widthM ?? null,
      slopePct: Number(r.slope) || 0,
      toraM: positive(r.tora),
      todaM: positive(r.toda),
      asdaM: positive(r.asda),
      ldaM: positive(r.lda),
      threshold: hasThreshold
        ? {
            lat: t.lat,
            lon: t.lon,
            elevationFt: ours?.threshold?.elevationFt ?? Number(l.elevation),
          }
        : null,
    };
  });
  if (JSON.stringify(airport) !== before) changed++;
}
fs.writeFileSync(file, JSON.stringify(airports));
console.log(`airports: ${changed} of ${airports.length} updated from legacy`);
