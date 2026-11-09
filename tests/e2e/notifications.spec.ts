import { expect, test } from "@playwright/test";
import {
  COURTS,
  gameCard,
  getUidByEmail,
  joinGame,
  loggedEvents,
  newUser,
  openCourt,
  postGame,
  resetData,
  seedAlert,
  seedChat,
  visibleText,
} from "./support";

async function joinWithSource(
  browser: Parameters<typeof newUser>[0],
  src: string,
) {
  const a = await newUser(browser, "Ana");
  const b = await newUser(browser, "Ben");
  await openCourt(a.page, COURTS.alpha.name);
  await postGame(a.page, { skill: "Any level" });
  const path = `/courts/${COURTS.alpha.id}${src ? `?src=${src}` : ""}`;
  await b.page.goto(path);
  const card = gameCard(b.page, "Ana");
  await expect(card).toBeVisible();
  await joinGame(b.page, card);
  await expect(visibleText(b.page, /You joined Doubles at/)).toBeVisible();
  const joins = await loggedEvents("match_joined");
  return { a, b, joins };
}

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

test("E2E-209 empty notification inbox shows guidance subtext", async ({ browser }) => {
  const { context, page } = await newUser(browser, "Ana");
  await page.goto("/notifications");
  await expect(page.locator(".inbox__empty-title")).toHaveText("No notifications yet");
  await expect(page.locator(".inbox__empty-sub")).toContainText(
    "New games, changes to your games and reminders show up here.",
  );
  await context.close();
});

test("E2E-193 a join from the inbox is logged with joinSource inbox", async ({ browser }) => {
  const { a, b, joins } = await joinWithSource(browser, "inbox");
  expect(joins).toHaveLength(1);
  expect(joins[0].joinSource).toBe("inbox");
  await a.context.close();
  await b.context.close();
});

test("E2E-194 a join from the banner is logged with joinSource banner", async ({ browser }) => {
  const { a, b, joins } = await joinWithSource(browser, "banner");
  expect(joins).toHaveLength(1);
  expect(joins[0].joinSource).toBe("banner");
  await a.context.close();
  await b.context.close();
});

test("E2E-195 a push open logs notification_opened and the join carries joinSource push", async ({ browser }) => {
  const { a, b, joins } = await joinWithSource(browser, "push");
  expect(joins).toHaveLength(1);
  expect(joins[0].joinSource).toBe("push");
  const opens = await loggedEvents("notification_opened");
  expect(opens.length).toBeGreaterThanOrEqual(1);
  expect(opens[0].courtId).toBe(COURTS.alpha.id);
  await a.context.close();
  await b.context.close();
});

test("E2E-196 a plain browse join is logged with joinSource browsing", async ({ browser }) => {
  const { a, b, joins } = await joinWithSource(browser, "");
  expect(joins).toHaveLength(1);
  expect(joins[0].joinSource).toBe("browsing");
  await a.context.close();
  await b.context.close();
});

test("E2E-210 a chat push open logs notification_opened once, even after a reload", async ({ browser }) => {
  const { context, page, email } = await newUser(browser, "Ana");
  const uid = await getUidByEmail(email);
  await seedChat("chat-1", { playerUids: [uid], playerNames: ["Ana"] });
  await page.goto("/chats/chat-1?src=push");
  await expect(page.locator(".game-chat__title")).toBeVisible();
  await expect.poll(() => loggedEvents("notification_opened")).toHaveLength(1);
  await page.reload();
  await expect(page.locator(".game-chat__title")).toBeVisible();
  await page.waitForTimeout(1_000);
  const opens = await loggedEvents("notification_opened");
  expect(opens).toHaveLength(1);
  expect(opens[0].courtId).toBe(COURTS.alpha.id);
  await context.close();
});

test("E2E-211 a court push open logs notification_opened once, even after a reload", async ({ browser }) => {
  const { context, page } = await newUser(browser, "Ana");
  await page.goto(`/courts/${COURTS.alpha.id}?src=push`);
  await expect.poll(() => loggedEvents("notification_opened")).toHaveLength(1);
  await page.reload();
  await page.waitForTimeout(1_000);
  const opens = await loggedEvents("notification_opened");
  expect(opens).toHaveLength(1);
  expect(opens[0].courtId).toBe(COURTS.alpha.id);
  await context.close();
});

test("E2E-212 a non-push chat visit logs nothing", async ({ browser }) => {
  const { context, page, email } = await newUser(browser, "Ana");
  const uid = await getUidByEmail(email);
  await seedChat("chat-1", { playerUids: [uid], playerNames: ["Ana"] });
  await page.goto("/chats/chat-1");
  await expect(page.locator(".game-chat__title")).toBeVisible();
  await page.waitForTimeout(1_000);
  expect(await loggedEvents("notification_opened")).toHaveLength(0);
  await context.close();
});
