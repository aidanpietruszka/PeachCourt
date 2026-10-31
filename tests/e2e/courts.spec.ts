import { expect, test } from "@playwright/test";
import {
  COURTS,
  expandDetails,
  infoRow,
  newUser,
  openCourt,
  resetData,
  visibleText,
} from "./support";

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
  await expect(list.getByText(COURTS.delta.name)).toBeVisible();
  await expect(list.getByText(COURTS.gamma.name)).toHaveCount(0);

  await page
    .locator("ion-segment-button")
    .filter({ hasText: "Pickleball" })
    .click();
  await expect(list.getByText(COURTS.gamma.name)).toBeVisible();
  await expect(list.getByText(COURTS.beta.name)).toBeVisible();
  await expect(list.getByText(COURTS.delta.name)).toBeVisible();
  await expect(list.getByText(COURTS.alpha.name)).toHaveCount(0);

  await page
    .locator("ion-segment-button")
    .filter({ hasText: "Tennis" })
    .click();
  await expect(list.getByText(COURTS.alpha.name)).toBeVisible();
  await expect(list.getByText(COURTS.gamma.name)).toHaveCount(0);
  await context.close();
});

test("E2E-07 with location the list is nearest first with distances", async ({
  browser,
}) => {
  const { context, page } = await newUser(browser, "Sam");
  await expect(page.locator("#nearby-courts-heading")).toHaveText(
    "3 tennis courts",
  );
  await expect(
    page.locator(".courts-page__list-header .courts-chip--filter"),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /▾/ })).toHaveCount(0);
  const firstRow = page.locator(".courts-page__list ion-item").first();
  await expect(firstRow).toContainText(COURTS.alpha.name);
  await expect(firstRow).toContainText(/ft|mi/);
  await expect(firstRow).toContainText("No reports");
  await expect(firstRow).not.toContainText("open game");
  const lastRow = page.locator(".courts-page__list ion-item").last();
  await expect(lastRow).toContainText(COURTS.delta.name);
  await context.close();
});

test("E2E-08 without location the list asks for location access", async ({
  browser,
}) => {
  const { context, page } = await newUser(browser, "Sam", {
    geolocation: false,
  });
  await expect(page.locator("#nearby-courts-heading")).toHaveText(
    "3 tennis courts",
  );
  await expect(page.getByRole("button", { name: /▾/ })).toHaveCount(0);
  await expect(
    visibleText(page, "Allow location access to sort courts by distance."),
  ).toBeVisible();
  await context.close();
});

test("E2E-09 court detail shows Unknown for every missing value", async ({
  browser,
}) => {
  const { context, page } = await newUser(browser, "Sam");
  await openCourt(page, COURTS.beta.name);
  await expandDetails(page);
  await expect(infoRow(page, "Tennis courts")).toContainText("2");
  await expect(infoRow(page, "Pickleball courts")).toContainText("2");
  for (const label of [
    "Hours",
    "Reservations",
    "Walk-on rules",
    "Lights",
    "Surface",
    "Pickleball lines",
  ]) {
    await expect(infoRow(page, label)).toContainText("Unknown");
  }
  await expect(visibleText(page, "No recent reports")).toBeVisible();
  await context.close();
});

test("E2E-26 court detail shows every row for a tennis court", async ({
  browser,
}) => {
  const { context, page } = await newUser(browser, "Sam");
  await openCourt(page, COURTS.alpha.name);
  await expandDetails(page);
  await expect(infoRow(page, "Tennis courts")).toContainText("4");
  await expect(infoRow(page, "Pickleball courts")).toContainText("None");
  await expect(infoRow(page, "Hours")).toContainText("Daily 7 AM–11 PM");
  await expect(infoRow(page, "Reservations")).toContainText("Unknown");
  await expect(infoRow(page, "Walk-on rules")).toContainText(
    "First come, first served",
  );
  await expect(infoRow(page, "Lights")).toContainText("Yes");
  await expect(infoRow(page, "Surface")).toContainText("Hard");
  await expect(infoRow(page, "Pickleball lines")).toContainText("No");
  await context.close();
});

test("E2E-27 court detail shows each hours group on its own line", async ({
  browser,
}) => {
  const { context, page } = await newUser(browser, "Sam");
  await page
    .locator("ion-segment-button")
    .filter({ hasText: "Pickleball" })
    .click();
  await openCourt(page, COURTS.gamma.name);
  await expandDetails(page);
  await expect(infoRow(page, "Tennis courts")).toContainText("None");
  await expect(infoRow(page, "Pickleball courts")).toContainText("6");
  const hours = infoRow(page, "Hours").locator(".court-info__lines");
  await expect(hours).toContainText("Mon–Fri 6 AM–10 PM");
  await expect(hours).toContainText("Sat–Sun 8:30 AM–8 PM");
  const lineTops = await hours.evaluate((element) => {
    const text = element.firstChild as Text;
    const content = text.textContent ?? "";
    const split = content.indexOf("\n");
    const first = document.createRange();
    first.setStart(text, 0);
    first.setEnd(text, 1);
    const second = document.createRange();
    second.setStart(text, split + 1);
    second.setEnd(text, split + 2);
    return [
      first.getBoundingClientRect().top,
      second.getBoundingClientRect().top,
    ];
  });
  expect(lineTops[1]).toBeGreaterThan(lineTops[0]);
  await expect(infoRow(page, "Reservations")).toContainText(
    "Call the front desk",
  );
  await expect(infoRow(page, "Walk-on rules")).toContainText("Paddle stacking");
  await expect(infoRow(page, "Lights")).toContainText("No");
  await expect(infoRow(page, "Surface")).toContainText("Concrete");
  await expect(infoRow(page, "Pickleball lines")).toContainText("No");
  await context.close();
});

test("E2E-28 court detail shows multiple surfaces, lines and half-hour times", async ({
  browser,
}) => {
  const { context, page } = await newUser(browser, "Sam");
  await openCourt(page, COURTS.delta.name);
  await expandDetails(page);
  await expect(infoRow(page, "Tennis courts")).toContainText("3");
  await expect(infoRow(page, "Pickleball courts")).toContainText("None");
  await expect(infoRow(page, "Pickleball lines")).toContainText("Yes");
  await expect(infoRow(page, "Surface")).toContainText("Clay, Hard");
  await expect(infoRow(page, "Hours")).toContainText("Mon–Fri 9:30 AM–9 PM");
  await expect(infoRow(page, "Walk-on rules")).toContainText(
    "Reservation required",
  );
  await expect(infoRow(page, "Reservations")).toContainText("Book online");
  await context.close();
});

test("E2E-84 court detail collapsed shows summary and Directions button", async ({
  browser,
}) => {
  const { context, page } = await newUser(browser, "Sam");
  await openCourt(page, COURTS.alpha.name);
  await expect(page.locator(".court-details__summary")).toBeVisible();
  await expect(page.locator(".court-details__summary")).toContainText(
    "4 tennis",
  );
  await expect(page.locator(".court-directions-btn")).toBeVisible();
  await expect(page.locator(".court-info")).toHaveCount(0);
  await context.close();
});

test("E2E-85 Directions action sheet shows all options and dismisses", async ({
  browser,
}) => {
  const { context, page } = await newUser(browser, "Sam");
  await openCourt(page, COURTS.alpha.name);
  await page.locator(".court-directions-btn").click();
  await expect(
    page.getByRole("button", { name: "Open in Apple Maps" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Open in Google Maps" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Copy address" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(
    page.getByRole("button", { name: "Open in Apple Maps" }),
  ).not.toBeVisible();
  await context.close();
});

test("E2E-79 search by name shows matching courts and results count", async ({
  browser,
}) => {
  const { context, page } = await newUser(browser, "Sam");
  const search = page.locator(".courts-page__search-input");
  const list = page.locator(".courts-page__list");

  await search.fill("alpha");
  await expect(page.locator("#nearby-courts-heading")).toHaveText("1 result");
  await expect(list.getByText(COURTS.alpha.name)).toBeVisible();
  await expect(list.getByText(COURTS.beta.name)).toHaveCount(0);
  await context.close();
});

test("E2E-80 search by address shows matching courts", async ({ browser }) => {
  const { context, page } = await newUser(browser, "Sam");
  const search = page.locator(".courts-page__search-input");

  await search.fill("Test Ave");
  await expect(
    page.locator(".courts-page__list").getByText(COURTS.beta.name),
  ).toBeVisible();
  await expect(
    page.locator(".courts-page__list").getByText(COURTS.alpha.name),
  ).toHaveCount(0);
  await context.close();
});

test("E2E-81 search hides the map and segment", async ({ browser }) => {
  const { context, page } = await newUser(browser, "Sam");
  const search = page.locator(".courts-page__search-input");

  await expect(page.locator(".courts-page__map")).toBeVisible();
  await expect(page.locator("ion-segment")).toBeVisible();

  await search.fill("alpha");
  await expect(page.locator(".courts-page__map")).toHaveCount(0);
  await expect(page.locator("ion-segment")).toHaveCount(0);
  await context.close();
});

test("E2E-82 Cancel clears search and restores normal view", async ({
  browser,
}) => {
  const { context, page } = await newUser(browser, "Sam");
  const search = page.locator(".courts-page__search-input");

  await search.fill("alpha");
  await expect(page.locator(".courts-page__search-cancel")).toBeVisible();
  await page.locator(".courts-page__search-cancel").click();
  await expect(search).toHaveValue("");
  await expect(page.locator(".courts-page__map")).toBeVisible();
  await expect(page.locator("#nearby-courts-heading")).toHaveText(
    /tennis court/,
  );
  await context.close();
});

test("E2E-83 sport filter applies during search", async ({ browser }) => {
  const { context, page } = await newUser(browser, "Sam");

  await page
    .locator("ion-segment-button")
    .filter({ hasText: "Pickleball" })
    .click();

  await page.locator(".courts-page__search-input").fill("beta");
  await expect(
    page.locator(".courts-page__list").getByText(COURTS.beta.name),
  ).toBeVisible();
  await expect(page.locator("#nearby-courts-heading")).toHaveText("1 result");
  await context.close();
});

test("E2E-86 inline clear button clears search and restores normal view", async ({
  browser,
}) => {
  const { context, page } = await newUser(browser, "Sam");
  const search = page.locator(".courts-page__search-input");

  await search.fill("alpha");
  const clearBtn = page.locator(".courts-page__search-clear");
  await expect(clearBtn).toBeVisible();
  await clearBtn.click();
  await expect(search).toHaveValue("");
  await expect(page.locator(".courts-page__map")).toBeVisible();
  await expect(page.locator("ion-segment")).toBeVisible();
  await expect(page.locator("#nearby-courts-heading")).toHaveText(
    /tennis court/,
  );
  await context.close();
});

test("E2E-87 search with no matches shows 0 results", async ({ browser }) => {
  const { context, page } = await newUser(browser, "Sam");
  await page.locator(".courts-page__search-input").fill("zzznomatch");
  await expect(page.locator("#nearby-courts-heading")).toHaveText("0 results");
  await expect(
    page.locator(".courts-page__list ion-item").filter({ visible: true }),
  ).toHaveCount(0);
  await context.close();
});

test("E2E-88 search with multiple matches shows plural results", async ({
  browser,
}) => {
  const { context, page } = await newUser(browser, "Sam");
  await page.locator(".courts-page__search-input").fill("Test");
  const heading = page.locator("#nearby-courts-heading");
  await expect(heading).toContainText("results");
  await expect(heading).not.toContainText("1 result");
  await context.close();
});

test("E2E-89 court detail expand toggle and re-collapse", async ({
  browser,
}) => {
  const { context, page } = await newUser(browser, "Sam");
  await openCourt(page, COURTS.alpha.name);

  const toggle = page.locator(".court-details__toggle");
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator(".court-info")).toHaveCount(0);

  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator(".court-info")).toBeVisible();

  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator(".court-info")).toHaveCount(0);
  await context.close();
});

test("E2E-90 collapsed summary for a pickleball court", async ({ browser }) => {
  const { context, page } = await newUser(browser, "Sam");
  await page
    .locator("ion-segment-button")
    .filter({ hasText: "Pickleball" })
    .click();
  await openCourt(page, COURTS.gamma.name);
  await expect(page.locator(".court-details__summary")).toContainText(
    "6 pickleball · Concrete",
  );
  await context.close();
});

test("E2E-91 collapsed summary for a mixed court without surfaces", async ({
  browser,
}) => {
  const { context, page } = await newUser(browser, "Sam");
  await openCourt(page, COURTS.beta.name);
  await expect(page.locator(".court-details__summary")).toContainText(
    "2 tennis · 2 pickleball",
  );
  await expect(page.locator(".court-details__summary")).not.toContainText(
    "Unknown",
  );
  await context.close();
});

test("E2E-29 list rows show both court counts and lights", async ({
  browser,
}) => {
  const { context, page } = await newUser(browser, "Sam");
  const row = (name: string) =>
    page
      .locator(".courts-page__list ion-item")
      .filter({ hasText: name })
      .filter({ visible: true });
  await expect(row(COURTS.alpha.name)).toContainText("4 tennis · Lights");
  await expect(row(COURTS.beta.name)).toContainText("2 tennis · 2 pickleball");
  await expect(row(COURTS.delta.name)).toContainText(
    "3 tennis · pickleball lines · Lights",
  );

  await page
    .locator("ion-segment-button")
    .filter({ hasText: "Pickleball" })
    .click();
  await expect(row(COURTS.gamma.name)).toContainText("6 pickleball");
  await expect(row(COURTS.beta.name)).toContainText("2 tennis · 2 pickleball");
  await expect(row(COURTS.delta.name)).toContainText(
    "3 tennis · pickleball lines · Lights",
  );
  await expect(row(COURTS.gamma.name)).toContainText(COURTS.gamma.address);
  await context.close();
});
