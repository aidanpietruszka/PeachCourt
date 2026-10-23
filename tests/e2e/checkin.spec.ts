import { expect, test } from "@playwright/test";
import {
  alertButton,
  alertInput,
  backToCourts,
  checkIn,
  closeConfirmation,
  COURTS,
  dismissFeedbackIfShown,
  ionButton,
  liveCard,
  newUser,
  openCourt,
  resetData,
  visibleText,
} from "./support";

test.beforeEach(async () => {
  await resetData();
});

test("E2E-10 reported shows the latest head count, checked in counts people", async ({
  browser,
}) => {
  const a = await newUser(browser, "Ana");
  const b = await newUser(browser, "Ben");
  await openCourt(a.page, COURTS.alpha.name);
  await openCourt(b.page, COURTS.alpha.name);

  await checkIn(a.page, 3);
  await expect(visibleText(a.page, "3 reported here")).toBeVisible();
  await closeConfirmation(a.page);
  await dismissFeedbackIfShown(a.page);
  await expect(liveCard(b.page)).toContainText("3 reported");
  await expect(liveCard(b.page)).toContainText("1 checked in");

  await checkIn(b.page, 2);
  await closeConfirmation(b.page);
  await dismissFeedbackIfShown(b.page);
  await expect(liveCard(a.page)).toContainText("2 reported");
  await expect(liveCard(a.page)).toContainText("2 checked in");
  await expect(liveCard(b.page)).toContainText("You're checked in here.");

  await a.context.close();
  await b.context.close();
});

test("E2E-11 report stays after the last reporter checks out", async ({
  browser,
}) => {
  const a = await newUser(browser, "Ana");
  const b = await newUser(browser, "Ben");
  await openCourt(a.page, COURTS.alpha.name);
  await openCourt(b.page, COURTS.alpha.name);
  await checkIn(a.page, 3);
  await closeConfirmation(a.page);
  await dismissFeedbackIfShown(a.page);
  await checkIn(b.page, 2);
  await closeConfirmation(b.page);
  await dismissFeedbackIfShown(b.page);

  await backToCourts(b.page);
  const bar = b.page
    .locator(".courts-page__checked-in")
    .filter({ visible: true });
  await expect(bar).toContainText(`Checked in at ${COURTS.alpha.name}`);
  await ionButton(bar, "Check out").click();
  await expect(bar).toHaveCount(0);

  await expect(liveCard(a.page)).toContainText("2 reported");
  await expect(liveCard(a.page)).toContainText("1 checked in");
  await a.context.close();
  await b.context.close();
});

test("E2E-12 check out from the court page and from the confirmation screen", async ({
  browser,
}) => {
  const { context, page } = await newUser(browser, "Ana");
  await openCourt(page, COURTS.alpha.name);
  await checkIn(page, 2);
  await ionButton(page.locator("ion-modal"), "Check out").click();
  await dismissFeedbackIfShown(page);
  await expect(visibleText(page, "You are checked out.")).toBeVisible();
  await expect(liveCard(page)).toContainText("0 checked in");

  await checkIn(page, 2);
  await closeConfirmation(page);
  await dismissFeedbackIfShown(page);
  await ionButton(page.locator("ion-footer"), "Check out").click();
  await expect(liveCard(page)).toContainText("0 checked in");
  await context.close();
});

test("E2E-13 checking in at a second court moves you", async ({ browser }) => {
  const { context, page } = await newUser(browser, "Ana");
  await openCourt(page, COURTS.alpha.name);
  await checkIn(page, 2);
  await closeConfirmation(page);
  await dismissFeedbackIfShown(page);
  await backToCourts(page);
  await openCourt(page, COURTS.beta.name);
  await expect(liveCard(page)).toContainText("checked in at another court");
  await checkIn(page, 4);
  await closeConfirmation(page);
  await backToCourts(page);
  const bar = page
    .locator(".courts-page__checked-in")
    .filter({ visible: true });
  await expect(bar).toContainText(`Checked in at ${COURTS.beta.name}`);
  await context.close();
});

test("E2E-14 head count must be 1 to 20", async ({ browser }) => {
  const { context, page } = await newUser(browser, "Ana");
  await openCourt(page, COURTS.alpha.name);
  await ionButton(page.locator("ion-footer"), "Check in").click();
  await alertInput(page).fill("0");
  await alertButton(page, "Check in").click();
  await expect(
    visibleText(page, "Enter a number of players from 1 to 20."),
  ).toBeVisible();
  await expect(liveCard(page)).toContainText("0 checked in");
  await context.close();
});

test("E2E-15 the feedback question shows after the first check-in only", async ({
  browser,
}) => {
  const { context, page } = await newUser(browser, "Ana");
  await openCourt(page, COURTS.alpha.name);
  await checkIn(page, 2);
  await closeConfirmation(page);
  await expect(
    visibleText(page, "What would stop you doing this every time you arrive?"),
  ).toBeVisible();
  await alertButton(page, "Privacy").click();
  await expect(
    visibleText(page, "Thanks for sharing your feedback."),
  ).toBeVisible();

  await ionButton(page.locator("ion-footer"), "Check out").click();
  await checkIn(page, 2);
  await closeConfirmation(page);
  await expect(
    page
      .locator("ion-alert")
      .filter({ hasText: "What would stop you" })
      .filter({ visible: true }),
  ).toHaveCount(0);
  await context.close();
});

test("E2E-16 the map pin and list row turn active after a check-in", async ({
  browser,
}) => {
  const { context, page } = await newUser(browser, "Ana");
  await openCourt(page, COURTS.alpha.name);
  await checkIn(page, 3);
  await closeConfirmation(page);
  await dismissFeedbackIfShown(page);
  await backToCourts(page);
  const row = page
    .locator(".courts-page__list ion-item")
    .filter({ hasText: COURTS.alpha.name });
  await expect(row.locator(".courts-page__activity--active")).toContainText(
    "3 reported · 0 open games",
  );
  await expect(page.locator(".court-pin--active")).toHaveCount(1);
  await context.close();
});
