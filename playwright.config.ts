import { defineConfig, devices } from "@playwright/test";

const isCI = Boolean(process.env.CI);
const allBrowsers = isCI || Boolean(process.env.ALL_BROWSERS);

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  timeout: 30000,
  workers: isCI ? 2 : undefined,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:5173",
    actionTimeout: 5000,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    ...(allBrowsers
      ? [{ name: "firefox", use: { ...devices["Desktop Firefox"] } }]
      : []),
  ],
  webServer: {
    command: "yarn dev --port 5173 --strictPort",
    url: "http://127.0.0.1:5173",
    reuseExistingServer: !isCI,
  },
});
