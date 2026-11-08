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

test("E2E-175 confirm sheet opens after Post game is clicked with valid time", async ({
  browser,
}) => {
  const { context, page } = await newUser(browser, "Ana");
  await openCourt(page, COURTS.alpha.name);
  await ionButton(page.locator("ion-footer"), "Post a game").click();
  const form = page.locator("ion-modal").filter({ visible: true }).last();
  await expect(form).toContainText(
    "Players near your skill level get an alert.",
  );
  await form.locator("ion-select").nth(0).click();
  await page.locator("ion-popover").getByText("Tomorrow", { exact: true }).click();
  await form.locator('input[type="time"]').fill("10:00");
  await ionButton(form, "Post game").click();
  const confirmSheet = page.locator("ion-modal").filter({ visible: true }).last();
  await expect(confirmSheet).toContainText("Check your game");
  await context.close();
});

test("E2E-176 confirm sheet shows all summary rows", async ({ browser }) => {
  const { context, page } = await newUser(browser, "Ana");
  await openCourt(page, COURTS.alpha.name);
  await ionButton(page.locator("ion-footer"), "Post a game").click();
  const form = page.locator("ion-modal").filter({ visible: true }).last();
  await form.locator("ion-select").nth(0).click();
  await page.locator("ion-popover").getByText("Tomorrow", { exact: true }).click();
  await form.locator('input[type="time"]').fill("14:30");
  await form.locator("ion-select").nth(1).click();
  await page.locator("ion-popover").getByText("3.5", { exact: true }).click();
  await ionButton(form, "Post game").click();
  const confirmSheet = page.locator("ion-modal").filter({ visible: true }).last();
  await expect(confirmSheet).toContainText(COURTS.alpha.name);
  await expect(confirmSheet).toContainText("Tennis");
  await expect(confirmSheet).toContainText("Doubles (4 players)");
  await expect(confirmSheet).toContainText("Tomorrow");
  await expect(confirmSheet).toContainText("3.5 (from your profile)");
  await context.close();
});

test("E2E-177 singles format shows correct player count in confirm", async ({
  browser,
}) => {
  const { context, page } = await newUser(browser, "Ana");
  await openCourt(page, COURTS.alpha.name);
  await ionButton(page.locator("ion-footer"), "Post a game").click();
  const form = page.locator("ion-modal").filter({ visible: true }).last();
  await form
    .locator("ion-segment-button")
    .filter({ hasText: "Singles" })
    .click();
  await form.locator("ion-select").nth(0).click();
  await page.locator("ion-popover").getByText("Tomorrow", { exact: true }).click();
  await form.locator('input[type="time"]').fill("10:00");
  await ionButton(form, "Post game").click();
  const confirmSheet = page.locator("ion-modal").filter({ visible: true }).last();
  await expect(confirmSheet).toContainText("Singles (2 players)");
  await context.close();
});

test("E2E-178 Go back from confirm returns to the form", async ({ browser }) => {
  const { context, page } = await newUser(browser, "Ana");
  await openCourt(page, COURTS.alpha.name);
  await ionButton(page.locator("ion-footer"), "Post a game").click();
  const form = page.locator("ion-modal").filter({ visible: true }).last();
  await form.locator("ion-select").nth(0).click();
  await page.locator("ion-popover").getByText("Tomorrow", { exact: true }).click();
  await form.locator('input[type="time"]').fill("10:00");
  await ionButton(form, "Post game").click();
  const confirmSheet = page.locator('ion-modal[aria-label="Confirm game"]');
  await expect(confirmSheet).toContainText("Check your game");
  await ionButton(confirmSheet, "Go back").click();
  await expect(confirmSheet).not.toBeVisible();
  await expect(form).toBeVisible();
  await context.close();
});

test("E2E-179 no start time shows toast and does not open confirm", async ({
  browser,
}) => {
  const { context, page } = await newUser(browser, "Ana");
  await openCourt(page, COURTS.alpha.name);
  await ionButton(page.locator("ion-footer"), "Post a game").click();
  const form = page.locator("ion-modal").filter({ visible: true }).last();
  await ionButton(form, "Post game").click();
  await expect(visibleText(page, "Choose a start time.")).toBeVisible();
  await expect(page.locator(".confirm-sheet")).toHaveCount(0);
  await context.close();
});

test("E2E-180 posting from confirm sheet shows toast and closes both modals", async ({
  browser,
}) => {
  const { context, page } = await newUser(browser, "Ana");
  await openCourt(page, COURTS.alpha.name);
  await postGame(page, { skill: "Any level" });
  await expect(gameCard(page, "Ana")).toBeVisible();
  await context.close();
});

test("E2E-181 conflict in confirm disables Post game and shows conflict note", async ({
  browser,
}) => {
  const a = await newUser(browser, "Ana");
  const b = await newUser(browser, "Ben");
  await openCourt(a.page, COURTS.alpha.name);
  await postGame(a.page, { skill: "Any level", time: "10:00" });

  await openCourt(b.page, COURTS.alpha.name);
  await postGame(b.page, { skill: "Any level", time: "10:00" });

  await ionButton(a.page.locator("ion-footer"), "Post a game").click();
  const form = a.page.locator("ion-modal").filter({ visible: true }).last();
  await form.locator("ion-select").nth(0).click();
  await a.page
    .locator("ion-popover")
    .getByText("Tomorrow", { exact: true })
    .click();
  await form.locator('input[type="time"]').fill("10:30");
  await ionButton(form, "Post game").click();
  const confirmSheet = a.page.locator("ion-modal").filter({ visible: true }).last();
  await expect(confirmSheet.locator(".confirm-sheet__conflict")).toBeVisible();
  await expect(ionButton(confirmSheet, "Post game")).toHaveAttribute(
    "aria-disabled",
    "true",
  );
  await a.context.close();
  await b.context.close();
});
