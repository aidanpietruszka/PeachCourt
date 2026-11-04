import { expect, test } from "@playwright/test";
import {
  COURTS,
  checkIn,
  dismissFeedbackIfShown,
  newUser,
  openCourt,
  postGame,
  resetData,
} from "./support";

test.beforeEach(async () => {
  await resetData();
});

async function goToMyActivity(page: import("@playwright/test").Page) {
  await page.goto("/activity");
  await expect(page.locator(".my-activity__title")).toBeVisible();
}

test("E2E-197 My Activity shows empty state before any activity", async ({ browser }) => {
  const { context, page } = await newUser(browser, "Ana");
  await goToMyActivity(page);
  await expect(page.locator(".my-activity__empty-heading")).toContainText("Nothing here yet");
  await expect(page.locator(".my-activity__find-btn")).toBeVisible();
  await context.close();
});

test("E2E-198 active check-in card appears in My Activity", async ({ browser }) => {
  const { context, page } = await newUser(browser, "Ana");
  await openCourt(page, COURTS.alpha.name);
  await checkIn(page, 5);
  await dismissFeedbackIfShown(page);
  await goToMyActivity(page);
  await expect(page.locator(".my-activity__active-card")).toBeVisible();
  await expect(page.locator(".my-activity__active-card")).toContainText("Checked in");
  await expect(page.locator(".my-activity__active-btn--primary")).toBeVisible();
  await expect(page.locator(".my-activity__active-btn--outline")).toBeVisible();
  await context.close();
});

test("E2E-199 upcoming game appears in My Activity Games tab", async ({ browser }) => {
  const { context, page } = await newUser(browser, "Ana");
  await openCourt(page, COURTS.alpha.name);
  await postGame(page, { skill: "Any level" });
  await goToMyActivity(page);
  await expect(page.locator(".my-activity__section-label")).toContainText("Upcoming");
  await expect(page.locator(".my-activity__row").first()).toBeVisible();
  await expect(page.locator(".my-activity__pill--hosting")).toBeVisible();
  await context.close();
});

test("E2E-200 Update count from My Activity saves a new court report", async ({ browser }) => {
  const { context, page } = await newUser(browser, "Ana");
  await openCourt(page, COURTS.alpha.name);
  await checkIn(page, 5);
  await dismissFeedbackIfShown(page);
  await goToMyActivity(page);
  await page.locator(".my-activity__active-btn--primary").click();
  await expect(page.locator(".my-activity__update-heading")).toContainText("How many players now?");
  await page.locator(".my-activity__update-row").filter({ hasText: "A few" }).click();
  await page.locator(".my-activity__update-save").click();
  await expect(page.locator(".my-activity__update-heading")).not.toBeVisible();
  await context.close();
});
