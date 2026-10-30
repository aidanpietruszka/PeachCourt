import { expect, test } from "@playwright/test";
import {
  COURTS,
  expectLoginPageShown,
  newUser,
  resetData,
  signUp,
  visibleText,
} from "./support";

test.beforeEach(async () => {
  await resetData();
});

async function fillSignUp(
  page: import("@playwright/test").Page,
  fields: { email: string; password: string; confirm: string },
) {
  await page.goto("/signup");
  await page.getByPlaceholder("Email").fill(fields.email);
  await page.getByPlaceholder("Password (6+ characters)").fill(fields.password);
  await page.getByPlaceholder("Confirm password").fill(fields.confirm);
  await page.getByRole("button", { name: "Sign up", exact: true }).click();
}

async function fillLogin(
  page: import("@playwright/test").Page,
  email: string,
  password: string,
) {
  await page.goto("/login");
  await page.getByPlaceholder("Email").fill(email);
  await page.getByPlaceholder("Password").fill(password);
  await page.getByRole("button", { name: "Log in", exact: true }).click();
}

test("E2E-32 sign up with empty fields shows an error", async ({ page }) => {
  await page.goto("/signup");
  await page.getByRole("button", { name: "Sign up", exact: true }).click();
  await expect(
    visibleText(page, "Enter an email and a password."),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/signup$/);
});

test("E2E-33 sign up rejects a short password", async ({ page }) => {
  await fillSignUp(page, {
    email: `short-${Date.now()}@test.dev`,
    password: "12345",
    confirm: "12345",
  });
  await expect(
    visibleText(page, "Password must be at least 6 characters."),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/signup$/);
});

test("E2E-34 sign up rejects mismatched passwords", async ({ page }) => {
  await fillSignUp(page, {
    email: `mismatch-${Date.now()}@test.dev`,
    password: "secret123",
    confirm: "secret124",
  });
  await expect(visibleText(page, "Passwords do not match.")).toBeVisible();
  await expect(page).toHaveURL(/\/signup$/);
});

test("E2E-35 a malformed email does not create an account", async ({
  page,
}) => {
  await fillSignUp(page, {
    email: "not-an-email",
    password: "secret123",
    confirm: "secret123",
  });
  await page.waitForTimeout(1500);
  await expect(page).toHaveURL(/\/signup$/);
});

test("E2E-36 sign up rejects an email that already has an account", async ({
  browser,
}) => {
  const { context, email } = await newUser(browser, "Sam");
  await context.close();
  const second = await browser.newContext({ baseURL: "http://127.0.0.1:5174" });
  const page = await second.newPage();
  await fillSignUp(page, {
    email,
    password: "secret123",
    confirm: "secret123",
  });
  await expect(
    visibleText(
      page,
      "An account with that email already exists. Try logging in.",
    ),
  ).toBeVisible();
  await second.close();
});

test("E2E-37 log in with empty fields shows an error", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(
    visibleText(page, "Enter your email and password."),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);
});

test("E2E-38 log in with a wrong password shows an error", async ({
  browser,
}) => {
  const { context, email } = await newUser(browser, "Sam");
  await context.close();
  const second = await browser.newContext({ baseURL: "http://127.0.0.1:5174" });
  const page = await second.newPage();
  await fillLogin(page, email, "wrong-password");
  await expect(visibleText(page, "Incorrect email or password.")).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);
  await second.close();
});

test("E2E-39 log in with an unknown email shows an error", async ({ page }) => {
  await fillLogin(page, `nobody-${Date.now()}@test.dev`, "secret123");
  await expect(visibleText(page, "Incorrect email or password.")).toBeVisible();
});

test("E2E-40 a failed log in can be corrected and retried", async ({
  browser,
}) => {
  const { context, email } = await newUser(browser, "Sam");
  await context.close();
  const second = await browser.newContext({ baseURL: "http://127.0.0.1:5174" });
  const page = await second.newPage();
  await fillLogin(page, email, "wrong-password");
  await expect(visibleText(page, "Incorrect email or password.")).toBeVisible();
  await page.getByPlaceholder("Password").fill("secret123");
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page).toHaveURL(/\/courts$/);
  await second.close();
});

test("E2E-41 signed-out deep links to a court go to login", async ({
  page,
}) => {
  await page.goto(`/courts/${COURTS.alpha.id}`);
  await expectLoginPageShown(page);
});

test("E2E-42 the login page links to sign up and back", async ({ page }) => {
  await page.goto("/login");
  await page.getByText("Create an account").click();
  await expect(page).toHaveURL(/\/signup$/);
  await expect(visibleText(page, "Create account")).toBeVisible();
});

test("E2E-43 after logging out a court link goes to login", async ({
  browser,
}) => {
  const { context, page } = await newUser(browser, "Sam");
  await page.getByRole("button", { name: "Log out" }).click();
  await expectLoginPageShown(page);
  await page.goto(`/courts/${COURTS.alpha.id}`);
  await expectLoginPageShown(page);
  await context.close();
});

test("E2E-44 a signed-in session survives a reload", async ({ page }) => {
  await signUp(page, "Sam");
  await page.reload();
  await expect(page).toHaveURL(/\/courts$/);
  await expect(visibleText(page, "Courts near you")).toBeVisible();
});
