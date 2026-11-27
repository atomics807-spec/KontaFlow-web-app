import { defineConfig, devices } from "@playwright/test";

const APP_URL = "http://localhost:3000";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 120_000,
  expect: { timeout: 20_000 },
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: APP_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    viewport: { width: 1280, height: 900 },
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] }, testIgnore: /.*mobile\.spec\.ts/ },
    { name: "mobile", use: { ...devices["Pixel 7"] }, testMatch: /.*mobile\.spec\.ts/ },
  ],
  webServer: [
    {
      command: "npx tsx e2e/fake-openai.ts",
      url: "http://127.0.0.1:4010/health",
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
    {
      command: "npm run build > .e2e-build.log 2>&1 && npm run start > .e2e-server.log 2>&1",
      url: `${APP_URL}/en`,
      reuseExistingServer: false,
      timeout: 600_000,
      env: {
        ...process.env,
        NEXT_PUBLIC_APP_URL: APP_URL,
        OPENAI_API_KEY: "e2e-test-key",
        OPENAI_MODEL: "gpt-4.1-mini",
        OPENAI_BASE_URL: "http://127.0.0.1:4010/v1",
        SMS_PROVIDER: "console",
        USSD_CALLBACK_TOKEN: "e2e-ussd-token",
        WHATSAPP_VERIFY_TOKEN: "e2e-whatsapp-token",
        WHATSAPP_APP_SECRET: "e2e-whatsapp-secret",
      },
    },
  ],
});
