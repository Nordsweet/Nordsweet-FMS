// Inventory of a live legacy screen: every visible input/select/button (label, type, options,
// value) and the visible text, after optional clicks. Run from nextjs/ (needs Playwright):
//   node scripts/legacy/crawl.mjs <root-selector> [click-selector ...] > inventory.json
//   e.g. node scripts/legacy/crawl.mjs '#aircraftFuelPanel' '[data-aircraft-tab="fuel"]'
// LEGACY_URL overrides the production URL; screenshots go to $LEGACY_DIR/crawl-*.png.
import { chromium } from "@playwright/test";

const url =
  process.env.LEGACY_URL ??
  "https://nordsweet-performance-calculator.mrnordsweet.chatgpt.site/";
const [root, ...clicks] = process.argv.slice(2);
if (!root)
  throw new Error("usage: crawl.mjs <root-selector> [click-selector ...]");
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.addInitScript(() =>
  localStorage.setItem("nordsweet.language.v1", "en"),
);
await page.goto(url, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
for (const selector of clicks) {
  await page.click(selector);
  await page.waitForTimeout(800);
}
const inventory = await page.evaluate((selector) => {
  const el = document.querySelector(selector);
  if (!el) return null;
  const visible = (e) =>
    !!(e.offsetWidth || e.offsetHeight || e.getClientRects().length);
  const label = (e) =>
    (e.id &&
      document.querySelector(`label[for="${e.id}"]`)?.innerText.trim()) ||
    e.closest("label")?.innerText.trim().slice(0, 80) ||
    e.getAttribute("aria-label") ||
    e.placeholder ||
    "";
  return {
    controls: [...el.querySelectorAll("input,select,textarea,button")]
      .filter(visible)
      .map((e) => ({
        tag: e.tagName.toLowerCase(),
        id: e.id,
        type: e.type,
        label: label(e),
        ...(e.tagName === "SELECT"
          ? { options: [...e.options].map((o) => o.text) }
          : e.tagName === "BUTTON"
            ? { text: e.innerText.trim() }
            : {
                value: e.type === "checkbox" ? e.checked : e.value,
                placeholder: e.placeholder,
              }),
      })),
    text: el.innerText,
  };
}, root);
await page.screenshot({
  path: `${process.env.LEGACY_DIR ?? "/tmp/nordsweet-legacy"}/crawl-${Date.now()}.png`,
  fullPage: true,
});
console.log(JSON.stringify(inventory, null, 2));
await browser.close();
