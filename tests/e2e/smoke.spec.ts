import { test, expect } from "@playwright/test";

test("E2E-SMOKE-01 unauthenticated visit redirects to login", async ({
  page,
}) => {
  await page.goto("/courts");
  await expect(page).toHaveURL(/\/login$/);
  await expect(
    page.locator("h1.pc-title", { hasText: "Log in" }),
  ).toBeVisible();
});

test("E2E-SMOKE-02 signup, onboarding and courts list load on hosted app", async ({
  page,
}) => {
  const email = `smoke-${Date.now()}-${Math.floor(Math.random() * 1e6)}@test.dev`;
  await page.goto("/signup");
  await page.getByPlaceholder("Name (optional)").fill("Smoke");
  await page.getByPlaceholder("Email").fill(email);
  await page.getByPlaceholder("Password (6+ characters)").fill("secret123");
  await page.getByPlaceholder("Confirm password").fill("secret123");
  await page.getByRole("button", { name: "Sign up", exact: true }).click();
  await expect(page).toHaveURL(/\/onboarding$/);
  await page.getByLabel("First name").fill("Smoke");
  await page.getByLabel("Last name").fill("Test");
  await page.getByRole("button", { name: "Tennis" }).click();
  await page.locator(".onboarding__skill-row").first().click();
  await expect(page.locator("ion-action-sheet")).toBeVisible();
  await page.locator("ion-action-sheet button").filter({ hasText: "3.5" }).click();
  await page.getByRole("button", { name: "Next" }).click();
  await expect(page.getByText("Use your location")).toBeVisible();
  await page.getByRole("button", { name: "Skip for now" }).click();
  await expect(page.getByText("Get game alerts")).toBeVisible();
  await page.getByRole("button", { name: "Skip for now" }).click();
  await expect(page).toHaveURL(/\/courts$/);
  await expect(page.locator("ion-content").first()).toBeVisible();
});
