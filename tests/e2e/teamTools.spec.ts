import { expect, test } from "@playwright/test";
import {
  COURTS,
  getUidByEmail,
  newUser,
  openCourt,
  resetData,
  seedTeamAccounts,
} from "./support";

test.beforeEach(async () => {
  await resetData();
});

test("E2E-201 Team tools card not shown for regular user", async ({ browser }) => {
  const { context, page, email } = await newUser(browser, "Ana");
  await openCourt(page, COURTS.alpha.name);
  await expect(page.locator(".team-tools-card")).not.toBeVisible();
  await context.close();
  void email;
});

test("E2E-202 Team tools card visible for team member", async ({ browser }) => {
  const { context, page, email } = await newUser(browser, "Ana");
  const uid = await getUidByEmail(email);
  await seedTeamAccounts([uid]);
  await openCourt(page, COURTS.alpha.name);
  await expect(page.locator(".team-tools-card")).toBeVisible();
  await expect(page.locator(".team-tools-card")).toContainText("Team tools (testers only)");
  await context.close();
});

test("E2E-203 Real count sheet opens from Team tools card", async ({ browser }) => {
  const { context, page, email } = await newUser(browser, "Ana");
  const uid = await getUidByEmail(email);
  await seedTeamAccounts([uid]);
  await openCourt(page, COURTS.alpha.name);
  await page.locator(".team-tools-card").click();
  await expect(page.locator(".real-count-sheet__heading")).toContainText("Real player count");
  await expect(page.locator(".real-count-sheet__row").first()).toBeVisible();
  await context.close();
});

test("E2E-204 Save real count saves successfully", async ({ browser }) => {
  const { context, page, email } = await newUser(browser, "Ana");
  const uid = await getUidByEmail(email);
  await seedTeamAccounts([uid]);
  await openCourt(page, COURTS.alpha.name);
  await page.locator(".team-tools-card").click();
  await page.locator(".real-count-sheet__row").filter({ hasText: "Busy" }).click();
  await page.locator(".real-count-sheet__save").click();
  await expect(page.locator(".real-count-sheet__heading")).not.toBeVisible();
  await context.close();
});
