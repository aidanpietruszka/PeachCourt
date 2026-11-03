import { expect, test } from "@playwright/test";
import {
  alertButton,
  COURTS,
  gameCard,
  ionButton,
  joinGame,
  newUser,
  openCourt,
  postGame,
  resetData,
  visibleText,
} from "./support";

test.beforeEach(async () => {
  await resetData();
});

test("E2E-182 tapping a game card as host opens game detail", async ({
  browser,
}) => {
  const { context, page } = await newUser(browser, "Ana");
  await openCourt(page, COURTS.alpha.name);
  await postGame(page, { skill: "Any level" });
  const card = gameCard(page, "Ana");
  await card.click();
  const modal = page.locator('ion-modal[aria-label="Game detail"]');
  await expect(modal).toBeVisible();
  await expect(modal).toContainText("You're hosting");
  await expect(modal).toContainText("Ana (you)");
  await context.close();
});

test("E2E-183 tapping a game card as joined player opens game detail", async ({
  browser,
}) => {
  const a = await newUser(browser, "Ana");
  const b = await newUser(browser, "Ben");
  await openCourt(a.page, COURTS.alpha.name);
  await postGame(a.page, { skill: "Any level" });
  await openCourt(b.page, COURTS.alpha.name);
  await joinGame(b.page, gameCard(b.page, "Ana"));
  await expect(visibleText(b.page, /You joined/)).toBeVisible();
  await gameCard(b.page, "Ana").click();
  const modal = b.page.locator('ion-modal[aria-label="Game detail"]');
  await expect(modal).toBeVisible();
  await expect(modal).toContainText("You're in");
  await expect(modal).toContainText("Ben (you)");
  await a.context.close();
  await b.context.close();
});

test("E2E-184 non-host leaves via game detail", async ({ browser }) => {
  const a = await newUser(browser, "Ana");
  const b = await newUser(browser, "Ben");
  await openCourt(a.page, COURTS.alpha.name);
  await postGame(a.page, { skill: "Any level" });
  await openCourt(b.page, COURTS.alpha.name);
  await joinGame(b.page, gameCard(b.page, "Ana"));
  await expect(visibleText(b.page, /You joined/)).toBeVisible();
  const card = gameCard(b.page, "Ana");
  await card.click();
  const modal = b.page.locator('ion-modal[aria-label="Game detail"]');
  await expect(modal).toBeVisible();
  await ionButton(modal, "Leave game").click();
  await alertButton(b.page, "Leave game").click();
  await expect(modal).not.toBeVisible();
  await expect(visibleText(b.page, "You left Ana's game.")).toBeVisible();
  await expect(card).not.toContainText("You're in");
  await a.context.close();
  await b.context.close();
});

test("E2E-185 host leaves with others — game hands off to next player", async ({
  browser,
}) => {
  const a = await newUser(browser, "Ana");
  const b = await newUser(browser, "Ben");
  await openCourt(a.page, COURTS.alpha.name);
  await postGame(a.page, { skill: "Any level" });
  await openCourt(b.page, COURTS.alpha.name);
  await joinGame(b.page, gameCard(b.page, "Ana"));
  await expect(visibleText(b.page, /You joined/)).toBeVisible();
  const hostCard = gameCard(a.page, "Ana");
  await hostCard.click();
  const modal = a.page.locator('ion-modal[aria-label="Game detail"]');
  await expect(modal).toBeVisible();
  await ionButton(modal, "Leave game").click();
  await alertButton(a.page, "Leave and hand off").click();
  await expect(modal).not.toBeVisible();
  await expect(visibleText(a.page, "You left the game.")).toBeVisible();
  await expect(gameCard(b.page, "Ben")).toContainText("Your game");
  await a.context.close();
  await b.context.close();
});

test("E2E-186 host leaves alone — game is deleted", async ({ browser }) => {
  const { context, page } = await newUser(browser, "Ana");
  await openCourt(page, COURTS.alpha.name);
  await postGame(page, { skill: "Any level" });
  const card = gameCard(page, "Ana");
  await card.click();
  const modal = page.locator('ion-modal[aria-label="Game detail"]');
  await expect(modal).toBeVisible();
  await ionButton(modal, "Leave game").click();
  await alertButton(page, "Cancel game").click();
  await expect(modal).not.toBeVisible();
  await expect(card).not.toBeVisible();
  await context.close();
});

test("E2E-187 host deletes game — game disappears for all players", async ({
  browser,
}) => {
  const a = await newUser(browser, "Ana");
  const b = await newUser(browser, "Ben");
  await openCourt(a.page, COURTS.alpha.name);
  await postGame(a.page, { skill: "Any level" });
  await openCourt(b.page, COURTS.alpha.name);
  await joinGame(b.page, gameCard(b.page, "Ana"));
  await expect(visibleText(b.page, /You joined/)).toBeVisible();
  const hostCard = gameCard(a.page, "Ana");
  await hostCard.click();
  const modal = a.page.locator('ion-modal[aria-label="Game detail"]');
  await expect(modal).toBeVisible();
  await ionButton(modal, "Delete game").click();
  await alertButton(a.page, "Delete game").click();
  await expect(modal).not.toBeVisible();
  await expect(hostCard).not.toBeVisible();
  await expect(gameCard(b.page, "Ana")).not.toBeVisible();
  await a.context.close();
  await b.context.close();
});

test("E2E-188 host removes a player — removed player cannot rejoin", async ({
  browser,
}) => {
  const a = await newUser(browser, "Ana");
  const b = await newUser(browser, "Ben");
  await openCourt(a.page, COURTS.alpha.name);
  await postGame(a.page, { skill: "Any level" });
  await openCourt(b.page, COURTS.alpha.name);
  await joinGame(b.page, gameCard(b.page, "Ana"));
  await expect(visibleText(b.page, /You joined/)).toBeVisible();
  const hostCard = gameCard(a.page, "Ana");
  await hostCard.click();
  const modal = a.page.locator('ion-modal[aria-label="Game detail"]');
  await expect(modal).toBeVisible();
  await modal.locator(".game-detail__remove-btn").first().click();
  await alertButton(a.page, "Remove Ben").click();
  await expect(modal).toContainText("1 of 4 spots filled");
  const benCard = gameCard(b.page, "Ana");
  await ionButton(benCard, "Join").click();
  const joinSheet = b.page.locator("ion-modal").filter({ visible: true }).last();
  await ionButton(joinSheet, "Join game").click();
  await expect(visibleText(b.page, /You were removed/)).toBeVisible();
  await a.context.close();
  await b.context.close();
});
