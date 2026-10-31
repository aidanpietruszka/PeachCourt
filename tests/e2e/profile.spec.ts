import { expect, test } from "@playwright/test";
import { newUser, resetData, signUp } from "./support";

test.beforeEach(async () => {
  await resetData();
});

test("E2E-92 signup redirects to onboarding", async ({ page }) => {
  const email = `sam-${Date.now()}@test.dev`;
  await page.goto("/signup");
  await page.getByPlaceholder("Name (optional)").fill("Sam");
  await page.getByPlaceholder("Email").fill(email);
  await page.getByPlaceholder("Password (6+ characters)").fill("secret123");
  await page.getByPlaceholder("Confirm password").fill("secret123");
  await page.getByRole("button", { name: "Sign up", exact: true }).click();
  await expect(page).toHaveURL(/\/onboarding$/);
  await expect(page.getByText("Your game")).toBeVisible();
  await expect(page.getByText("Step 1 of 3")).toBeVisible();
});

test("E2E-93 onboarding prefills name from signup", async ({ page }) => {
  const email = `sam-${Date.now()}@test.dev`;
  await page.goto("/signup");
  await page.getByPlaceholder("Name (optional)").fill("Sam Test");
  await page.getByPlaceholder("Email").fill(email);
  await page.getByPlaceholder("Password (6+ characters)").fill("secret123");
  await page.getByPlaceholder("Confirm password").fill("secret123");
  await page.getByRole("button", { name: "Sign up", exact: true }).click();
  await expect(page).toHaveURL(/\/onboarding$/);
  await expect(page.getByLabel("First name")).toHaveValue("Sam");
  await expect(page.getByLabel("Last name")).toHaveValue("Test");
});

test("E2E-94 onboarding requires first name", async ({ page }) => {
  const email = `sam-${Date.now()}@test.dev`;
  await page.goto("/signup");
  await page.getByPlaceholder("Email").fill(email);
  await page.getByPlaceholder("Password (6+ characters)").fill("secret123");
  await page.getByPlaceholder("Confirm password").fill("secret123");
  await page.getByRole("button", { name: "Sign up", exact: true }).click();
  await expect(page).toHaveURL(/\/onboarding$/);
  await page.getByLabel("Last name").fill("Test");
  await page.getByRole("button", { name: "Tennis" }).click();
  await page.locator(".onboarding__skill-row").first().click();
  await page.locator("ion-action-sheet button").filter({ hasText: "3.5" }).click();
  await page.getByRole("button", { name: "Next" }).click();
  await expect(page.getByText("Enter your first name.")).toBeVisible();
  await expect(page).toHaveURL(/\/onboarding$/);
});

test("E2E-95 onboarding requires last name", async ({ page }) => {
  const email = `sam-${Date.now()}@test.dev`;
  await page.goto("/signup");
  await page.getByPlaceholder("Email").fill(email);
  await page.getByPlaceholder("Password (6+ characters)").fill("secret123");
  await page.getByPlaceholder("Confirm password").fill("secret123");
  await page.getByRole("button", { name: "Sign up", exact: true }).click();
  await expect(page).toHaveURL(/\/onboarding$/);
  await page.getByLabel("First name").fill("Sam");
  await page.getByRole("button", { name: "Tennis" }).click();
  await page.locator(".onboarding__skill-row").first().click();
  await page.locator("ion-action-sheet button").filter({ hasText: "3.5" }).click();
  await page.getByRole("button", { name: "Next" }).click();
  await expect(page.getByText("Enter your last name.")).toBeVisible();
  await expect(page).toHaveURL(/\/onboarding$/);
});

test("E2E-96 onboarding requires at least one sport", async ({ page }) => {
  const email = `sam-${Date.now()}@test.dev`;
  await page.goto("/signup");
  await page.getByPlaceholder("Email").fill(email);
  await page.getByPlaceholder("Password (6+ characters)").fill("secret123");
  await page.getByPlaceholder("Confirm password").fill("secret123");
  await page.getByRole("button", { name: "Sign up", exact: true }).click();
  await expect(page).toHaveURL(/\/onboarding$/);
  await page.getByLabel("First name").fill("Sam");
  await page.getByLabel("Last name").fill("Test");
  await page.getByRole("button", { name: "Next" }).click();
  await expect(page.getByText("Select at least one sport.")).toBeVisible();
  await expect(page).toHaveURL(/\/onboarding$/);
});

test("E2E-97 onboarding requires skill for each selected sport", async ({
  page,
}) => {
  const email = `sam-${Date.now()}@test.dev`;
  await page.goto("/signup");
  await page.getByPlaceholder("Email").fill(email);
  await page.getByPlaceholder("Password (6+ characters)").fill("secret123");
  await page.getByPlaceholder("Confirm password").fill("secret123");
  await page.getByRole("button", { name: "Sign up", exact: true }).click();
  await expect(page).toHaveURL(/\/onboarding$/);
  await page.getByLabel("First name").fill("Sam");
  await page.getByLabel("Last name").fill("Test");
  await page.getByRole("button", { name: "Tennis" }).click();
  await page.getByRole("button", { name: "Next" }).click();
  await expect(
    page.getByText("Select a skill level for Tennis (NTRP)."),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/onboarding$/);
});

test("E2E-98 onboarding complete saves profile and lands on courts", async ({
  page,
}) => {
  await signUp(page, "Sam");
  await expect(page).toHaveURL(/\/courts$/);
  await expect(page.getByText("Courts near you")).toBeVisible();
});

test("E2E-99 profile tab shows saved name and sports", async ({ browser }) => {
  const { context, page } = await newUser(browser, "Sam");
  await page.locator("ion-tab-button[tab='profile']").click();
  await expect(page).toHaveURL(/\/profile$/);
  await expect(page.locator(".profile-page__name")).toHaveText("Sam T.");
  await expect(page.locator(".profile-page__sport-chip", { hasText: "Tennis" })).toBeVisible();
  await expect(page.locator("ion-item", { hasText: "Tennis (NTRP)" })).toContainText("3.5");
  await context.close();
});

test("E2E-100 profile tab has edit profile button", async ({ browser }) => {
  const { context, page } = await newUser(browser, "Sam");
  await page.locator("ion-tab-button[tab='profile']").click();
  await expect(page.getByRole("button", { name: "Edit profile" })).toBeVisible();
  await context.close();
});

test("E2E-101 edit profile opens full-screen form and saves changes", async ({
  browser,
}) => {
  const { context, page } = await newUser(browser, "Sam");
  await page.locator("ion-tab-button[tab='profile']").click();
  await page.getByRole("button", { name: "Edit profile" }).click();
  await expect(page).toHaveURL(/\/profile\/edit$/);
  await page.getByLabel("First name").fill("Samuel");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page).toHaveURL(/\/profile$/);
  await expect(page.locator(".profile-page__name")).toHaveText("Samuel T.");
  await context.close();
});

test("E2E-102 login with existing profile skips onboarding", async ({
  browser,
}) => {
  const { context, page, email } = await newUser(browser, "Sam");
  await page.getByRole("button", { name: "Log out" }).click();
  await page.getByPlaceholder("Email").fill(email);
  await page.getByPlaceholder("Password").fill("secret123");
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page).toHaveURL(/\/courts$/);
  await context.close();
});

test("E2E-103 courts tab and profile tab switch correctly", async ({
  browser,
}) => {
  const { context, page } = await newUser(browser, "Sam");
  await expect(page).toHaveURL(/\/courts$/);
  await page.locator("ion-tab-button[tab='profile']").click();
  await expect(page).toHaveURL(/\/profile$/);
  await page.reload();
  await page.locator("ion-tab-button[tab='courts']").click();
  await expect(page).toHaveURL(/\/courts$/);
  await context.close();
});

test("E2E-104 onboarding step 1 Next shows location step", async ({
  page,
}) => {
  const email = `sam-${Date.now()}@test.dev`;
  await page.goto("/signup");
  await page.getByPlaceholder("Email").fill(email);
  await page.getByPlaceholder("Password (6+ characters)").fill("secret123");
  await page.getByPlaceholder("Confirm password").fill("secret123");
  await page.getByRole("button", { name: "Sign up", exact: true }).click();
  await page.getByLabel("First name").fill("Sam");
  await page.getByLabel("Last name").fill("Test");
  await page.getByRole("button", { name: "Tennis" }).click();
  await page.locator(".onboarding__skill-row").first().click();
  await page.locator("ion-action-sheet button").filter({ hasText: "3.5" }).click();
  await page.getByRole("button", { name: "Next" }).click();
  await expect(page).toHaveURL(/\/onboarding$/);
  await expect(page.getByText("Use your location")).toBeVisible();
  await expect(page.getByText("Step 2 of 3")).toBeVisible();
});

test("E2E-105 onboarding step 2 Skip shows notifications step", async ({
  page,
}) => {
  const email = `sam-${Date.now()}@test.dev`;
  await page.goto("/signup");
  await page.getByPlaceholder("Email").fill(email);
  await page.getByPlaceholder("Password (6+ characters)").fill("secret123");
  await page.getByPlaceholder("Confirm password").fill("secret123");
  await page.getByRole("button", { name: "Sign up", exact: true }).click();
  await page.getByLabel("First name").fill("Sam");
  await page.getByLabel("Last name").fill("Test");
  await page.getByRole("button", { name: "Tennis" }).click();
  await page.locator(".onboarding__skill-row").first().click();
  await page.locator("ion-action-sheet button").filter({ hasText: "3.5" }).click();
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: "Skip for now" }).click();
  await expect(page).toHaveURL(/\/onboarding$/);
  await expect(page.getByText("Get game alerts")).toBeVisible();
  await expect(page.getByText("Step 3 of 3")).toBeVisible();
});

test("E2E-106 onboarding step 3 Skip navigates to courts", async ({
  page,
}) => {
  const email = `sam-${Date.now()}@test.dev`;
  await page.goto("/signup");
  await page.getByPlaceholder("Email").fill(email);
  await page.getByPlaceholder("Password (6+ characters)").fill("secret123");
  await page.getByPlaceholder("Confirm password").fill("secret123");
  await page.getByRole("button", { name: "Sign up", exact: true }).click();
  await page.getByLabel("First name").fill("Sam");
  await page.getByLabel("Last name").fill("Test");
  await page.getByRole("button", { name: "Tennis" }).click();
  await page.locator(".onboarding__skill-row").first().click();
  await page.locator("ion-action-sheet button").filter({ hasText: "3.5" }).click();
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: "Skip for now" }).click();
  await page.getByRole("button", { name: "Skip for now" }).click();
  await expect(page).toHaveURL(/\/courts$/);
});

test("E2E-107 step 2 auto check-in toggle is disabled until location is on", async ({
  page,
}) => {
  const email = `sam-${Date.now()}@test.dev`;
  await page.goto("/signup");
  await page.getByPlaceholder("Email").fill(email);
  await page.getByPlaceholder("Password (6+ characters)").fill("secret123");
  await page.getByPlaceholder("Confirm password").fill("secret123");
  await page.getByRole("button", { name: "Sign up", exact: true }).click();
  await page.getByLabel("First name").fill("Sam");
  await page.getByLabel("Last name").fill("Test");
  await page.getByRole("button", { name: "Tennis" }).click();
  await page.locator(".onboarding__skill-row").first().click();
  await page.locator("ion-action-sheet button").filter({ hasText: "3.5" }).click();
  await page.getByRole("button", { name: "Next" }).click();
  await expect(page.getByText("Use your location")).toBeVisible();
  const autoCheckinToggle = page.locator("ion-toggle[aria-label='Automatic check-in']");
  await expect(autoCheckinToggle).toBeDisabled();
  await expect(page.locator(".onboarding__toggle-row--disabled")).toBeVisible();
});

test("E2E-108 step 3 shows notifications toggle in browser context", async ({
  page,
}) => {
  const email = `sam-${Date.now()}@test.dev`;
  await page.goto("/signup");
  await page.getByPlaceholder("Email").fill(email);
  await page.getByPlaceholder("Password (6+ characters)").fill("secret123");
  await page.getByPlaceholder("Confirm password").fill("secret123");
  await page.getByRole("button", { name: "Sign up", exact: true }).click();
  await page.getByLabel("First name").fill("Sam");
  await page.getByLabel("Last name").fill("Test");
  await page.getByRole("button", { name: "Tennis" }).click();
  await page.locator(".onboarding__skill-row").first().click();
  await page.locator("ion-action-sheet button").filter({ hasText: "3.5" }).click();
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: "Skip for now" }).click();
  await expect(page.getByText("Get game alerts")).toBeVisible();
  const notifToggle = page.locator("ion-toggle[aria-label='Notifications']");
  await expect(notifToggle).toBeVisible();
  await expect(notifToggle).not.toBeChecked();
  await expect(page.getByRole("button", { name: "Skip for now" })).toBeVisible();
});
