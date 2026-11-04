import { expect, test } from "@playwright/test";
import {
  COURTS,
  gameCard,
  ionButton,
  joinGame,
  newUser,
  openCourt,
  postGame,
  resetData,
} from "./support";

test.beforeEach(async () => {
  await resetData();
});

test("E2E-165 filter button opens the filter sheet", async ({ browser }) => {
  const { context, page } = await newUser(browser, "Ana");
  await openCourt(page, COURTS.alpha.name);
  await page.locator(".match-board__filter-btn").click();
  const sheet = page.locator("ion-modal").filter({ visible: true }).last();
  await expect(sheet).toContainText("Filter games");
  await context.close();
});

test("E2E-166 sport filter shows only matching games", async ({ browser }) => {
  const a = await newUser(browser, "Ana");
  const b = await newUser(browser, "Ben");
  await openCourt(a.page, COURTS.beta.name);
  await postGame(a.page, { sport: "Tennis", skill: "Any level" });
  await openCourt(b.page, COURTS.beta.name);
  await postGame(b.page, { sport: "Pickleball", skill: "Any level" });

  const { context, page } = await newUser(browser, "Cal");
  await openCourt(page, COURTS.beta.name);
  await page.locator(".match-board__filter-btn").click();
  const sheet = page.locator("ion-modal").filter({ visible: true }).last();
  await sheet.locator(".game-filter-sheet__seg-btn").filter({ hasText: "Tennis" }).click();
  await sheet.locator(".game-filter-sheet__show-btn").click();
  await expect(sheet).not.toBeVisible();
  await expect(gameCard(page, "Ana")).toBeVisible();
  await expect(page.locator(".match-card").filter({ hasText: "Pickleball" })).toHaveCount(0);
  await a.context.close();
  await b.context.close();
  await context.close();
});

test("E2E-167 active filter count appears on filter button", async ({
  browser,
}) => {
  const { context, page } = await newUser(browser, "Ana");
  await openCourt(page, COURTS.alpha.name);
  await page.locator(".match-board__filter-btn").click();
  const sheet = page.locator("ion-modal").filter({ visible: true }).last();
  await sheet.locator(".filter-chip").filter({ hasText: "Today" }).click();
  await sheet.locator(".game-filter-sheet__show-btn").click();
  await expect(
    page.locator(".match-board__filter-btn--active"),
  ).toContainText("1");
  await context.close();
});

test("E2E-168 filter chip removes filter when clicked", async ({ browser }) => {
  const { context, page } = await newUser(browser, "Ana");
  await openCourt(page, COURTS.alpha.name);
  await page.locator(".match-board__filter-btn").click();
  const sheet = page.locator("ion-modal").filter({ visible: true }).last();
  await sheet.locator(".filter-chip").filter({ hasText: "Today" }).click();
  await sheet.locator(".game-filter-sheet__show-btn").click();
  await expect(page.locator(".match-board__chip")).toContainText("Today");
  await page.locator(".match-board__chip").filter({ hasText: "Today" }).click();
  await expect(page.locator(".match-board__chip")).toHaveCount(0);
  await expect(
    page.locator(".match-board__filter-btn--active"),
  ).toHaveCount(0);
  await context.close();
});

test("E2E-169 reset button clears all filters", async ({ browser }) => {
  const { context, page } = await newUser(browser, "Ana");
  await openCourt(page, COURTS.alpha.name);
  await page.locator(".match-board__filter-btn").click();
  const sheet = page.locator("ion-modal").filter({ visible: true }).last();
  await sheet.locator(".filter-chip").filter({ hasText: "Today" }).click();
  await sheet.locator(".game-filter-sheet__seg-btn").filter({ hasText: "Singles" }).click();
  await sheet.locator(".game-filter-sheet__reset").click();
  await sheet.locator(".game-filter-sheet__show-btn").click();
  await expect(page.locator(".match-board__chip")).toHaveCount(0);
  await context.close();
});

test("E2E-170 join sheet opens when Join is tapped", async ({ browser }) => {
  const a = await newUser(browser, "Ana");
  const b = await newUser(browser, "Ben");
  await openCourt(a.page, COURTS.alpha.name);
  await postGame(a.page, { skill: "3.5" });
  await openCourt(b.page, COURTS.alpha.name);
  await ionButton(gameCard(b.page, "Ana"), "Join").click();
  const joinSheet = b.page.locator("ion-modal").filter({ visible: true }).last();
  await expect(joinSheet).toContainText("Doubles · Tennis");
  await expect(joinSheet).toContainText("Ana");
  await a.context.close();
  await b.context.close();
});

test("E2E-171 join sheet cancel closes without joining", async ({
  browser,
}) => {
  const a = await newUser(browser, "Ana");
  const b = await newUser(browser, "Ben");
  await openCourt(a.page, COURTS.alpha.name);
  await postGame(a.page, { skill: "Any level" });
  await openCourt(b.page, COURTS.alpha.name);
  const card = gameCard(b.page, "Ana");
  await ionButton(card, "Join").click();
  const joinSheet = b.page.locator("ion-modal").filter({ visible: true }).last();
  await ionButton(joinSheet, "Cancel").click();
  await expect(joinSheet).not.toBeVisible();
  await expect(card).not.toContainText("You're in");
  await a.context.close();
  await b.context.close();
});

test("E2E-172 join sheet shows game roster and host info", async ({
  browser,
}) => {
  const a = await newUser(browser, "Ana");
  const b = await newUser(browser, "Ben");
  const c = await newUser(browser, "Cal");
  await openCourt(a.page, COURTS.alpha.name);
  await postGame(a.page, { skill: "3.5" });
  await openCourt(b.page, COURTS.alpha.name);
  await joinGame(b.page, gameCard(b.page, "Ana"));
  await openCourt(c.page, COURTS.alpha.name);
  await ionButton(gameCard(c.page, "Ana"), "Join").click();
  const joinSheet = c.page.locator("ion-modal").filter({ visible: true }).last();
  await expect(joinSheet).toContainText("Ana");
  await expect(joinSheet).toContainText("Ben");
  await expect(joinSheet).toContainText("Open spot");
  await a.context.close();
  await b.context.close();
  await c.context.close();
});

test("E2E-173 Show N games button closes filter sheet", async ({ browser }) => {
  const a = await newUser(browser, "Ana");
  await openCourt(a.page, COURTS.alpha.name);
  await postGame(a.page, { skill: "Any level" });
  const { context, page } = await newUser(browser, "Ben");
  await openCourt(page, COURTS.alpha.name);
  await page.locator(".match-board__filter-btn").click();
  const sheet = page.locator("ion-modal").filter({ visible: true }).last();
  await expect(sheet.locator(".game-filter-sheet__show-btn")).toContainText(
    "Show 1 game",
  );
  await sheet.locator(".game-filter-sheet__show-btn").click();
  await expect(sheet).not.toBeVisible();
  await a.context.close();
  await context.close();
});

test("E2E-174 full game shows Full badge not Join button", async ({
  browser,
}) => {
  const a = await newUser(browser, "Ana");
  const b = await newUser(browser, "Ben");
  const c = await newUser(browser, "Cal");
  const d = await newUser(browser, "Dan");
  await openCourt(a.page, COURTS.alpha.name);
  await postGame(a.page, { skill: "Any level" });
  await openCourt(b.page, COURTS.alpha.name);
  await joinGame(b.page, gameCard(b.page, "Ana"));
  await openCourt(c.page, COURTS.alpha.name);
  await joinGame(c.page, gameCard(c.page, "Ana"));
  await openCourt(d.page, COURTS.alpha.name);
  await joinGame(d.page, gameCard(d.page, "Ana"));

  const { context, page } = await newUser(browser, "Eve");
  await openCourt(page, COURTS.alpha.name);
  const card = gameCard(page, "Ana");
  await expect(card.locator(".match-card__full-badge")).toBeVisible();
  await expect(ionButton(card, "Join")).toHaveCount(0);
  await a.context.close();
  await b.context.close();
  await c.context.close();
  await d.context.close();
  await context.close();
});
