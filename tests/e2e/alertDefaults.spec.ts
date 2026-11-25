import { expect, test } from "@playwright/test";
import {
  COURTS,
  getUidByEmail,
  newUser,
  openCourt,
  postGame,
  resetData,
  waitForCollection,
  waitForDocument,
} from "./support";

const ALERT_KEYS = [
  "newGamesAlert",
  "changesGamesAlert",
  "gameRemindersAlert",
  "chatMessagesAlert",
];

test.beforeEach(async () => {
  await resetData();
});

test("E2E-234 a player who never opened Settings still gets a new_game alert for a matching game", async ({
  browser,
}) => {
  const ana = await newUser(browser, "Ana");
  const ben = await newUser(browser, "Ben");

  const anaUid = await getUidByEmail(ana.email);
  const seeded = await waitForDocument(`users/${anaUid}`);
  for (const key of ALERT_KEYS) {
    expect(seeded[key]).toBeUndefined();
  }

  await openCourt(ben.page, COURTS.alpha.name);
  await postGame(ben.page, { skill: "Any level" });

  const alerts = await waitForCollection("alerts");
  const newGameAlerts = alerts.filter(
    (a) => a.type === "new_game" && a.recipientUid === anaUid,
  );
  expect(newGameAlerts).toHaveLength(1);

  await ana.page.goto("/notifications");
  await expect(
    ana.page
      .locator(".inbox__row-title")
      .filter({ hasText: `at ${COURTS.alpha.name}` }),
  ).toBeVisible({ timeout: 15_000 });

  await ana.context.close();
  await ben.context.close();
});

test("E2E-235 opening Settings writes no alert defaults to the profile", async ({
  browser,
}) => {
  const { context, page, email } = await newUser(browser, "Ida");
  const uid = await getUidByEmail(email);

  await page.goto("/settings");
  await expect(
    page.locator("ion-toggle[aria-label='New games for my sport & skill']"),
  ).toBeVisible();
  await expect(
    page.locator("ion-toggle[aria-label='New games for my sport & skill']"),
  ).toBeChecked();
  await expect(
    page.locator("ion-toggle[aria-label='Chat messages']"),
  ).not.toBeChecked();

  const stored = await waitForDocument(`users/${uid}`);
  for (const key of ALERT_KEYS) {
    expect(stored[key]).toBeUndefined();
  }

  await context.close();
});
