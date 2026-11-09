import { defineConfig, devices } from "@playwright/test";
import "dotenv/config";

// E2E runs the production build against the TEST database on port 3100.
// Prereq: `npm run build`.
const PORT = 3100;
// Each run looks like a distinct client IP (as a real proxy would set it), so the
// production rate limits (e.g. 10 registrations/hour/IP) don't trip on repeated runs.
const RUN_IP = `10.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;
export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: { baseURL: `http://localhost:${PORT}`, trace: "retain-on-failure", extraHTTPHeaders: { "x-forwarded-for": RUN_IP } },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] }, testIgnore: /mobile\.spec/ },
    { name: "mobile", use: { ...devices["Pixel 7"] }, testMatch: /mobile\.spec/ },
  ],
  webServer: {
    command: `npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/api/health`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      DATABASE_URL: process.env.TEST_DATABASE_URL ?? "",
      APP_URL: `http://localhost:${PORT}`,
      CRON_SECRET: "e2e-cron-secret-0123456789",
    },
  },
});
