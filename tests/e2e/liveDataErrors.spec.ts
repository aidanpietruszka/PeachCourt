import { test, expect } from "@playwright/test";
import {
  blockLiveData,
  clientErrors,
  getUidByEmail,
  newUser,
  pullToRefresh,
  resetData,
  restoreFirestoreRules,
  seedAlert,
  seedChat,
  seedMessage,
} from "./support";

const GENERIC_ERROR = "Couldn't load. Pull down to try again.";
const COURTS_LIST_ERROR = "Courts couldn't load. Pull down to try again.";
const COURTS_COUNTS_ERROR = "Live counts couldn't load. Pull down to try again.";
const COURT_DETAIL_ERROR =
  "Live count and games couldn't load. Pull down to try again.";
const OLD_COURTS_TOAST = "Courts are unavailable right now.";
const OLD_GAMES_TOAST = "Open games are unavailable right now.";

async function listenerCodes(): Promise<string[]> {
  return (await clientErrors())
    .filter((e) => e.type === "listener_failed")
    .map((e) => String(e.code));
}

test.beforeEach(async () => {
  await restoreFirestoreRules();
  await resetData();
});

test.afterEach(async () => {
  await restoreFirestoreRules();
});

test("E2E-255 inbox banner on alert listener failure, logs once per session, recovers", async ({
  browser,
}) => {
  const { context, page, email } = await newUser(browser, "Inbox");
  const uid = await getUidByEmail(email);
  await seedAlert(uid);

  await blockLiveData(["alerts"]);
  await page.goto("/notifications");

  await expect(page.getByText(GENERIC_ERROR)).toBeVisible();
  await expect(page.locator(".inbox__row-title")).toHaveCount(0);
  await expect
    .poll(async () => (await listenerCodes()).filter((c) => c === "alerts").length)
    .toBe(1);

  await pullToRefresh(page);
  await expect(page.getByText(GENERIC_ERROR)).toBeVisible();
  expect((await listenerCodes()).filter((c) => c === "alerts").length).toBe(1);

  await restoreFirestoreRules();
  await pullToRefresh(page);
  await expect(page.getByText(GENERIC_ERROR)).toHaveCount(0);
  await expect(page.locator(".inbox__row-title")).toHaveCount(1);

  await context.close();
});

test("E2E-256 chats tab banner on chat list listener failure and recovers", async ({
  browser,
}) => {
  const { context, page, email } = await newUser(browser, "Chatty");
  const uid = await getUidByEmail(email);
  await seedChat("chat-1", { hostUid: uid, playerUids: [uid, "bob"], memberUids: [uid, "bob"] });

  await blockLiveData(["chats"]);
  await page.goto("/chats");

  await expect(page.getByText(GENERIC_ERROR)).toBeVisible();
  await expect(page.locator(".chats-empty")).toHaveCount(0);
  await expect.poll(async () => (await listenerCodes()).includes("chats")).toBe(true);

  await restoreFirestoreRules();
  await pullToRefresh(page);
  await expect(page.getByText(GENERIC_ERROR)).toHaveCount(0);
  await expect(page.locator(".chat-row")).toHaveCount(1);

  await context.close();
});

test("E2E-257 game chat banner on chat and messages listener failure and recovers", async ({
  browser,
}) => {
  const { context, page, email } = await newUser(browser, "Talker");
  const uid = await getUidByEmail(email);
  await seedChat("game-1", {
    hostUid: uid,
    playerUids: [uid, "bob"],
    memberUids: [uid, "bob"],
  });
  await seedMessage("game-1", "msg-1", "alice", "Alice", "Hi there");

  await blockLiveData(["chats", "messages"]);
  await page.goto("/chats/game-1");

  await expect(page.getByText(GENERIC_ERROR)).toBeVisible();
  await expect
    .poll(async () => {
      const codes = await listenerCodes();
      return codes.includes("game-chat") && codes.includes("chat-messages");
    })
    .toBe(true);

  await restoreFirestoreRules();
  await pullToRefresh(page);
  await expect(page.getByText(GENERIC_ERROR)).toHaveCount(0);
  await expect(page.getByText("Hi there")).toBeVisible();

  await context.close();
});

test("E2E-258 my activity banner on games and check-ins listener failure and recovers", async ({
  browser,
}) => {
  const { context, page } = await newUser(browser, "Active");

  await blockLiveData(["matches", "checkins"]);
  await page.goto("/activity");

  await expect(page.getByText(GENERIC_ERROR)).toBeVisible();
  await expect
    .poll(async () => {
      const codes = await listenerCodes();
      return (
        codes.includes("my-activity-games") &&
        codes.includes("my-checkins") &&
        codes.includes("my-activity-active-checkin")
      );
    })
    .toBe(true);

  await restoreFirestoreRules();
  await pullToRefresh(page);
  await expect(page.getByText(GENERIC_ERROR)).toHaveCount(0);

  await context.close();
});

test("E2E-259 courts shows counts banner with em-dash counts, keeps list, no old toast", async ({
  browser,
}) => {
  const { context, page } = await newUser(browser, "Browser");

  await blockLiveData(["checkins", "courtStatus", "matches"]);
  await page.goto("/courts");

  await expect(page.getByText(COURTS_COUNTS_ERROR)).toBeVisible();
  await expect(page.getByText(COURTS_LIST_ERROR)).toHaveCount(0);
  await expect(page.locator(".courts-page__activity").first()).toHaveText("—");
  await expect(page.locator(".courts-page__games").first()).toHaveText("—");
  await expect(page.getByText(OLD_COURTS_TOAST)).toHaveCount(0);
  await expect(page.getByText(OLD_GAMES_TOAST)).toHaveCount(0);
  await expect
    .poll(async () => {
      const codes = await listenerCodes();
      return (
        codes.includes("live-court-data") &&
        codes.includes("courts-active-checkin")
      );
    })
    .toBe(true);

  await restoreFirestoreRules();
  await pullToRefresh(page);
  await expect(page.getByText(COURTS_COUNTS_ERROR)).toHaveCount(0);

  await context.close();
});

test("E2E-260 courts shows a list banner instead of an empty list when courts fail", async ({
  browser,
}) => {
  const { context, page } = await newUser(browser, "Browser");

  await blockLiveData(["courts"]);
  await page.goto("/courts");

  await expect(page.getByText(COURTS_LIST_ERROR)).toBeVisible();
  await expect(page.getByText(OLD_COURTS_TOAST)).toHaveCount(0);
  await expect.poll(async () => (await listenerCodes()).includes("courts-list")).toBe(true);

  await restoreFirestoreRules();
  await pullToRefresh(page);
  await expect(page.getByText(COURTS_LIST_ERROR)).toHaveCount(0);

  await context.close();
});

test("E2E-261 court detail banner and em dash but keeps details and check-in", async ({
  browser,
}) => {
  const { context, page } = await newUser(browser, "Detail");

  await blockLiveData(["checkins", "courtStatus", "matches"]);
  await page.goto("/courts/court-alpha");

  await expect(page.getByText(COURT_DETAIL_ERROR)).toBeVisible();
  await expect(page.locator(".live-card__count")).toHaveText("—");
  await expect(page.getByRole("heading", { name: "Alpha Tennis Center" })).toBeVisible();
  await expect(page.getByText(OLD_GAMES_TOAST)).toHaveCount(0);
  await expect
    .poll(async () => {
      const codes = await listenerCodes();
      return (
        codes.includes("live-court-data") &&
        codes.includes("court-detail-games") &&
        codes.includes("court-detail-active-checkin") &&
        codes.includes("my-games")
      );
    })
    .toBe(true);

  await restoreFirestoreRules();
  await pullToRefresh(page);
  await expect(page.getByText(COURT_DETAIL_ERROR)).toHaveCount(0);

  await context.close();
});

test("E2E-262 court detail logs a listener error when the court document fails", async ({
  browser,
}) => {
  const { context, page } = await newUser(browser, "Missing");

  await blockLiveData(["courts"]);
  await page.goto("/courts/court-alpha");

  await expect
    .poll(async () => (await listenerCodes()).includes("court-detail-court"))
    .toBe(true);

  await context.close();
});
