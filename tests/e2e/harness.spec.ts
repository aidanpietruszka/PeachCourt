import { expect, test } from "@playwright/test";
import {
  advanceClock,
  COURTS,
  deleteUserProfile,
  freshContext,
  getUidByEmail,
  installClock,
  newUser,
  openCourt,
  postGame,
  resetData,
  seedProfileMissingFields,
  seedUserProfile,
  setLocationPermission,
  setNotificationPermission,
  signInWithGoogle,
  visibleText,
  waitForCollection,
  waitForDocument,
} from "./support";

test.beforeEach(async () => {
  await resetData();
});

test("H1 Google sign-in through the Auth emulator popup", async ({ page }) => {
  await page.goto("/signup");
  const email = await signInWithGoogle(page, { onPage: "signup" });
  await expect(page).toHaveURL(/\/onboarding$/);
  const uid = await getUidByEmail(email);
  expect(uid.length).toBeGreaterThan(0);
});

test("H1b returning Google user with a completed profile lands on courts", async ({
  browser,
}) => {
  const email = `google-return-${Date.now()}@gmail.com`;
  const first = await freshContext(browser);
  const firstPage = await first.newPage();
  await firstPage.goto("/signup");
  await signInWithGoogle(firstPage, { onPage: "signup", email });
  await expect(firstPage).toHaveURL(/\/onboarding$/);
  const uid = await getUidByEmail(email);
  await seedUserProfile(uid, {
    firstName: "Gigi",
    lastName: "Return",
    sports: ["tennis"],
    skillLevels: { tennis: 3.5 },
    onboardingDone: true,
  });
  await first.close();

  const second = await freshContext(browser);
  const secondPage = await second.newPage();
  await secondPage.goto("/login");
  await signInWithGoogle(secondPage, { onPage: "login", email });
  await expect(secondPage).toHaveURL(/\/courts$/);
  await second.close();
});

test("H2 missing-field profile seed does not break the app", async ({
  browser,
}) => {
  const { context, page, email } = await newUser(browser, "Pat");
  const uid = await getUidByEmail(email);
  await deleteUserProfile(uid);
  await seedProfileMissingFields(uid);
  const stored = await waitForDocument(`users/${uid}`);
  expect(stored.firstName).toBe("Pat");
  expect(stored.lastName).toBeUndefined();
  await page.reload();
  await expect(visibleText(page, "Courts near you")).toBeVisible();
  await context.close();
});

test("H3 clock helper controls page time", async ({ page }) => {
  const fixed = Date.UTC(2026, 0, 1, 12, 0, 0);
  await installClock(page, fixed);
  await page.goto("/login");
  const before = await page.evaluate(() => Date.now());
  expect(before).toBe(fixed);
  await advanceClock(page, 60 * 60 * 1000);
  const after = await page.evaluate(() => Date.now());
  expect(after - before).toBe(60 * 60 * 1000);
});

test("H4 permission helpers set location and notifications", async ({
  browser,
}) => {
  const denied = await freshContext(browser, { geolocation: false });
  await setLocationPermission(denied, "denied");
  await setNotificationPermission(denied, "denied");
  const deniedPage = await denied.newPage();
  await deniedPage.goto("/login");
  expect(
    await deniedPage.evaluate(() =>
      navigator.permissions
        .query({ name: "geolocation" as PermissionName })
        .then((r) => r.state),
    ),
  ).toBe("denied");
  expect(await deniedPage.evaluate(() => Notification.permission)).toBe(
    "denied",
  );
  await denied.close();

  const allowed = await freshContext(browser, { geolocation: false });
  await setLocationPermission(allowed, "allowed");
  await setNotificationPermission(allowed, "allowed");
  const allowedPage = await allowed.newPage();
  await allowedPage.goto("/login");
  expect(await allowedPage.evaluate(() => Notification.permission)).toBe(
    "granted",
  );
  await allowed.close();

  const notAsked = await freshContext(browser, { geolocation: false });
  await setLocationPermission(notAsked, "not_asked");
  await setNotificationPermission(notAsked, "not_asked");
  const notAskedPage = await notAsked.newPage();
  await notAskedPage.goto("/login");
  expect(
    await notAskedPage.evaluate(() =>
      navigator.permissions
        .query({ name: "geolocation" as PermissionName })
        .then((r) => r.state),
    ),
  ).toBe("prompt");
  expect(await notAskedPage.evaluate(() => Notification.permission)).toBe(
    "default",
  );
  await notAsked.close();
});

test("H5 waits for a document written by a Cloud Function", async ({
  browser,
}) => {
  const { context, page } = await newUser(browser, "Host");
  await openCourt(page, COURTS.alpha.name);
  await postGame(page, { skill: "3.5" });
  const chats = await waitForCollection("chats");
  expect(chats.length).toBeGreaterThan(0);
  await context.close();
});
