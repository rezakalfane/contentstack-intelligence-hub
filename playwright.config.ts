import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3100); // E2E_PORT=3000 reuses a running dev server
export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: { baseURL: `http://localhost:${PORT}`, trace: "retain-on-failure" },
  projects: [
    {
      name: "desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
        // Optional: reuse an already-installed Chromium (PW_CHROMIUM_PATH) instead of downloading browsers.
        launchOptions: process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {},
      },
    },
  ],
  webServer: {
    command: `npx next dev -p ${PORT}`,
    url: `http://localhost:${PORT}/overview`,
    reuseExistingServer: true,
    timeout: 120_000,
    // The demo needs no credentials or network; the cookie below pins DEMO mode regardless of .env.local.
    env: { DATA_MODE: "demo" },
  },
});
