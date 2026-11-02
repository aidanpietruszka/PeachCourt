import { defineConfig } from "@playwright/test";

const APP_URL = "http://127.0.0.1:5174";

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [["list"]],
  use: {
    baseURL: APP_URL,
    browserName: "chromium",
    viewport: { width: 390, height: 844 },
    geolocation: { latitude: 33.7851, longitude: -84.3738 },
    permissions: ["geolocation"],
    trace: "retain-on-failure",
  },
  webServer: {
    command: "vite --host 127.0.0.1 --port 5174 --strictPort",
    url: APP_URL,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      VITE_USE_EMULATORS: "true",
      VITE_FIREBASE_API_KEY: "demo-key",
      VITE_FIREBASE_AUTH_DOMAIN: "127.0.0.1",
      VITE_FIREBASE_PROJECT_ID: "demo-peachcourt",
      VITE_FIREBASE_STORAGE_BUCKET: "",
      VITE_FIREBASE_MESSAGING_SENDER_ID: "",
      VITE_FIREBASE_APP_ID: "demo-app",
      VITE_AUTO_NEAR_MS: "2000",
      VITE_AUTO_AWAY_MS: "2000",
      VITE_AUTO_INTERVAL_MS: "400",
    },
  },
});
