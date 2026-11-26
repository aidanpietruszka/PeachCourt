import { expect, test } from "@playwright/test";
import {
  COURTS,
  freshContext,
  getUidByEmail,
  notificationRequestCount,
  resetData,
  seedUserProfile,
  setNotificationPermission,
  setNotificationRequestResult,
  setStandalone,
  signUp,
  waitForDocument,
} from "./support";

test.beforeEach(async () => {
  await resetData();
});

async function showCardFor(
  browser: Parameters<typeof freshContext>[0],
  request?: "granted" | "denied",
) {
  const context = await freshContext(browser);
  await setStandalone(context);
  if (request) {
    await setNotificationRequestResult(context, request);
  } else {
    await setNotificationPermission(context, "prompt");
  }
  const page = await context.newPage();
  const email = await signUp(page, "Ana");
  const uid = await getUidByEmail(email);
  await expect(page.getByText(COURTS.alpha.name)).toBeVisible();
  return { context, page, uid };
}

test("E2E-237 the app asks for no notification permission on load without a tap", async ({
  browser,
}) => {
  const context = await freshContext(browser);
  await setStandalone(context);
  await setNotificationPermission(context, "prompt");
  const page = await context.newPage();
  const email = await signUp(page, "Ana");
  const uid = await getUidByEmail(email);
  await seedUserProfile(uid, {
    onboardingDone: true,
    notificationsPrompted: false,
  });
  await page.reload();
  await expect(page.getByText(COURTS.alpha.name)).toBeVisible();
  expect(await notificationRequestCount(page)).toBe(0);
  await context.close();
});

test("E2E-238 a user who skipped onboarding notifications still sees the card", async ({
  browser,
}) => {
  const { context, page } = await showCardFor(browser);
  await expect(page.locator(".game-alerts-card")).toBeVisible();
  await expect(page.locator(".game-alerts-card__title")).toHaveText(
    "Turn on game alerts",
  );
  await context.close();
});

test("E2E-239 the card is hidden when the Notifications switch is off", async ({
  browser,
}) => {
  const context = await freshContext(browser);
  await setStandalone(context);
  await setNotificationPermission(context, "prompt");
  const page = await context.newPage();
  const email = await signUp(page, "Ana");
  const uid = await getUidByEmail(email);
  await seedUserProfile(uid, { notificationsEnabled: false });
  await page.reload();
  await expect(page.getByText(COURTS.alpha.name)).toBeVisible();
  await expect(page.locator(".game-alerts-card")).toHaveCount(0);
  await context.close();
});

test("E2E-240 Not now hides the card for good and persists", async ({
  browser,
}) => {
  const { context, page, uid } = await showCardFor(browser);
  const card = page.locator(".game-alerts-card");
  await expect(card).toBeVisible();
  await page.locator(".game-alerts-card__not-now").click();
  await expect(card).toHaveCount(0);
  await expect
    .poll(async () => (await waitForDocument(`users/${uid}`)).gameAlertsCardDismissed)
    .toBe(true);
  await page.reload();
  await expect(page.getByText(COURTS.alpha.name)).toBeVisible();
  await expect(card).toHaveCount(0);
  await context.close();
});

test("E2E-241 Turn on allowed enables alerts and removes the card", async ({
  browser,
}) => {
  const { context, page, uid } = await showCardFor(browser, "granted");
  const card = page.locator(".game-alerts-card");
  await expect(card).toBeVisible();
  await page.locator(".game-alerts-card__turn-on").click();
  await expect(card).toHaveCount(0);
  await expect
    .poll(async () => (await waitForDocument(`users/${uid}`)).notificationsEnabled)
    .toBe(true);
  await context.close();
});

test("E2E-244 Turn on denied removes the card and does not enable alerts", async ({
  browser,
}) => {
  const { context, page, uid } = await showCardFor(browser, "denied");
  const card = page.locator(".game-alerts-card");
  await expect(card).toBeVisible();
  await page.locator(".game-alerts-card__turn-on").click();
  await expect(card).toHaveCount(0);
  await expect
    .poll(async () => (await waitForDocument(`users/${uid}`)).notificationsEnabled)
    .toBe(false);
  await context.close();
});

test("E2E-242 a legacy profile marked prompted still sees the card", async ({
  browser,
}) => {
  const context = await freshContext(browser);
  await setStandalone(context);
  await setNotificationPermission(context, "prompt");
  const page = await context.newPage();
  const email = await signUp(page, "Ana");
  const uid = await getUidByEmail(email);
  await seedUserProfile(uid, { notificationsPrompted: true });
  await page.reload();
  await expect(page.getByText(COURTS.alpha.name)).toBeVisible();
  await expect(page.locator(".game-alerts-card")).toBeVisible();
  await context.close();
});

test("E2E-243 the card never shows in a Safari tab on an iPhone", async ({
  browser,
}) => {
  test.skip(
    test.info().project.name !== "iPhone",
    "Safari-tab exclusion only applies to the iPhone project",
  );
  const context = await freshContext(browser);
  await setNotificationPermission(context, "prompt");
  const page = await context.newPage();
  await signUp(page, "Ana");
  await expect(page.getByText(COURTS.alpha.name)).toBeVisible();
  await expect(page.locator(".game-alerts-card")).toHaveCount(0);
  await context.close();
});
