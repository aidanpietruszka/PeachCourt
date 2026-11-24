import { defineConfig, devices } from "@playwright/test";

const APP_PORT = process.env.E2E_APP_PORT ?? "5174";
const APP_URL = `http://127.0.0.1:${APP_PORT}`;

export default defineConfig({
  testDir: "tests/e2e",
  testIgnore: ["smoke.spec.ts"],
  outputDir: process.env.E2E_OUTPUT_DIR ?? "test-results",
  fullyParallel: false,
  workers: 1,
  retries: 2,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [["list"]],
  use: {
    baseURL: APP_URL,
    geolocation: { latitude: 33.7851, longitude: -84.3738 },
    permissions: ["geolocation"],
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "iPhone",
      use: { ...devices["iPhone 14"] },
    },
    {
      name: "Android",
      use: { ...devices["Pixel 7"] },
    },
  ],
  webServer: {
    command: `vite --host 127.0.0.1 --port ${APP_PORT} --strictPort`,
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
      VITE_EMU_AUTH_PORT: process.env.E2E_AUTH_PORT ?? "9099",
      VITE_EMU_FIRESTORE_PORT: process.env.E2E_FIRESTORE_PORT ?? "8080",
      VITE_EMU_FUNCTIONS_PORT: process.env.E2E_FUNCTIONS_PORT ?? "5001",
      VITE_AUTO_NEAR_MS: "2000",
      VITE_AUTO_AWAY_MS: "2000",
      VITE_AUTO_INTERVAL_MS: "400",
    },
  },
});
