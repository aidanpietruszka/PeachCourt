import { expect, test } from "@playwright/test";
import {
  COURTS,
  getUidByEmail,
  newUser,
  openCourt,
  postGame,
  resetData,
  seedAlert,
  visibleText,
} from "./support";

test.beforeEach(async () => {
  await resetData();
});

test("E2E-189 bell shows unread badge when alerts exist", async ({ browser }) => {
  const { context, page, email } = await newUser(browser, "Ana");
  const uid = await getUidByEmail(email);
  await seedAlert(uid);
  await page.reload();
  const bell = page.locator(".notif-bell");
  await expect(bell).toBeVisible();
  await expect(bell.locator(".notif-bell__badge")).toBeVisible();
  await context.close();
});

test("E2E-190 bell badge clears after mark all read", async ({ browser }) => {
  const { context, page, email } = await newUser(browser, "Ana");
  const uid = await getUidByEmail(email);
  await seedAlert(uid);
  await page.reload();
  const bell = page.locator(".notif-bell").first();
  await bell.click();
  await expect(page).toHaveURL(/\/notifications$/);
  const markAll = page.locator("button").filter({ hasText: "Mark all read" });
  await expect(markAll).toBeVisible();
  await markAll.click();
  await page.locator(".inbox__back").click();
  await expect(page.locator(".notif-bell__badge").first()).toHaveCount(0);
  await context.close();
});

test("E2E-191 inbox shows today and earlier groups", async ({ browser }) => {
  const { context, page, email } = await newUser(browser, "Ana");
  const uid = await getUidByEmail(email);
  await seedAlert(uid);
  await seedAlert(uid, {
    createdAt: { timestampValue: new Date(Date.now() - 2 * 86_400_000).toISOString() },
    read: true,
  });
  await page.reload();
  await page.locator(".notif-bell").first().click();
  await expect(page).toHaveURL(/\/notifications$/);
  await expect(visibleText(page, "Today")).toBeVisible();
  await expect(visibleText(page, "Earlier")).toBeVisible();
  await context.close();
});

test("E2E-192 in-app banner appears when new alert is seeded", async ({ browser }) => {
  const { context, page, email } = await newUser(browser, "Ana");
  await openCourt(page, COURTS.alpha.name);
  await postGame(page, { skill: "Any level" });
  const uid = await getUidByEmail(email);
  await seedAlert(uid, { gameFormat: "singles", gameSport: "tennis", spotsOpen: 1 });
  await expect(page.locator(".alert-banner")).toBeVisible({ timeout: 8_000 });
  await context.close();
});
