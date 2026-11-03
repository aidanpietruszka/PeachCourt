import { expect, test } from "@playwright/test";
import {
  alertButton,
  backToCourts,
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

test("E2E-17 post, join and leave a game", async ({ browser }) => {
  const a = await newUser(browser, "Ana");
  const b = await newUser(browser, "Ben");
  await openCourt(a.page, COURTS.alpha.name);
  await openCourt(b.page, COURTS.alpha.name);

  await postGame(a.page, { skill: "3.5" });
  const hostCard = gameCard(a.page, "Ana");
  await expect(hostCard).toContainText("Doubles · Tennis");
  await expect(hostCard).toContainText("Skill 3.5");
  await expect(hostCard).toContainText("1 of 4 · Host Ana");
  await expect(hostCard).toContainText("Your game");

  const guestCard = gameCard(b.page, "Ana");
  await joinGame(b.page, guestCard);
  await expect(visibleText(b.page, /You joined Doubles at/)).toBeVisible();
  await expect(guestCard).toContainText("You're in");
  await expect(hostCard).toContainText("2 of 4 · Host Ana");
  await expect(hostCard).toContainText("Joined: Ben");

  await guestCard.click();
  const detailModal = b.page.locator('ion-modal[aria-label="Game detail"]');
  await expect(detailModal).toBeVisible();
  await ionButton(detailModal, "Leave game").click();
  await alertButton(b.page, "Leave game").click();
  await expect(detailModal).not.toBeVisible();
  await expect(visibleText(b.page, "You left Ana's game.")).toBeVisible();
  await expect(hostCard).toContainText("1 of 4 · Host Ana");
  await expect(hostCard).not.toContainText("Joined:");

  await a.context.close();
  await b.context.close();
});

test("E2E-18 join sheet cancel does not join the game", async ({ browser }) => {
  const a = await newUser(browser, "Ana");
  const b = await newUser(browser, "Ben");
  await openCourt(a.page, COURTS.alpha.name);
  await postGame(a.page, { skill: "Any level" });
  await openCourt(b.page, COURTS.alpha.name);
  const card = gameCard(b.page, "Ana");
  await ionButton(card, "Join").click();
  const joinSheet = b.page.locator("ion-modal").filter({ visible: true }).last();
  await expect(joinSheet).toContainText("Ana");
  await ionButton(joinSheet, "Cancel").click();
  await expect(joinSheet).not.toBeVisible();
  await expect(card).toContainText("1 of 4 · Host Ana");
  await expect(card).not.toContainText("You're in");
  await a.context.close();
  await b.context.close();
});

test("E2E-19 open games show on the courts list", async ({ browser }) => {
  const { context, page } = await newUser(browser, "Ana");
  await openCourt(page, COURTS.alpha.name);
  await postGame(page, { skill: "4.0" });
  await backToCourts(page);
  const row = page
    .locator(".courts-page__list ion-item")
    .filter({ hasText: COURTS.alpha.name });
  await expect(row).toContainText("No reports");
  await expect(row).toContainText("1 open game");
  await context.close();
});

test("E2E-20 pickleball courts use the pickleball scale", async ({
  browser,
}) => {
  const { context, page } = await newUser(browser, "Ana");
  await page
    .locator("ion-segment-button")
    .filter({ hasText: "Pickleball" })
    .click();
  await openCourt(page, COURTS.gamma.name);
  await ionButton(page.locator("ion-footer"), "Post a game").click();
  const modal = page.locator("ion-modal").filter({ visible: true }).last();
  await expect(
    modal.locator("ion-segment-button").filter({ hasText: "Tennis" }),
  ).toHaveCount(0);
  await modal.locator("ion-select").nth(1).click();
  const popover = page.locator("ion-popover");
  await expect(popover.getByText("5.0+", { exact: true })).toBeVisible();
  await expect(popover.getByText("6.5", { exact: true })).toHaveCount(0);
  await expect(popover.getByText("1.5", { exact: true })).toHaveCount(0);
  await context.close();
});

test("E2E-21 courts with both sports ask which sport", async ({ browser }) => {
  const { context, page } = await newUser(browser, "Ana");
  await openCourt(page, COURTS.beta.name);
  await postGame(page, { sport: "Pickleball", skill: "5.0+" });
  await expect(gameCard(page, "Ana")).toContainText("Doubles · Pickleball");
  await expect(gameCard(page, "Ana")).toContainText("Skill 5.0+");
  await context.close();
});

test("E2E-22 a start time is required", async ({ browser }) => {
  const { context, page } = await newUser(browser, "Ana");
  await openCourt(page, COURTS.alpha.name);
  await ionButton(page.locator("ion-footer"), "Post a game").click();
  const modal = page.locator("ion-modal").filter({ visible: true }).last();
  await ionButton(modal, "Post game").click();
  await expect(visibleText(page, "Choose a start time.")).toBeVisible();
  await context.close();
});

test("E2E-30 a court with pickleball lines asks which sport", async ({
  browser,
}) => {
  const { context, page } = await newUser(browser, "Ana");
  await openCourt(page, COURTS.delta.name);
  await ionButton(page.locator("ion-footer"), "Post a game").click();
  const modal = page.locator("ion-modal").filter({ visible: true }).last();
  await expect(
    modal.locator("ion-segment-button").filter({ hasText: "Tennis" }),
  ).toHaveCount(1);
  await expect(
    modal.locator("ion-segment-button").filter({ hasText: "Pickleball" }),
  ).toHaveCount(1);
  await context.close();
});

test("E2E-31 a tennis-only court does not ask which sport", async ({
  browser,
}) => {
  const { context, page } = await newUser(browser, "Ana");
  await openCourt(page, COURTS.alpha.name);
  await ionButton(page.locator("ion-footer"), "Post a game").click();
  const modal = page.locator("ion-modal").filter({ visible: true }).last();
  await expect(
    modal.locator("ion-segment-button").filter({ hasText: "Pickleball" }),
  ).toHaveCount(0);
  await expect(
    modal.locator("ion-segment-button").filter({ hasText: "Tennis" }),
  ).toHaveCount(0);
  await context.close();
});
