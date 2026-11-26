import { expect, test, type Page } from "@playwright/test";
import {
  COURTS,
  gameCard,
  getUidByEmail,
  joinGame,
  newUser,
  openCourt,
  postGame,
  resetData,
  seedUserProfile,
  waitForCollection,
  waitForDocument,
} from "./support";

test.beforeEach(async () => {
  await resetData();
});

async function openOwnChat(page: Page): Promise<string> {
  await expect(async () => {
    await page.goto("/chats");
    await expect(page.locator(".chat-row").first()).toBeVisible({
      timeout: 4_000,
    });
  }).toPass({ timeout: 40_000 });
  await page.locator(".chat-row").first().click();
  await expect(page.locator(".game-chat__title")).toBeVisible();
  return page.url().split("/chats/")[1].split(/[?#]/)[0];
}

async function sendMessage(page: Page, text: string) {
  await page.locator(".game-chat__input").fill(text);
  await page.locator(".game-chat__send-btn").click();
  await expect(page.getByText(text, { exact: true })).toBeVisible();
}

async function messageAlertsFor(uid: string): Promise<number> {
  const alerts = await waitForCollection("alerts");
  return alerts.filter(
    (a) => a.recipientUid === uid && a.type === "new_message",
  ).length;
}

test("E2E-251 chat messages alert off stops the message alert, on delivers it", async ({
  browser,
}) => {
  const [host, player] = await Promise.all([
    newUser(browser, "Ana"),
    newUser(browser, "Ben"),
  ]);
  const playerUid = await getUidByEmail(player.email);

  await openCourt(host.page, COURTS.alpha.name);
  await postGame(host.page, { skill: "Any level" });
  const matchId = await openOwnChat(host.page);

  await openCourt(player.page, COURTS.alpha.name);
  const card = gameCard(player.page, "Ana");
  await expect(card).toBeVisible();
  await joinGame(player.page, card);
  await expect
    .poll(
      async () => {
        const chats = await waitForCollection("chats");
        return chats.some(
          (c) =>
            Array.isArray(c.memberUids) && c.memberUids.includes(playerUid),
        );
      },
      { timeout: 30_000 },
    )
    .toBe(true);

  await seedUserProfile(playerUid, { chatMessagesAlert: false });
  await sendMessage(host.page, "setting off");
  await expect
    .poll(
      async () => (await waitForDocument(`chats/${matchId}`)).lastMessage,
      { timeout: 15_000 },
    )
    .toBe("setting off");
  expect(await messageAlertsFor(playerUid)).toBe(0);

  await seedUserProfile(playerUid, { chatMessagesAlert: true });
  await sendMessage(host.page, "setting on");
  await expect
    .poll(
      async () => (await waitForDocument(`chats/${matchId}`)).lastMessage,
      { timeout: 15_000 },
    )
    .toBe("setting on");
  await expect.poll(() => messageAlertsFor(playerUid), { timeout: 15_000 }).toBe(1);

  await player.page.goto("/notifications");
  await expect(player.page.getByText(/sent a message/)).toHaveCount(1);

  await host.context.close();
  await player.context.close();
});
