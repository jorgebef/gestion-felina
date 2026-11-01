import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests of the main user journey. They run against a dev server whose
 * DATABASE_URL is a migrated database with the municipality catalogue (`vp run db:setup`).
 *
 *   vp run test:e2e
 */
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL,
    locale: "es-ES",
    timezoneId: "Europe/Madrid",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    // Uses the locally installed Google Chrome (no browser download needed).
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], channel: "chrome" },
      testIgnore: /responsive/,
    },
    { name: "mobile", use: { ...devices["Pixel 7"], channel: "chrome" }, testMatch: /responsive/ },
  ],
  webServer: {
    command: "vp run dev",
    url: baseURL,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
