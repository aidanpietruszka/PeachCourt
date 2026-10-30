import { expect, test } from "@playwright/test";
import {
  alertButton,
  alertInput,
  backToCourts,
  COURTS,
  gameCard,
  ionButton,
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
  await expect(hostCard).toContainText("Tennis · 3.5");
  await expect(hostCard).toContainText("3 spots left");
  await expect(hostCard).toContainText("Your game");

  const guestCard = gameCard(b.page, "Ana");
  await ionButton(guestCard, "Join").click();
  await expect(alertInput(b.page)).toHaveValue("");
  await alertInput(b.page).fill("Ben");
  await alertButton(b.page, "Join").click();
  await expect(guestCard).toContainText("You're in");
  await expect(hostCard).toContainText("2 spots left");
  await expect(hostCard).toContainText("Joined: Ben");

  await ionButton(guestCard, "Leave").click();
  await expect(visibleText(b.page, "You left Ana's game.")).toBeVisible();
  await expect(hostCard).toContainText("3 spots left");
  await expect(hostCard).toContainText("No one has joined yet.");

  await a.context.close();
  await b.context.close();
});

test("E2E-18 joining needs a name", async ({ browser }) => {
  const a = await newUser(browser, "Ana");
  const b = await newUser(browser, "Ben");
  await openCourt(a.page, COURTS.alpha.name);
  await postGame(a.page, { skill: "Any level" });
  await openCourt(b.page, COURTS.alpha.name);
  await ionButton(gameCard(b.page, "Ana"), "Join").click();
  await alertButton(b.page, "Join").click();
  await expect(
    visibleText(b.page, "Enter your first name to join."),
  ).toBeVisible();
  await expect(gameCard(b.page, "Ana")).toContainText("3 spots left");
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
  await expect(row).toContainText("No reports · 1 open game");
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
  await expect(gameCard(page, "Ana")).toContainText("Pickleball · 5.0+");
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
