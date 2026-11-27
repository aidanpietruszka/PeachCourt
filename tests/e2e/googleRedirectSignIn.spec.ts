import { test, expect } from "@playwright/test";
import {
  APP_URL,
  freshContext,
  resetData,
  setStandalone,
  signInWithGoogle,
} from "./support";

test.beforeEach(async () => {
  await resetData();
});

test("E2E-252 the Home Screen app signs in with a redirect, not a popup", async ({
  browser,
}) => {
  const context = await freshContext(browser);
  await setStandalone(context);
  const page = await context.newPage();
  await page.goto("/signup");

  let popupOpened = false;
  context.on("page", () => {
    popupOpened = true;
  });

  await page.getByRole("button", { name: "Sign up with Google" }).click();

  await expect(page.getByText("Sign-in with Google.com")).toBeVisible();
  expect(page.url().startsWith(APP_URL)).toBe(false);
  expect(popupOpened).toBe(false);
  await context.close();
});

test("E2E-254 a normal browser tab still signs in with a popup", async ({
  browser,
}) => {
  const context = await freshContext(browser);
  const page = await context.newPage();
  await page.goto("/signup");

  await signInWithGoogle(page, { onPage: "signup" });

  await expect(page).toHaveURL(/\/onboarding$/);
  await context.close();
});
