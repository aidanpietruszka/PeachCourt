import { expect, test } from "@playwright/test";
import {
  expectLoginPageShown,
  newUser,
  resetData,
  signUp,
  visibleText,
} from "./support";

test.beforeEach(async () => {
  await resetData();
});

test("E2E-01 sign up lands on the courts page", async ({ page }) => {
  await signUp(page, "Sam");
  await expect(visibleText(page, "Courts near you")).toBeVisible();
});

test("E2E-02 log out shows a visible login page", async ({ browser }) => {
  const { context, page } = await newUser(browser, "Sam");
  await page.getByRole("button", { name: "Log out" }).click();
  await expectLoginPageShown(page);
  await context.close();
});

test("E2E-03 log back in after logging out", async ({ browser }) => {
  const { context, page, email } = await newUser(browser, "Sam");
  await page.getByRole("button", { name: "Log out" }).click();
  await expectLoginPageShown(page);
  await page.getByPlaceholder("Email").fill(email);
  await page.getByPlaceholder("Password").fill("secret123");
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page).toHaveURL(/\/courts$/);
  await context.close();
});

test("E2E-04 signed-out users are sent to login", async ({ page }) => {
  await page.goto("/courts");
  await expectLoginPageShown(page);
});

test("E2E-05 continue as guest reaches the courts page", async ({ page }) => {
  await page.goto("/");
  await page.getByText("Continue as guest").click();
  await expect(page).toHaveURL(/\/courts$/);
  await expect(visibleText(page, "Courts near you")).toBeVisible();
});
