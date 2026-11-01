import { expect, test } from "@playwright/test";
import {
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

test("E2E-10 reported shows the range label, checked in counts people", async ({
  browser,
}) => {
  const a = await newUser(browser, "Ana");
  const b = await newUser(browser, "Ben");
  await openCourt(a.page, COURTS.alpha.name);
  await openCourt(b.page, COURTS.alpha.name);

  await checkIn(a.page, 3);
  await expect(visibleText(a.page, "2–4 players")).toBeVisible();
  await closeConfirmation(a.page);
  await dismissFeedbackIfShown(a.page);
  await expect(liveCard(b.page)).toContainText("2–4 players");
  await expect(liveCard(b.page)).toContainText("1 checked in");

  await checkIn(b.page, 2);
  await closeConfirmation(b.page);
  await dismissFeedbackIfShown(b.page);
  await expect(liveCard(a.page)).toContainText("2–4 players");
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

  await expect(liveCard(a.page)).toContainText("2–4 players");
  await expect(liveCard(a.page)).toContainText("1 checked in");
  await a.context.close();
  await b.context.close();
});

test("E2E-12 check out from the confirmation screen and from the courts bar", async ({
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
  await backToCourts(page);
  const bar = page.locator(".courts-page__checked-in").filter({ visible: true });
  await ionButton(bar, "Check out").click();
  await expect(bar).toHaveCount(0);
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

test("E2E-14 check-in button is disabled until a range is selected", async ({
  browser,
}) => {
  const { context, page } = await newUser(browser, "Ana");
  await openCourt(page, COURTS.alpha.name);
  await ionButton(page.locator("ion-footer"), "Check in").click();
  await page.locator(".range-picker").waitFor({ state: "visible" });
  const checkInBtn = page
    .locator("ion-modal")
    .filter({ visible: true })
    .last()
    .locator("ion-button")
    .filter({ hasText: "Check in" });
  await expect(checkInBtn).toHaveClass(/button-disabled/);
  await page.locator(".range-picker__row").filter({ hasText: "Busy" }).click();
  await expect(checkInBtn).not.toHaveClass(/button-disabled/);
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
  const alertEl = page.locator("ion-alert").filter({ hasText: "Quick question" }).filter({ visible: true });
  await alertEl.locator("button").filter({ hasText: "Privacy" }).click();
  await expect(
    visibleText(page, "Thanks for sharing your feedback."),
  ).toBeVisible();

  await backToCourts(page);
  const bar = page.locator(".courts-page__checked-in").filter({ visible: true });
  await ionButton(bar, "Check out").click();
  await expect(bar).toHaveCount(0);
  await openCourt(page, COURTS.alpha.name);
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
    "2–4 players",
  );
  await expect(page.locator(".court-pin--active")).toHaveCount(1);
  await context.close();
});

test("E2E-17 update count changes the reported range", async ({ browser }) => {
  const { context, page } = await newUser(browser, "Ana");
  await openCourt(page, COURTS.alpha.name);
  await checkIn(page, 2);
  await closeConfirmation(page);
  await dismissFeedbackIfShown(page);
  await expect(liveCard(page)).toContainText("2–4 players");

  await ionButton(page.locator("ion-footer"), "Update count").click();
  await page.locator(".range-picker").waitFor({ state: "visible" });
  await page
    .locator(".range-picker__row")
    .filter({ hasText: "Busy" })
    .click();
  await ionButton(
    page.locator("ion-modal").filter({ visible: true }).last(),
    "Update",
  ).click();
  await expect(visibleText(page, "Count updated.")).toBeVisible();
  await expect(liveCard(page)).toContainText("5–8 players");
  await context.close();
});

test("E2E-18 move confirmation appears when checking in at a different court", async ({
  browser,
}) => {
  const { context, page } = await newUser(browser, "Ana");
  await openCourt(page, COURTS.alpha.name);
  await checkIn(page, 2);
  await closeConfirmation(page);
  await dismissFeedbackIfShown(page);
  await backToCourts(page);
  await openCourt(page, COURTS.beta.name);

  await ionButton(page.locator("ion-footer"), "Check in").click();
  const moveAlert = page
    .locator("ion-alert")
    .filter({ hasText: "Move your check-in?" });
  await expect(moveAlert).toBeVisible();

  await moveAlert.locator("button").filter({ hasText: "Cancel" }).click();
  await expect(moveAlert).not.toBeVisible();
  await expect(liveCard(page)).toContainText("checked in at another court");
  await context.close();
});
