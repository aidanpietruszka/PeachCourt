import { expect, test } from "@playwright/test";
import { getUidByEmail, newUser, resetData, seedChat, visibleText } from "./support";

test.beforeEach(async () => {
  await resetData();
});

test("E2E-263 game chat input stays in the viewport and is usable after focus", async ({
  browser,
}) => {
  const { context, page, email } = await newUser(browser, "Sam");
  const uid = await getUidByEmail(email);
  await seedChat("kb-1", {
    hostUid: uid,
    playerUids: [uid, "other"],
    playerNames: ["Sam", "Other"],
    memberUids: [uid, "other"],
  });
  await page.goto("/chats/kb-1");

  const input = page.locator(".game-chat__input");
  await expect(input).toBeVisible();
  await input.click();
  await expect(input).toBeInViewport();

  const container = page.locator(".game-chat");
  await page.evaluate((h) => {
    const vv = window.visualViewport;
    if (!vv) return;
    Object.defineProperty(vv, "height", { value: h, configurable: true });
    vv.dispatchEvent(new Event("resize"));
  }, 320);
  await expect
    .poll(() => container.evaluate((el) => (el as HTMLElement).style.height))
    .toBe("320px");

  await input.fill("Above the keyboard");
  await page.locator(".game-chat__send-btn").click();
  await expect(visibleText(page, "Above the keyboard")).toBeVisible();
  await expect(input).toBeInViewport();

  await context.close();
});
