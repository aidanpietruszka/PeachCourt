import { expect, test, type BrowserContext } from "@playwright/test";
import {
  APP_URL,
  PIEDMONT_PARK,
  getAbGroup,
  getUidByEmail,
  loggedEvents,
  resetData,
  seedUserProfile,
  signUp,
} from "./support";

test.beforeEach(async () => {
  await resetData();
});

async function mockLocationGranted(context: BrowserContext) {
  await context.addInitScript(() => {
    Object.defineProperty(navigator, "permissions", {
      value: {
        query: (desc: { name: string }) => {
          if (desc.name === "geolocation") {
            return Promise.resolve({ state: "granted" });
          }
          return Promise.resolve({ state: "prompt" });
        },
      },
      configurable: true,
    });
  });
}

async function goToStep2(page: Parameters<typeof signUp>[0], email: string) {
  await page.goto("/signup");
  await page.getByPlaceholder("Email").fill(email);
  await page.getByPlaceholder("Password (6+ characters)").fill("secret123");
  await page.getByPlaceholder("Confirm password").fill("secret123");
  await page.getByRole("button", { name: "Sign up", exact: true }).click();
  await page.getByLabel("First name").fill("Ab");
  await page.getByLabel("Last name").fill("Test");
  await page.getByRole("button", { name: "Tennis" }).click();
  await page.locator(".onboarding__skill-row").first().click();
  await expect(page.locator("ion-action-sheet")).toBeVisible();
  await page.locator("ion-action-sheet button").filter({ hasText: "3.5" }).click();
  await page.getByRole("button", { name: "Next" }).click();
  await expect(page.getByText("Use your location")).toBeVisible();
}

test("E2E-160 abGroup is written to user doc after step 1 Next", async ({
  browser,
}) => {
  const context = await browser.newContext({
    baseURL: APP_URL,
    viewport: { width: 390, height: 844 },
    geolocation: PIEDMONT_PARK,
    permissions: ["geolocation"],
  });
  const page = await context.newPage();
  const email = `ab160-${Date.now()}@test.dev`;
  await goToStep2(page, email);

  const uid = await getUidByEmail(email);
  const group = await getAbGroup(uid);
  expect(group === "auto_on" || group === "auto_off").toBe(true);
  await context.close();
});

test("E2E-161 auto check-in toggle matches A/B group when location enabled", async ({
  browser,
}) => {
  const context = await browser.newContext({
    baseURL: APP_URL,
    viewport: { width: 390, height: 844 },
    geolocation: PIEDMONT_PARK,
    permissions: ["geolocation"],
  });
  await mockLocationGranted(context);
  const page = await context.newPage();
  const email = `ab161-${Date.now()}@test.dev`;
  await goToStep2(page, email);

  await page.locator("ion-toggle[aria-label='Use my location']").click();
  await expect(
    page.locator("ion-toggle[aria-label='Automatic check-in']"),
  ).not.toBeDisabled();

  const uid = await getUidByEmail(email);
  const group = await getAbGroup(uid);

  const autoToggle = page.locator("ion-toggle[aria-label='Automatic check-in']");
  if (group === "auto_on") {
    await expect(autoToggle).toBeChecked();
  } else {
    await expect(autoToggle).not.toBeChecked();
  }
  await context.close();
});

test("E2E-162 user can override the A/B default toggle value", async ({
  browser,
}) => {
  const context = await browser.newContext({
    baseURL: APP_URL,
    viewport: { width: 390, height: 844 },
    geolocation: PIEDMONT_PARK,
    permissions: ["geolocation"],
  });
  await mockLocationGranted(context);
  const page = await context.newPage();
  const email = `ab162-${Date.now()}@test.dev`;
  await goToStep2(page, email);

  await page.locator("ion-toggle[aria-label='Use my location']").click();

  const uid = await getUidByEmail(email);
  const group = await getAbGroup(uid);

  const autoToggle = page.locator("ion-toggle[aria-label='Automatic check-in']");
  await expect(autoToggle).not.toBeDisabled();
  await autoToggle.click();

  if (group === "auto_on") {
    await expect(autoToggle).not.toBeChecked();
  } else {
    await expect(autoToggle).toBeChecked();
  }
  await context.close();
});

test("E2E-163 manually toggling auto check-in in step 2 logs setting_changed", async ({
  browser,
}) => {
  const context = await browser.newContext({
    baseURL: APP_URL,
    viewport: { width: 390, height: 844 },
    geolocation: PIEDMONT_PARK,
    permissions: ["geolocation"],
  });
  await mockLocationGranted(context);
  const page = await context.newPage();
  const email = `ab163-${Date.now()}@test.dev`;
  await goToStep2(page, email);

  await page.locator("ion-toggle[aria-label='Use my location']").click();
  const autoToggle = page.locator("ion-toggle[aria-label='Automatic check-in']");
  await expect(autoToggle).not.toBeDisabled();
  await autoToggle.click();

  const uid = await getUidByEmail(email);
  const group = await getAbGroup(uid);

  const events = await loggedEvents("auto_checkin_changed");
  expect(events.length).toBeGreaterThanOrEqual(1);
  const last = events.at(-1)!;
  expect(last.variant).toBe(group);
  await context.close();
});

test("E2E-164 toggling auto check-in in Settings logs auto_checkin_changed with variant", async ({
  page,
}) => {
  const email = await signUp(page, "Ab");
  const uid = await getUidByEmail(email);
  await seedUserProfile(uid, { locationEnabled: true });

  await page.goto("/settings");
  await expect(page.getByText("Automatic check-in")).toBeVisible();

  const autoToggle = page.locator("ion-toggle[aria-label='Automatic check-in']");
  await expect(autoToggle).not.toBeDisabled();
  await autoToggle.click();

  await page.waitForTimeout(2000);

  const group = await getAbGroup(uid);
  const events = await loggedEvents("auto_checkin_changed");
  expect(events.length).toBeGreaterThanOrEqual(1);
  const last = events.at(-1)!;
  expect(last.variant).toBe(group);
});
