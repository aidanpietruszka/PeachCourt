import { expect, test } from "@playwright/test";
import {
  APP_URL,
  deviceContextOptions,
  docExists,
  getUidByEmail,
  newUser,
  readCollection,
  resetData,
  seedAlert,
  stubMapTiles,
} from "./support";

test.beforeEach(async () => {
  await resetData();
});

test("E2E-264 deleting from Settings shows the new dialog, removes the data, and sign-in fails", async ({
  browser,
}) => {
  const { context, page, email } = await newUser(browser, "Dinah");
  const uid = await getUidByEmail(email);
  await seedAlert(uid);
  const otherUid = "survivor-uid";
  await seedAlert(otherUid);

  await page.goto("/settings");
  await page
    .getByRole("button", { name: "Delete my account and data" })
    .click();

  await expect(
    page.getByText(/chat messages, alerts and activity history/),
  ).toBeVisible();

  await page
    .locator("ion-alert")
    .getByRole("button", { name: "Delete", exact: true })
    .click();

  await expect
    .poll(async () => docExists(`users/${uid}`), { timeout: 20_000 })
    .toBe(false);

  const allAlerts = await readCollection("alerts");
  expect(allAlerts.filter((a) => a.recipientUid === uid)).toHaveLength(0);
  expect(allAlerts.filter((a) => a.recipientUid === otherUid)).toHaveLength(1);

  await context.close();

  const fresh = await browser.newContext({
    baseURL: APP_URL,
    ...deviceContextOptions(),
  });
  await stubMapTiles(fresh);
  const loginPage = await fresh.newPage();
  await loginPage.goto("/login");
  await loginPage.getByPlaceholder("Email").fill(email);
  await loginPage.getByPlaceholder("Password").fill("secret123");
  await loginPage.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(
    loginPage.getByText("Incorrect email or password."),
  ).toBeVisible();

  await fresh.close();
});
