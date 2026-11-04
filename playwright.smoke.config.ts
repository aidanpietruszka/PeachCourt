import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  testMatch: ["smoke.spec.ts"],
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [["list"]],
  use: {
    baseURL: "https://peachcourt-c1b2c.web.app",
    browserName: "chromium",
    viewport: { width: 390, height: 844 },
    geolocation: { latitude: 33.7851, longitude: -84.3738 },
    permissions: ["geolocation"],
    trace: "retain-on-failure",
  },
});
