import { expect, test, type Page } from "@playwright/test";
import {
  COURTS,
  backToCourts,
  checkIn,
  closeConfirmation,
  dismissFeedbackIfShown,
  newUser,
  openCourt,
  postGame,
  resetData,
  seedReport,
  visibleText,
} from "./support";

test.beforeEach(async () => {
  await resetData();
});

const names = {
  alpha: COURTS.alpha.name,
  beta: COURTS.beta.name,
  gamma: COURTS.gamma.name,
  delta: COURTS.delta.name,
};

function rowNames(page: Page) {
  return page.locator(".courts-page__list ion-item h3");
}

function heading(page: Page) {
  return page.locator("#nearby-courts-heading");
}

function filterButton(page: Page) {
  return page.locator(".courts-chip--filter");
}

function sheet(page: Page) {
  return page.getByRole("dialog", { name: "Filter courts" });
}

function sheetChip(page: Page, label: string) {
  return sheet(page).getByRole("button", { name: label, exact: true });
}

async function openSheet(page: Page) {
  await filterButton(page).click();
  await expect(sheet(page)).toBeVisible();
}

async function closeSheet(page: Page) {
  await sheet(page)
    .getByRole("button", { name: /^Show \d+ courts?$/ })
    .click();
  await expect(sheet(page)).toHaveCount(0);
}

async function applyFlag(page: Page, label: string) {
  await openSheet(page);
  await sheetChip(page, label).click();
  await closeSheet(page);
}

async function returnToCourts(page: Page) {
  await expect(page.locator("ion-router-outlet").first()).not.toHaveAttribute(
    "aria-hidden",
    "true",
  );
  await backToCourts(page);
  await expect(page.locator(".ion-page.can-go-back")).toHaveCount(0);
}

async function pickSport(page: Page, sport: "Tennis" | "Pickleball") {
  await page.locator("ion-segment-button").filter({ hasText: sport }).click();
}

test("E2E-45 Filter courts sits under the map and the filter pills are gone", async ({
  browser,
}) => {
  const { context, page } = await newUser(browser, "Sam");
  await expect(filterButton(page)).toHaveText("Filter courts");
  await expect(filterButton(page)).toHaveCount(1);
  await expect(page.locator(".courts-page__chips")).toHaveCount(0);
  for (const label of ["Players now", "Has open games", "Lights"]) {
    await expect(
      page.getByRole("button", { name: label, exact: true }),
    ).toHaveCount(0);
  }
  const mapBox = await page.locator(".courts-page__map").boundingBox();
  const buttonBox = await filterButton(page).boundingBox();
  expect(mapBox).not.toBeNull();
  expect(buttonBox).not.toBeNull();
  expect(buttonBox!.y).toBeGreaterThanOrEqual(mapBox!.y + mapBox!.height);
  await expect(
    page.locator(".courts-page__list-header").locator(".courts-chip--filter"),
  ).toBeVisible();
  await expect(heading(page)).toHaveText("3 tennis courts");
  await context.close();
});

test("E2E-46 the sport control lists Pickleball first and Tennis second", async ({
  browser,
}) => {
  const { context, page } = await newUser(browser, "Sam");
  await expect(page.locator("ion-segment-button")).toHaveText([
    "Pickleball",
    "Tennis",
  ]);
  await context.close();
});

test("E2E-47 the Lights filter hides courts without confirmed lights", async ({
  browser,
}) => {
  const { context, page } = await newUser(browser, "Sam");
  await applyFlag(page, "Lights");
  await expect(rowNames(page)).toHaveText([names.alpha, names.delta]);
  await expect(filterButton(page)).toHaveText("Filter courts · 1");
  await expect(heading(page)).toHaveText("2 of 4 courts");
  await expect(
    page.getByRole("button", { name: "Remove filter Lights" }),
  ).toHaveCount(0);
  await context.close();
});

test("E2E-48 turning a filter off in the sheet restores the list", async ({
  browser,
}) => {
  const { context, page } = await newUser(browser, "Sam");
  await applyFlag(page, "Lights");
  await expect(rowNames(page)).toHaveCount(2);
  await openSheet(page);
  await sheetChip(page, "Lights").click();
  await closeSheet(page);
  await expect(rowNames(page)).toHaveCount(3);
  await expect(filterButton(page)).toHaveText("Filter courts");
  await context.close();
});

test("E2E-49 Clear removes every filter at once", async ({ browser }) => {
  const { context, page } = await newUser(browser, "Sam");
  await openSheet(page);
  await sheetChip(page, "Lights").click();
  await sheetChip(page, "Clay").click();
  await closeSheet(page);
  await expect(filterButton(page)).toHaveText("Filter courts · 2");
  await page.getByRole("button", { name: "Clear", exact: true }).click();
  await expect(rowNames(page)).toHaveCount(3);
  await expect(filterButton(page)).toHaveText("Filter courts");
  await context.close();
});

test("E2E-50 the sheet lists every section and option", async ({ browser }) => {
  const { context, page } = await newUser(browser, "Sam");
  await openSheet(page);
  for (const text of [
    "Sort by",
    "Show only",
    "Court features",
    "Surface",
    "Distance",
    "Clear all",
  ]) {
    await expect(sheet(page).getByText(text, { exact: true })).toBeVisible();
  }
  for (const label of [
    "Nearest",
    "Most players",
    "Most open games",
    "Players there now",
    "Has open games",
    "Open now",
    "Lights",
    "Pickleball lines",
    "First come, first served",
    "Hard",
    "Asphalt",
    "Paved",
    "Concrete",
    "Clay",
    "Acrylic",
    "Any",
    "1 mi",
    "3 mi",
    "5 mi",
  ]) {
    await expect(sheetChip(page, label)).toBeVisible();
  }
  await expect(sheetChip(page, "Nearest")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(sheetChip(page, "Any")).toHaveAttribute("aria-pressed", "true");
  await context.close();
});

test("E2E-51 the sheet closes from the button and from the dimmed area", async ({
  browser,
}) => {
  const { context, page } = await newUser(browser, "Sam");
  await openSheet(page);
  await sheetChip(page, "Lights").click();
  await closeSheet(page);
  await expect(filterButton(page)).toHaveText("Filter courts · 1");
  await openSheet(page);
  await page
    .locator(".filter-sheet__dim")
    .click({ position: { x: 20, y: 20 } });
  await expect(sheet(page)).toHaveCount(0);
  await expect(filterButton(page)).toHaveText("Filter courts · 1");
  await context.close();
});

test("E2E-52 the sheet button shows the live result count", async ({
  browser,
}) => {
  const { context, page } = await newUser(browser, "Sam");
  await openSheet(page);
  await expect(
    sheet(page).getByRole("button", { name: "Show 3 courts" }),
  ).toBeVisible();
  await sheetChip(page, "Clay").click();
  await expect(
    sheet(page).getByRole("button", { name: "Show 1 court" }),
  ).toBeVisible();
  await sheetChip(page, "Acrylic").click();
  await sheetChip(page, "Clay").click();
  await expect(
    sheet(page).getByRole("button", { name: "Show 0 courts" }),
  ).toBeVisible();
  await context.close();
});

test("E2E-53 surfaces match any selected surface", async ({ browser }) => {
  const { context, page } = await newUser(browser, "Sam");
  await openSheet(page);
  await sheetChip(page, "Clay").click();
  await expect(rowNames(page)).toHaveText([names.delta]);
  await sheetChip(page, "Hard").click();
  await expect(rowNames(page)).toHaveText([names.alpha, names.delta]);
  await sheetChip(page, "Clay").click();
  await sheetChip(page, "Hard").click();
  await expect(rowNames(page)).toHaveCount(3);
  await context.close();
});

test("E2E-54 courts with unknown surfaces are hidden by a surface filter", async ({
  browser,
}) => {
  const { context, page } = await newUser(browser, "Sam");
  await openSheet(page);
  for (const surface of [
    "Hard",
    "Asphalt",
    "Paved",
    "Concrete",
    "Clay",
    "Acrylic",
  ]) {
    await sheetChip(page, surface).click();
  }
  await closeSheet(page);
  await expect(rowNames(page)).toHaveText([names.alpha, names.delta]);
  await expect(page.locator(".courts-page__list")).not.toContainText(
    names.beta,
  );
  await context.close();
});

test("E2E-55 First come, first served keeps only walk-on courts", async ({
  browser,
}) => {
  const { context, page } = await newUser(browser, "Sam");
  await openSheet(page);
  await sheetChip(page, "First come, first served").click();
  await expect(rowNames(page)).toHaveText([names.alpha]);
  await context.close();
});

test("E2E-56 Pickleball lines keeps only courts with lines", async ({
  browser,
}) => {
  const { context, page } = await newUser(browser, "Sam");
  await openSheet(page);
  await sheetChip(page, "Pickleball lines").click();
  await expect(rowNames(page)).toHaveText([names.delta]);
  await context.close();
});

test("E2E-57 distance limits courts and needs location", async ({
  browser,
}) => {
  const { context, page } = await newUser(browser, "Sam");
  await openSheet(page);
  await sheetChip(page, "1 mi").click();
  await expect(rowNames(page)).toHaveText([names.alpha]);
  await sheetChip(page, "3 mi").click();
  await expect(rowNames(page)).toHaveText([names.alpha]);
  await sheetChip(page, "5 mi").click();
  await expect(rowNames(page)).toHaveText([names.alpha, names.beta]);
  await sheetChip(page, "Any").click();
  await expect(rowNames(page)).toHaveCount(3);
  await closeSheet(page);
  await context.close();
});

test("E2E-58 without location the distance options are disabled and Nearest is hidden", async ({
  browser,
}) => {
  const { context, page } = await newUser(browser, "Sam", {
    geolocation: false,
  });
  await openSheet(page);
  for (const label of ["1 mi", "3 mi", "5 mi"]) {
    await expect(sheetChip(page, label)).toBeDisabled();
  }
  await expect(sheetChip(page, "Nearest")).toHaveCount(0);
  await expect(
    sheet(page).getByText("Allow location access to filter by distance."),
  ).toBeVisible();
  await context.close();
});

test("E2E-59 Open now uses Atlanta time and hides unknown hours", async ({
  browser,
}) => {
  const { context, page } = await newUser(browser, "Sam");
  await page.clock.setFixedTime(new Date("2026-10-28T16:00:00Z"));
  await page.reload();
  await openSheet(page);
  await sheetChip(page, "Open now").click();
  await expect(rowNames(page)).toHaveText([names.alpha, names.delta]);
  await context.close();
});

test("E2E-60 Open now respects the weekend hours", async ({ browser }) => {
  const { context, page } = await newUser(browser, "Sam");
  await page.clock.setFixedTime(new Date("2026-10-31T12:00:00Z"));
  await page.reload();
  await openSheet(page);
  await sheetChip(page, "Open now").click();
  await expect(rowNames(page)).toHaveText([names.alpha]);
  await context.close();
});

test("E2E-61 Open now shows the empty state outside every court's hours", async ({
  browser,
}) => {
  const { context, page } = await newUser(browser, "Sam");
  await page.clock.setFixedTime(new Date("2026-10-28T07:00:00Z"));
  await page.reload();
  await openSheet(page);
  await sheetChip(page, "Open now").click();
  await closeSheet(page);
  await expect(visibleText(page, "No courts match")).toBeVisible();
  await expect(heading(page)).toHaveText("0 of 4 courts");
  await context.close();
});

test("E2E-62 Players now keeps courts with a report", async ({ browser }) => {
  await seedReport(COURTS.beta.id, 5);
  const { context, page } = await newUser(browser, "Sam");
  await applyFlag(page, "Players there now");
  await expect(rowNames(page)).toHaveText([names.beta]);
  await expect(page.locator(".courts-page__list")).toContainText("5–8 players");
  await context.close();
});

test("E2E-63 Players now keeps a court once someone checks in", async ({
  browser,
}) => {
  const { context, page } = await newUser(browser, "Ana");
  await openCourt(page, names.alpha);
  await checkIn(page, 2);
  await closeConfirmation(page);
  await expect(page.locator("ion-modal.show-modal")).toHaveCount(0);
  await dismissFeedbackIfShown(page);
  await returnToCourts(page);
  await applyFlag(page, "Players there now");
  await expect(rowNames(page)).toHaveText([names.alpha]);
  await context.close();
});

test("E2E-64 Has open games keeps courts with a posted game", async ({
  browser,
}) => {
  const { context, page } = await newUser(browser, "Ana");
  await openCourt(page, names.alpha);
  await postGame(page, { skill: "4.0" });
  await backToCourts(page);
  await page.reload();
  await applyFlag(page, "Has open games");
  await expect(rowNames(page)).toHaveText([names.alpha]);
  await expect(page.locator(".courts-page__list")).toContainText("1 open game");
  await context.close();
});

test("E2E-65 Most players sorts by head count", async ({ browser }) => {
  await seedReport(COURTS.beta.id, 8);
  await seedReport(COURTS.alpha.id, 2);
  const { context, page } = await newUser(browser, "Sam");
  await openSheet(page);
  await sheetChip(page, "Most players").click();
  await closeSheet(page);
  await expect(rowNames(page)).toHaveText([
    names.beta,
    names.alpha,
    names.delta,
  ]);
  await expect(page.getByRole("button", { name: /▾/ })).toHaveCount(0);
  await context.close();
});

test("E2E-66 the sheet sort changes the order and can be changed back", async ({
  browser,
}) => {
  await seedReport(COURTS.beta.id, 8);
  const { context, page } = await newUser(browser, "Sam");
  await expect(rowNames(page).first()).toHaveText(names.alpha);
  await openSheet(page);
  await sheetChip(page, "Most players").click();
  await closeSheet(page);
  await expect(rowNames(page).first()).toHaveText(names.beta);
  await openSheet(page);
  await sheetChip(page, "Nearest").click();
  await closeSheet(page);
  await expect(rowNames(page).first()).toHaveText(names.alpha);
  await context.close();
});

test("E2E-67 closing the sheet without changing sort keeps the order and no sort menu exists", async ({
  browser,
}) => {
  await seedReport(COURTS.beta.id, 8);
  const { context, page } = await newUser(browser, "Sam");
  await openSheet(page);
  await closeSheet(page);
  await expect(rowNames(page).first()).toHaveText(names.alpha);
  await expect(page.locator("ion-action-sheet")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /▾/ })).toHaveCount(0);
  await expect(filterButton(page)).toHaveText("Filter courts");
  await context.close();
});

test("E2E-68 without location the list is ordered by activity and Nearest is not offered", async ({
  browser,
}) => {
  await seedReport(COURTS.beta.id, 8);
  const { context, page } = await newUser(browser, "Sam", {
    geolocation: false,
  });
  await expect(rowNames(page).first()).toHaveText(names.beta);
  await openSheet(page);
  await expect(sheetChip(page, "Most players")).toBeVisible();
  await expect(sheetChip(page, "Nearest")).toHaveCount(0);
  await closeSheet(page);
  await expect(page.locator("ion-action-sheet")).toHaveCount(0);
  await context.close();
});

test("E2E-69 filters combine and an impossible mix shows the empty state", async ({
  browser,
}) => {
  const { context, page } = await newUser(browser, "Sam");
  await openSheet(page);
  await sheetChip(page, "Lights").click();
  await sheetChip(page, "Hard").click();
  await expect(rowNames(page)).toHaveText([names.alpha, names.delta]);
  await sheetChip(page, "Clay").click();
  await sheetChip(page, "Hard").click();
  await expect(rowNames(page)).toHaveText([names.delta]);
  await sheetChip(page, "Pickleball lines").click();
  await sheetChip(page, "First come, first served").click();
  await closeSheet(page);
  await expect(visibleText(page, "No courts match")).toBeVisible();
  await context.close();
});

test("E2E-70 Clear filters in the empty state restores every court", async ({
  browser,
}) => {
  const { context, page } = await newUser(browser, "Sam");
  await openSheet(page);
  await sheetChip(page, "Acrylic").click();
  await closeSheet(page);
  await expect(visibleText(page, "No courts match")).toBeVisible();
  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(rowNames(page)).toHaveCount(3);
  await expect(visibleText(page, "No courts match")).toHaveCount(0);
  await context.close();
});

test("E2E-71 Clear all in the sheet resets filters but keeps the sort", async ({
  browser,
}) => {
  const { context, page } = await newUser(browser, "Sam");
  await openSheet(page);
  await sheetChip(page, "Most players").click();
  await sheetChip(page, "Lights").click();
  await sheetChip(page, "Clay").click();
  await sheet(page).getByRole("button", { name: "Clear all" }).click();
  await expect(sheetChip(page, "Lights")).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await expect(sheetChip(page, "Clay")).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await expect(sheetChip(page, "Most players")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await context.close();
});

test("E2E-72 filters apply to the other sport tab", async ({ browser }) => {
  const { context, page } = await newUser(browser, "Sam");
  await applyFlag(page, "Lights");
  await expect(rowNames(page)).toHaveText([names.alpha, names.delta]);
  await pickSport(page, "Pickleball");
  await expect(rowNames(page)).toHaveText([names.delta]);
  await expect(heading(page)).toHaveText("1 of 4 courts");
  await expect(filterButton(page)).toHaveText("Filter courts · 1");
  await pickSport(page, "Tennis");
  await expect(rowNames(page)).toHaveText([names.alpha, names.delta]);
  await context.close();
});

test("E2E-73 the map shows only matching courts", async ({ browser }) => {
  const { context, page } = await newUser(browser, "Sam");
  await expect(page.locator(".court-pin")).toHaveCount(3);
  await applyFlag(page, "Lights");
  await expect(page.locator(".court-pin")).toHaveCount(2);
  await page.getByRole("button", { name: "Clear", exact: true }).click();
  await expect(page.locator(".court-pin")).toHaveCount(3);
  await context.close();
});

test("E2E-74 filters are remembered after a reload", async ({ browser }) => {
  const { context, page } = await newUser(browser, "Sam");
  await openSheet(page);
  await sheetChip(page, "Lights").click();
  await sheetChip(page, "Clay").click();
  await sheetChip(page, "3 mi").click();
  await sheetChip(page, "Most players").click();
  await closeSheet(page);
  await page.reload();
  await expect(filterButton(page)).toHaveText("Filter courts · 3");
  await openSheet(page);
  await expect(sheetChip(page, "Lights")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(sheetChip(page, "Clay")).toHaveAttribute("aria-pressed", "true");
  await expect(sheetChip(page, "3 mi")).toHaveAttribute("aria-pressed", "true");
  await expect(sheetChip(page, "Most players")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await context.close();
});

test("E2E-75 saved filters that are corrupt fall back to defaults", async ({
  browser,
}) => {
  const { context, page } = await newUser(browser, "Sam");
  await page.evaluate(() =>
    window.localStorage.setItem("peachcourt-court-filters", "{not json"),
  );
  await page.reload();
  await expect(filterButton(page)).toHaveText("Filter courts");
  await expect(rowNames(page)).toHaveCount(3);
  await context.close();
});

test("E2E-76 saved filters with unknown values are cleaned", async ({
  browser,
}) => {
  const { context, page } = await newUser(browser, "Sam");
  await page.evaluate(() =>
    window.localStorage.setItem(
      "peachcourt-court-filters",
      JSON.stringify({
        sort: "bogus",
        lights: "yes",
        surfaces: ["Grass"],
        distanceMiles: 99,
      }),
    ),
  );
  await page.reload();
  await expect(filterButton(page)).toHaveText("Filter courts");
  await expect(rowNames(page)).toHaveCount(3);
  await context.close();
});

test("E2E-77 turning one filter off in the sheet keeps the others", async ({
  browser,
}) => {
  const { context, page } = await newUser(browser, "Sam");
  await openSheet(page);
  await sheetChip(page, "Lights").click();
  await sheetChip(page, "Clay").click();
  await closeSheet(page);
  await expect(filterButton(page)).toHaveText("Filter courts · 2");
  await openSheet(page);
  await sheetChip(page, "Lights").click();
  await closeSheet(page);
  await expect(filterButton(page)).toHaveText("Filter courts · 1");
  await expect(rowNames(page)).toHaveText([names.delta]);
  await context.close();
});

test("E2E-78 a filtered court still opens its detail page", async ({
  browser,
}) => {
  const { context, page } = await newUser(browser, "Sam");
  await applyFlag(page, "Lights");
  await openCourt(page, names.delta);
  await expect(visibleText(page, names.delta)).toBeVisible();
  await returnToCourts(page);
  await expect(filterButton(page)).toHaveText("Filter courts · 1");
  await expect(rowNames(page)).toHaveText([names.alpha, names.delta]);
  await context.close();
});
