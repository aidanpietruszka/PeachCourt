import { expect, test } from "@playwright/test";
import { getUidByEmail, newUser, resetData, seedChat, seedMessage } from "./support";

test.beforeEach(async () => {
  await resetData();
});

const TAB_GREEN = "rgb(13, 150, 119)";
const TAB_GRAY = "rgb(138, 138, 142)";

test("E2E-205 every tab renders its inline Figma icon", async ({ browser }) => {
  const { context, page } = await newUser(browser, "Sam");
  for (const tab of ["profile", "courts", "activity"]) {
    await expect(page.locator(`ion-tab-button[tab="${tab}"] svg`)).toHaveCount(1);
  }
  await expect(page.locator('ion-tab-button[tab="chats"] svg')).toHaveCount(1);
  await context.close();
});

test("E2E-206 the active tab icon is green and inactive tabs are gray", async ({
  browser,
}) => {
  const { context, page } = await newUser(browser, "Sam");
  await page.goto("/courts");
  await expect(page.locator('ion-tab-button[tab="courts"].tab-selected')).toHaveCount(1);
  const courtsColor = await page
    .locator('ion-tab-button[tab="courts"] svg')
    .evaluate((el) => getComputedStyle(el).color);
  const profileColor = await page
    .locator('ion-tab-button[tab="profile"] svg')
    .evaluate((el) => getComputedStyle(el).color);
  expect(courtsColor).toBe(TAB_GREEN);
  expect(profileColor).toBe(TAB_GRAY);
  await context.close();
});

test("E2E-207 the Chats tab still shows its unread badge", async ({ browser }) => {
  const { context, page, email } = await newUser(browser, "Sam");
  const uid = await getUidByEmail(email);
  await seedChat("match-tab-1", {
    playerUids: [uid, "other-uid"],
    playerNames: ["Sam", "Other"],
    lastMessage: "ping",
    lastSenderName: "Other",
    lastSenderUid: "other-uid",
    lastMessageAt: { timestampValue: new Date().toISOString() },
  });
  await seedMessage("match-tab-1", "msg-1", "other-uid", "Other", "ping");
  await page.goto("/chats");
  await expect(page.locator('ion-tab-button[tab="chats"] svg')).toHaveCount(1);
  await expect(page.locator(".tab-badge")).toBeVisible();
  await context.close();
});
