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
  visibleText,
  waitForCollection,
} from "./support";

test.beforeEach(async () => {
  await resetData();
});

async function openOwnChat(page: Page) {
  await expect(async () => {
    await page.goto("/chats");
    await expect(page.locator(".chat-row").first()).toBeVisible({
      timeout: 4_000,
    });
  }).toPass({ timeout: 40_000 });
  await page.locator(".chat-row").first().click();
  await expect(page.locator(".game-chat__title")).toBeVisible();
}

test("E2E-236 the host and a joining player share the game chat the function created", async ({
  browser,
}) => {
  const [host, player] = await Promise.all([
    newUser(browser, "Ana"),
    newUser(browser, "Ben"),
  ]);

  await openCourt(host.page, COURTS.alpha.name);
  await postGame(host.page, { skill: "Any level" });

  await openOwnChat(host.page);
  await host.page.locator(".game-chat__input").fill("Host here");
  await host.page.locator(".game-chat__send-btn").click();
  await expect(visibleText(host.page, "Host here")).toBeVisible();

  await openCourt(player.page, COURTS.alpha.name);
  const card = gameCard(player.page, "Ana");
  await expect(card).toBeVisible();
  await joinGame(player.page, card);

  const playerUid = await getUidByEmail(player.email);
  await expect
    .poll(
      async () => {
        const chats = await waitForCollection("chats");
        return chats.some(
          (c) => Array.isArray(c.memberUids) && c.memberUids.includes(playerUid),
        );
      },
      { timeout: 30_000 },
    )
    .toBe(true);

  await openOwnChat(player.page);
  await expect(visibleText(player.page, "Host here")).toBeVisible();
  await player.page.locator(".game-chat__input").fill("Joining in");
  await player.page.locator(".game-chat__send-btn").click();
  await expect(visibleText(player.page, "Joining in")).toBeVisible();

  await host.page.reload();
  await expect(visibleText(host.page, "Joining in")).toBeVisible();

  await host.context.close();
  await player.context.close();
});
