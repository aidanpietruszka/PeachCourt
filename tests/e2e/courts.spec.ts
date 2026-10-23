import { expect, test } from "@playwright/test";
import { COURTS, newUser, openCourt, resetData, visibleText } from "./support";

test.beforeEach(async () => {
  await resetData();
});

test("E2E-06 tennis is the default and the sport filter works", async ({
  browser,
}) => {
  const { context, page } = await newUser(browser, "Sam");
  const list = page.locator(".courts-page__list");
  await expect(list.getByText(COURTS.alpha.name)).toBeVisible();
  await expect(list.getByText(COURTS.beta.name)).toBeVisible();
  await expect(list.getByText(COURTS.gamma.name)).toHaveCount(0);

  await page
    .locator("ion-segment-button")
    .filter({ hasText: "Pickleball" })
    .click();
  await expect(list.getByText(COURTS.gamma.name)).toBeVisible();
  await expect(list.getByText(COURTS.beta.name)).toBeVisible();
  await expect(list.getByText(COURTS.alpha.name)).toHaveCount(0);
  await context.close();
});

test("E2E-07 with location the list is nearest first with distances", async ({
  browser,
}) => {
  const { context, page } = await newUser(browser, "Sam");
  await expect(visibleText(page, "Nearest courts")).toBeVisible();
  const firstRow = page.locator(".courts-page__list ion-item").first();
  await expect(firstRow).toContainText(COURTS.alpha.name);
  await expect(firstRow).toContainText(/ft|mi/);
  await expect(firstRow).toContainText("No reports · 0 open games");
  await context.close();
});

test("E2E-08 without location the list says most active", async ({
  browser,
}) => {
  const { context, page } = await newUser(browser, "Sam", {
    geolocation: false,
  });
  await expect(visibleText(page, "Most active courts")).toBeVisible();
  await expect(
    visibleText(page, "Allow location access to sort courts by distance."),
  ).toBeVisible();
  await context.close();
});

test("E2E-09 court detail shows info and Unknown for missing data", async ({
  browser,
}) => {
  const { context, page } = await newUser(browser, "Sam");
  await openCourt(page, COURTS.beta.name);
  const info = page.locator(".court-info").filter({ visible: true });
  await expect(
    info.locator("ion-item").filter({ hasText: "Lights" }),
  ).toContainText("Unknown");
  await expect(
    info.locator("ion-item").filter({ hasText: "Surface" }),
  ).toContainText("Unknown");
  await expect(
    info.locator("ion-item").filter({ hasText: "Courts" }),
  ).toContainText("2");
  await expect(visibleText(page, "No recent reports")).toBeVisible();
  await context.close();
});
