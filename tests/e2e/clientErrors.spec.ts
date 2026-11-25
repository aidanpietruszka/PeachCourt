import { expect, test } from "@playwright/test";
import {
  APP_URL,
  clientErrors,
  deviceContextOptions,
  newUser,
  resetData,
  stubMapTiles,
} from "./support";

test.beforeEach(async () => {
  await resetData();
});

test("E2E-213 a forced error writes exactly one clientErrors document", async ({
  browser,
}) => {
  const { context, page } = await newUser(browser, "Erin");
  await expect(page.getByText("Courts near you")).toBeVisible();

  await page.evaluate(() => {
    window.dispatchEvent(
      new ErrorEvent("error", {
        error: new Error("forced e2e error"),
        message: "forced e2e error",
      }),
    );
  });

  await expect.poll(async () => (await clientErrors()).length).toBe(1);
  const [entry] = await clientErrors();
  expect(entry.type).toBe("unexpected");
  expect(entry.uid).not.toBeNull();
  expect(entry.message).toContain("forced e2e error");

  await context.close();
});

test("E2E-216 an unhandled promise rejection writes one unexpected document", async ({
  browser,
}) => {
  const { context, page } = await newUser(browser, "Rex");
  await expect(page.getByText("Courts near you")).toBeVisible();

  await page.evaluate(() => {
    void Promise.reject(new Error("forced e2e rejection"));
  });

  await expect.poll(async () => (await clientErrors()).length).toBe(1);
  const [entry] = await clientErrors();
  expect(entry.type).toBe("unexpected");
  expect(entry.uid).not.toBeNull();
  expect(entry.message).toContain("forced e2e rejection");

  await context.close();
});

test("E2E-214 a failed sign-in writes one sign_in_failed document while signed out", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByPlaceholder("Email").fill("nobody@test.dev");
  await page.getByPlaceholder("Password").fill("wrongpass");
  await page.getByRole("button", { name: "Log in", exact: true }).click();

  await expect(
    page.getByText("Incorrect email or password."),
  ).toBeVisible();

  await expect.poll(async () => (await clientErrors()).length).toBe(1);
  const [entry] = await clientErrors();
  expect(entry.type).toBe("sign_in_failed");
  expect(entry.uid).toBeNull();
});

test("E2E-215 a failed sign-up writes one sign_in_failed document while signed out", async ({
  browser,
}) => {
  const { context, email } = await newUser(browser, "Dup");

  const signedOut = await browser.newContext({
    baseURL: APP_URL,
    ...deviceContextOptions(),
  });
  await stubMapTiles(signedOut);
  const page = await signedOut.newPage();
  await page.goto("/signup");
  await page.getByPlaceholder("Name (optional)").fill("Dup Two");
  await page.getByPlaceholder("Email").fill(email);
  await page.getByPlaceholder("Password (6+ characters)").fill("secret123");
  await page.getByPlaceholder("Confirm password").fill("secret123");
  await page.getByRole("button", { name: "Sign up", exact: true }).click();

  await expect(
    page.getByText("An account with that email already exists. Try logging in."),
  ).toBeVisible();

  const signInFailures = async () =>
    (await clientErrors()).filter((e) => e.type === "sign_in_failed");
  await expect.poll(async () => (await signInFailures()).length).toBe(1);
  const [entry] = await signInFailures();
  expect(entry.uid).toBeNull();

  await context.close();
  await signedOut.close();
});
