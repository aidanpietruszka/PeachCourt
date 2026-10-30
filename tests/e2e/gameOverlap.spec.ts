import { expect, test } from "@playwright/test";
import {
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

test("E2E-32 conflict note and disabled Join appear when hosted game overlaps", async ({
  browser,
}) => {
  const a = await newUser(browser, "Ana");
  const b = await newUser(browser, "Ben");
  await openCourt(a.page, COURTS.alpha.name);
  await postGame(a.page, { skill: "Any level", time: "10:00" });

  await openCourt(b.page, COURTS.alpha.name);
  await postGame(b.page, { skill: "Any level", time: "10:30" });

  await a.page.goto("/courts");
  await openCourt(a.page, COURTS.alpha.name);
  const card = gameCard(a.page, "Ben");
  await expect(card.locator(".match-conflict")).toBeVisible();
  await expect(ionButton(card, "Join")).toHaveAttribute("aria-disabled", "true");
  await a.context.close();
  await b.context.close();
});

test("E2E-33 conflict note appears when joined game overlaps", async ({
  browser,
}) => {
  const a = await newUser(browser, "Ana");
  const b = await newUser(browser, "Ben");
  const c = await newUser(browser, "Cal");

  await openCourt(a.page, COURTS.alpha.name);
  await postGame(a.page, { skill: "Any level", time: "10:00" });
  await openCourt(b.page, COURTS.alpha.name);
  await postGame(b.page, { skill: "Any level", time: "10:30" });

  await openCourt(c.page, COURTS.alpha.name);
  const anaCard = gameCard(c.page, "Ana");
  await ionButton(anaCard, "Join").click();
  const alert = c.page.locator("ion-alert").filter({ visible: true }).last();
  await alert.locator("input").fill("Cal");
  await alert.locator("button").filter({ hasText: "Join" }).first().click();
  await expect(visibleText(c.page, "You joined Ana's game.")).toBeVisible();

  const benCard = gameCard(c.page, "Ben");
  await expect(benCard.locator(".match-conflict")).toBeVisible();
  await expect(ionButton(benCard, "Join")).toHaveAttribute("aria-disabled", "true");
  await a.context.close();
  await b.context.close();
  await c.context.close();
});

test("E2E-34 no conflict note for your own hosted game", async ({
  browser,
}) => {
  const { context, page } = await newUser(browser, "Ana");
  await openCourt(page, COURTS.alpha.name);
  await postGame(page, { skill: "Any level", time: "10:00" });
  const card = gameCard(page, "Ana");
  await expect(card.locator(".match-conflict")).toHaveCount(0);
  await context.close();
});

test("E2E-35 no conflict note for a game you have already joined", async ({
  browser,
}) => {
  const a = await newUser(browser, "Ana");
  const b = await newUser(browser, "Ben");
  await openCourt(a.page, COURTS.alpha.name);
  await postGame(a.page, { skill: "Any level", time: "10:00" });

  await openCourt(b.page, COURTS.alpha.name);
  const anaCard = gameCard(b.page, "Ana");
  await ionButton(anaCard, "Join").click();
  const alert = b.page.locator("ion-alert").filter({ visible: true }).last();
  await alert.locator("input").fill("Ben");
  await alert.locator("button").filter({ hasText: "Join" }).first().click();
  await expect(visibleText(b.page, "You joined Ana's game.")).toBeVisible();

  await expect(anaCard.locator(".match-conflict")).toHaveCount(0);
  await a.context.close();
  await b.context.close();
});

test("E2E-36 conflict note disappears after leaving the conflicting game", async ({
  browser,
}) => {
  const a = await newUser(browser, "Ana");
  const b = await newUser(browser, "Ben");
  await openCourt(a.page, COURTS.alpha.name);
  await postGame(a.page, { skill: "Any level", time: "10:00" });
  await openCourt(b.page, COURTS.alpha.name);
  await postGame(b.page, { skill: "Any level", time: "10:30" });

  await a.page.goto("/courts");
  await openCourt(a.page, COURTS.alpha.name);
  const benCard = gameCard(a.page, "Ben");
  await expect(benCard.locator(".match-conflict")).toBeVisible();

  const anaCard = gameCard(a.page, "Ana");
  await expect(anaCard).toContainText("Your game");
  await a.page.goto("/courts");
  await openCourt(a.page, COURTS.alpha.name);
  await expect(gameCard(a.page, "Ben").locator(".match-conflict")).toBeVisible();
  await a.context.close();
  await b.context.close();
});

test("E2E-37 games exactly 60 minutes apart do not show a conflict", async ({
  browser,
}) => {
  const a = await newUser(browser, "Ana");
  const b = await newUser(browser, "Ben");
  await openCourt(a.page, COURTS.alpha.name);
  await postGame(a.page, { skill: "Any level", time: "10:00" });
  await openCourt(b.page, COURTS.alpha.name);
  await postGame(b.page, { skill: "Any level", time: "11:00" });

  await a.page.goto("/courts");
  await openCourt(a.page, COURTS.alpha.name);
  const benCard = gameCard(a.page, "Ben");
  await expect(benCard.locator(".match-conflict")).toHaveCount(0);
  await expect(ionButton(benCard, "Join")).not.toBeDisabled();
  await a.context.close();
  await b.context.close();
});

test("E2E-38 conflict note appears in post modal when time overlaps existing game", async ({
  browser,
}) => {
  const a = await newUser(browser, "Ana");
  const b = await newUser(browser, "Ben");
  await openCourt(a.page, COURTS.alpha.name);
  await postGame(a.page, { skill: "Any level", time: "10:00" });

  await openCourt(b.page, COURTS.alpha.name);
  await postGame(b.page, { skill: "Any level", time: "10:00" });

  await ionButton(a.page.locator("ion-footer"), "Post a game").click();
  const modal = a.page.locator("ion-modal").filter({ visible: true }).last();
  await modal.locator("ion-select").nth(0).click();
  await a.page
    .locator("ion-popover")
    .getByText("Tomorrow", { exact: true })
    .click();
  await modal.locator('input[type="time"]').fill("10:30");
  await expect(modal.locator(".match-conflict")).toBeVisible();
  await expect(ionButton(modal, "Post game")).toHaveAttribute("aria-disabled", "true");
  await a.context.close();
  await b.context.close();
});

test("E2E-39 no conflict in post modal when times are exactly 60 min apart", async ({
  browser,
}) => {
  const { context, page } = await newUser(browser, "Ana");
  await openCourt(page, COURTS.alpha.name);
  await postGame(page, { skill: "Any level", time: "10:00" });

  await ionButton(page.locator("ion-footer"), "Post a game").click();
  const modal = page.locator("ion-modal").filter({ visible: true }).last();
  await modal.locator("ion-select").nth(0).click();
  await page
    .locator("ion-popover")
    .getByText("Tomorrow", { exact: true })
    .click();
  await modal.locator('input[type="time"]').fill("11:00");
  await expect(modal.locator(".match-conflict")).toHaveCount(0);
  await expect(ionButton(modal, "Post game")).not.toBeDisabled();
  await context.close();
});

test("E2E-40 conflict note shows the conflicting game details", async ({
  browser,
}) => {
  const a = await newUser(browser, "Ana");
  const b = await newUser(browser, "Ben");
  await openCourt(a.page, COURTS.alpha.name);
  await postGame(a.page, { skill: "Any level", time: "10:00" });
  await openCourt(b.page, COURTS.alpha.name);
  await postGame(b.page, { skill: "Any level", time: "10:30" });

  await a.page.goto("/courts");
  await openCourt(a.page, COURTS.alpha.name);
  const conflict = gameCard(a.page, "Ben").locator(".match-conflict");
  await expect(conflict).toContainText("You're already in a game at this time");
  await expect(conflict).toContainText("Leave that game or pick another one.");
  await a.context.close();
  await b.context.close();
});

test("E2E-41 post modal conflict note ends with the 1-hour message", async ({
  browser,
}) => {
  const { context, page } = await newUser(browser, "Ana");
  await openCourt(page, COURTS.alpha.name);
  await postGame(page, { skill: "Any level", time: "10:00" });

  await ionButton(page.locator("ion-footer"), "Post a game").click();
  const modal = page.locator("ion-modal").filter({ visible: true }).last();
  await modal.locator("ion-select").nth(0).click();
  await page
    .locator("ion-popover")
    .getByText("Tomorrow", { exact: true })
    .click();
  await modal.locator('input[type="time"]').fill("10:30");
  await expect(modal.locator(".match-conflict")).toContainText(
    "Pick a time at least 1 hour apart.",
  );
  await context.close();
});

test("E2E-42 cross-court conflict: hosted game at one court blocks join at another", async ({
  browser,
}) => {
  const a = await newUser(browser, "Ana");
  const b = await newUser(browser, "Ben");

  await openCourt(a.page, COURTS.alpha.name);
  await postGame(a.page, { skill: "Any level", time: "10:00" });

  await openCourt(b.page, COURTS.beta.name);
  await postGame(b.page, { sport: "Pickleball", skill: "Any level", time: "10:30" });

  await a.page.goto("/courts");
  await openCourt(a.page, COURTS.beta.name);
  const benCard = gameCard(a.page, "Ben");
  await expect(benCard.locator(".match-conflict")).toBeVisible();
  await expect(ionButton(benCard, "Join")).toHaveAttribute("aria-disabled", "true");
  await a.context.close();
  await b.context.close();
});

test("E2E-43 conflict note shows game court name from description", async ({
  browser,
}) => {
  const a = await newUser(browser, "Ana");
  const b = await newUser(browser, "Ben");
  await openCourt(a.page, COURTS.alpha.name);
  await postGame(a.page, { skill: "Any level", time: "10:00" });
  await openCourt(b.page, COURTS.alpha.name);
  await postGame(b.page, { skill: "Any level", time: "10:30" });

  await a.page.goto("/courts");
  await openCourt(a.page, COURTS.alpha.name);
  const conflict = gameCard(a.page, "Ben").locator(".match-conflict");
  await expect(conflict).toContainText(COURTS.alpha.name);
  await a.context.close();
  await b.context.close();
});

test("E2E-44 check-in confirmation says 1 hour", async ({ browser }) => {
  const { context, page } = await newUser(browser, "Ana");
  await openCourt(page, COURTS.alpha.name);
  await ionButton(page.locator("ion-footer"), "Check in").click();
  const alert = page.locator("ion-alert").filter({ visible: true }).last();
  await alert.locator("input").fill("2");
  await alert.locator("button").filter({ hasText: "Check in" }).first().click();
  const modal = page.locator("ion-modal").filter({ visible: true }).last();
  await expect(modal).toContainText("1 hour or when you check out");
  await context.close();
});

test("E2E-45 games 45 min apart conflict", async ({ browser }) => {
  const a = await newUser(browser, "Ana");
  const b = await newUser(browser, "Ben");
  await openCourt(a.page, COURTS.alpha.name);
  await postGame(a.page, { skill: "Any level", time: "10:00" });
  await openCourt(b.page, COURTS.alpha.name);
  await postGame(b.page, { skill: "Any level", time: "10:45" });

  await a.page.goto("/courts");
  await openCourt(a.page, COURTS.alpha.name);
  await expect(
    gameCard(a.page, "Ben").locator(".match-conflict"),
  ).toBeVisible();
  await a.context.close();
  await b.context.close();
});

test("E2E-46 games 59 min apart conflict", async ({ browser }) => {
  const a = await newUser(browser, "Ana");
  const b = await newUser(browser, "Ben");
  await openCourt(a.page, COURTS.alpha.name);
  await postGame(a.page, { skill: "Any level", time: "10:00" });
  await openCourt(b.page, COURTS.alpha.name);
  await postGame(b.page, { skill: "Any level", time: "10:59" });

  await a.page.goto("/courts");
  await openCourt(a.page, COURTS.alpha.name);
  await expect(
    gameCard(a.page, "Ben").locator(".match-conflict"),
  ).toBeVisible();
  await a.context.close();
  await b.context.close();
});

test("E2E-47 conflict on both sides: 4:45 blocked by 4:00 and 5:30", async ({
  browser,
}) => {
  const a = await newUser(browser, "Ana");
  const b = await newUser(browser, "Ben");
  const c = await newUser(browser, "Cal");
  await openCourt(a.page, COURTS.alpha.name);
  await postGame(a.page, { skill: "Any level", time: "10:00" });
  await openCourt(b.page, COURTS.alpha.name);
  await postGame(b.page, { skill: "Any level", time: "11:30" });
  await openCourt(c.page, COURTS.alpha.name);
  await postGame(c.page, { skill: "Any level", time: "10:45" });

  await a.page.goto("/courts");
  await openCourt(a.page, COURTS.alpha.name);
  await expect(
    gameCard(a.page, "Cal").locator(".match-conflict"),
  ).toBeVisible();

  await b.page.goto("/courts");
  await openCourt(b.page, COURTS.alpha.name);
  await expect(
    gameCard(b.page, "Cal").locator(".match-conflict"),
  ).toBeVisible();
  await a.context.close();
  await b.context.close();
  await c.context.close();
});

test("E2E-48 non-conflicting users see no conflict note", async ({
  browser,
}) => {
  const a = await newUser(browser, "Ana");
  const b = await newUser(browser, "Ben");
  const c = await newUser(browser, "Cal");
  await openCourt(a.page, COURTS.alpha.name);
  await postGame(a.page, { skill: "Any level", time: "10:00" });
  await openCourt(b.page, COURTS.alpha.name);
  await postGame(b.page, { skill: "Any level", time: "10:30" });

  await openCourt(c.page, COURTS.alpha.name);
  await expect(
    gameCard(c.page, "Ben").locator(".match-conflict"),
  ).toHaveCount(0);
  await a.context.close();
  await b.context.close();
  await c.context.close();
});
