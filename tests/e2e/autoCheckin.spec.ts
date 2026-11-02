import { expect, test } from "@playwright/test";
import {
  COURTS,
  enableAutoCheckin,
  getUidByEmail,
  ionButton,
  liveCard,
  loggedEvents,
  newUser,
  openCourt,
  resetData,
  visibleText,
} from "./support";

test.beforeEach(async () => {
  await resetData();
});

async function setupAutoCheckin(browser: Parameters<typeof newUser>[0]) {
  const result = await newUser(browser, "Ana");
  const uid = await getUidByEmail(result.email);
  await enableAutoCheckin(uid);
  return result;
}

async function waitForCourts(page: Parameters<typeof liveCard>[0]) {
  await expect(
    page.locator(".courts-page__list ion-item").first(),
  ).toBeVisible();
}

async function waitForBanner(page: Parameters<typeof liveCard>[0]) {
  await expect(page.locator(".auto-banner")).toBeVisible({ timeout: 10_000 });
}

test("E2E-153 auto check-in banner appears after near-timer elapses", async ({
  browser,
}) => {
  const { context, page } = await setupAutoCheckin(browser);

  await page.goto("/courts");
  await waitForCourts(page);
  await waitForBanner(page);

  const banner = page.locator(".auto-banner");
  await expect(banner).toContainText(COURTS.alpha.name);
  await expect(banner).toContainText("Checked in automatically");

  const events = await loggedEvents("check_in");
  expect(events.length).toBeGreaterThanOrEqual(1);
  expect(events.at(-1)?.method).toBe("auto");
  await context.close();
});

test("E2E-154 tapping a range chip records the count and dismisses the banner", async ({
  browser,
}) => {
  const { context, page } = await setupAutoCheckin(browser);

  await page.goto("/courts");
  await waitForCourts(page);
  await waitForBanner(page);

  const banner = page.locator(".auto-banner");
  await banner.locator(".auto-banner__chip").filter({ hasText: "5–8" }).click();

  await expect(banner).not.toBeVisible();
  await openCourt(page, COURTS.alpha.name);
  await expect(liveCard(page)).toContainText("5–8 players");

  const events = await loggedEvents("count_updated");
  expect(events.length).toBeGreaterThanOrEqual(1);
  await context.close();
});

test("E2E-155 Skip dismisses the banner without adding a crowd report", async ({
  browser,
}) => {
  const { context, page } = await setupAutoCheckin(browser);

  await page.goto("/courts");
  await waitForCourts(page);
  await waitForBanner(page);

  const banner = page.locator(".auto-banner");
  await banner.locator("button").filter({ hasText: "Skip" }).click();
  await expect(banner).not.toBeVisible();

  const checkedInBar = page
    .locator(".courts-page__checked-in")
    .filter({ visible: true });
  await expect(checkedInBar).toBeVisible();

  await openCourt(page, COURTS.alpha.name);
  await expect(liveCard(page)).not.toContainText("players");
  await context.close();
});

test("E2E-156 Wrong court undoes the auto check-in", async ({ browser }) => {
  const { context, page } = await setupAutoCheckin(browser);

  await page.goto("/courts");
  await waitForCourts(page);
  await waitForBanner(page);

  const banner = page.locator(".auto-banner");
  await banner.locator("button").filter({ hasText: "Wrong court" }).click();

  await expect(banner).not.toBeVisible();
  const checkedInBar = page
    .locator(".courts-page__checked-in")
    .filter({ visible: true });
  await expect(checkedInBar).toHaveCount(0);
  await context.close();
});

test("E2E-157 auto check-out fires after away-timer elapses", async ({
  browser,
}) => {
  const { context, page } = await setupAutoCheckin(browser);

  await page.goto("/courts");
  await waitForCourts(page);
  await waitForBanner(page);

  const banner = page.locator(".auto-banner");
  await banner.locator("button").filter({ hasText: "Skip" }).click();

  const checkedInBar = page
    .locator(".courts-page__checked-in")
    .filter({ visible: true });
  await expect(checkedInBar).toBeVisible();

  await page.context().setGeolocation({ latitude: 33.85, longitude: -84.5 });
  await expect(checkedInBar).toHaveCount(0, { timeout: 10_000 });
  await context.close();
});

test("E2E-158 auto check-in does not fire when autoCheckin setting is off", async ({
  browser,
}) => {
  const { context, page } = await newUser(browser, "Ana");

  await page.goto("/courts");
  await waitForCourts(page);
  await page.waitForTimeout(4_000);

  await expect(page.locator(".auto-banner")).not.toBeVisible();
  await expect(
    page.locator(".courts-page__checked-in").filter({ visible: true }),
  ).toHaveCount(0);
  await context.close();
});

test("E2E-159 auto check-in does not fire when already checked in manually", async ({
  browser,
}) => {
  const { context, page } = await setupAutoCheckin(browser);

  await page.goto("/courts");
  await waitForCourts(page);
  await openCourt(page, COURTS.alpha.name);
  await ionButton(page.locator("ion-footer"), "Check in").click();
  await page
    .locator(".range-picker__row")
    .filter({ hasText: "A few" })
    .first()
    .waitFor({ state: "visible" });
  await page
    .locator(".range-picker__row")
    .filter({ hasText: "A few" })
    .first()
    .click();
  await ionButton(
    page.locator("ion-modal").filter({ visible: true }).last(),
    "Check in",
  ).click();
  await expect(visibleText(page, "You're checked in")).toBeVisible();
  await page
    .locator("ion-modal")
    .filter({ visible: true })
    .locator("ion-button")
    .filter({ hasText: "Done" })
    .click();

  await page.goto("/courts");
  await waitForCourts(page);
  await page.waitForTimeout(4_000);

  await expect(page.locator(".auto-banner")).not.toBeVisible();
  await context.close();
});
