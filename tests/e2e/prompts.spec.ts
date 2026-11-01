import { expect, test, type Page } from "@playwright/test";
import {
  alertButton,
  backToCourts,
  checkIn,
  closeConfirmation,
  COURTS,
  loggedEvents,
  newUser,
  openCourt,
  resetData,
  seedReport,
  visibleText,
} from "./support";

test.beforeEach(async () => {
  await resetData();
});

function trustPrompt(page: Page) {
  return page
    .locator("ion-alert")
    .filter({ hasText: "How much do you trust" })
    .filter({ visible: true });
}

test("E2E-23 the trust question shows once per session on courts with a report", async ({
  browser,
}) => {
  await seedReport(COURTS.alpha.id, 2);
  await seedReport(COURTS.beta.id, 2);
  const { context, page } = await newUser(browser, "Ana", {
    skipPrompts: false,
  });
  await openCourt(page, COURTS.alpha.name);
  await expect(
    visibleText(page, /How much do you trust "2–4 players"/),
  ).toBeVisible({
    timeout: 10_000,
  });
  await alertButton(page, "4").click();
  await expect(visibleText(page, "Thanks for your rating.")).toBeVisible();
  await expect
    .poll(() => loggedEvents("trust_rating"))
    .toEqual([expect.objectContaining({ rating: 4, liveCount: 2 })]);

  await backToCourts(page);
  await openCourt(page, COURTS.beta.name);
  await page.waitForTimeout(6_000);
  await expect(trustPrompt(page)).toHaveCount(0);
  await expect
    .poll(async () =>
      (await loggedEvents("court_viewed"))
        .map((event) => `${event.courtId}:${event.reportedCount}`)
        .sort(),
    )
    .toEqual([`${COURTS.alpha.id}:2`, `${COURTS.beta.id}:2`]);
  await context.close();
});

test("E2E-24 no trust question on a court without a report, and skipping is logged", async ({
  browser,
}) => {
  const { context, page } = await newUser(browser, "Ana", {
    skipPrompts: false,
  });
  await openCourt(page, COURTS.beta.name);
  await page.waitForTimeout(6_000);
  await expect(trustPrompt(page)).toHaveCount(0);
  await expect
    .poll(() => loggedEvents("court_viewed"))
    .toEqual([
      expect.objectContaining({
        courtId: COURTS.beta.id,
        reportedCount: null,
      }),
    ]);

  await seedReport(COURTS.alpha.id, 2);
  await backToCourts(page);
  await openCourt(page, COURTS.alpha.name);
  await expect(trustPrompt(page)).toHaveCount(1, { timeout: 10_000 });
  await alertButton(page, "Skip").click();
  await expect(trustPrompt(page)).toHaveCount(0);
  await expect
    .poll(() => loggedEvents("trust_skipped"))
    .toEqual([
      expect.objectContaining({ courtId: COURTS.alpha.id, liveCount: 2 }),
    ]);
  expect(await loggedEvents("trust_rating")).toEqual([]);
  await context.close();
});

test("E2E-25 skipping the feedback question is logged", async ({ browser }) => {
  const { context, page } = await newUser(browser, "Ana");
  await openCourt(page, COURTS.alpha.name);
  await checkIn(page, 2);
  await closeConfirmation(page);
  await expect(
    visibleText(page, "What would stop you doing this every time you arrive?"),
  ).toBeVisible();
  await alertButton(page, "Not now").click();
  await expect
    .poll(async () => (await loggedEvents("feedback_skipped")).length)
    .toBe(1);
  expect(await loggedEvents("checkin_feedback")).toEqual([]);
  await context.close();
});
