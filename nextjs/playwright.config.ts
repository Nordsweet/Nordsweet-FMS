import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.E2E_PORT) || 3100; // E2E_PORT: parallel checkouts

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // CI renders WebGL in software; concurrent flight maps starve page/recovery interactions.
  workers: process.env.CI ? 1 : undefined,
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: "on-first-retry",
    serviceWorkers: "block",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "node scripts/serve-export.mjs",
    env: { PORT: String(port) },
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: !process.env.CI,
  },
});
