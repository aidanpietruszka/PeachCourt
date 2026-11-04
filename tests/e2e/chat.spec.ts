import { expect, test } from "@playwright/test";
import {
  getUidByEmail,
  newUser,
  resetData,
  seedChat,
  seedMessage,
  visibleText,
} from "./support";

test.beforeEach(async () => {
  await resetData();
});

test("E2E-193 Chats tab shows seeded chat and navigates to GameChatPage", async ({
  browser,
}) => {
  const { context, page, email } = await newUser(browser, "Sam");
  const uid = await getUidByEmail(email);
  await seedChat("match-123", { playerUids: [uid, "other-uid"], playerNames: ["Sam", "Other"] });
  await page.goto("/chats");
  await expect(visibleText(page, "Doubles")).toBeVisible();
  await page.locator(".chat-row").first().click();
  await expect(page.locator(".game-chat__title")).toBeVisible();
  await context.close();
});

test("E2E-194 sending a message appears in the chat", async ({ browser }) => {
  const { context, page, email } = await newUser(browser, "Sam");
  const uid = await getUidByEmail(email);
  await seedChat("match-456", { playerUids: [uid, "other-uid"], playerNames: ["Sam", "Other"] });
  await page.goto("/chats/match-456");
  await expect(page.locator(".game-chat__send-btn")).toBeVisible();
  await page.locator(".game-chat__input").fill("Hello there");
  await page.locator(".game-chat__send-btn").click();
  await expect(visibleText(page, "Hello there")).toBeVisible();
  await context.close();
});

test("E2E-195 seeded messages appear on load", async ({ browser }) => {
  const { context, page, email } = await newUser(browser, "Sam");
  const uid = await getUidByEmail(email);
  await seedChat("match-789", { playerUids: [uid, "other-uid"], playerNames: ["Sam", "Other"] });
  await seedMessage("match-789", "msg-1", "other-uid", "Other", "Hey Sam!");
  await page.goto("/chats/match-789");
  await expect(visibleText(page, "Hey Sam!")).toBeVisible();
  await context.close();
});

test("E2E-196 Chats tab shows unread badge and clears after open", async ({
  browser,
}) => {
  const { context, page, email } = await newUser(browser, "Sam");
  const uid = await getUidByEmail(email);
  const future = new Date(Date.now() + 90 * 60_000).toISOString();
  const msgTs = new Date().toISOString();
  await seedChat("match-999", {
    playerUids: [uid, "other-uid"],
    playerNames: ["Sam", "Other"],
    lastMessage: "ping",
    lastSenderName: "Other",
    lastSenderUid: "other-uid",
    lastMessageAt: { timestampValue: msgTs },
    startAt: { timestampValue: future },
  });
  await seedMessage("match-999", "msg-1", "other-uid", "Other", "ping");
  await page.goto("/chats");
  await expect(page.locator(".tab-badge")).toBeVisible();
  await page.locator(".chat-row").first().click();
  await expect(page.locator(".game-chat__title")).toBeVisible();
  await expect(visibleText(page, "ping")).toBeVisible();
  await page.locator(".game-chat__back").click();
  await expect(page.locator(".chats-page__title")).toBeVisible();
  await expect(page.locator(".tab-badge")).not.toBeVisible();
  await context.close();
});
