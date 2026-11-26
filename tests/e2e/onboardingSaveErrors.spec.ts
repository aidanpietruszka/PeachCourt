import { expect, test, type Page } from "@playwright/test";
import {
  clientErrors,
  deleteUserProfile,
  getUidByEmail,
  newUser,
  resetData,
  restoreFirestoreRules,
  seedOnboardingStep,
  setFirestoreRules,
  waitForDocument,
} from "./support";

const DENY_USER_WRITES = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read: if true;
    }
    match /users/{uid} {
      allow write: if false;
    }
    match /clientErrors/{doc} {
      allow write: if true;
    }
  }
}`;

const DENY_VARIANT_WRITE = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read: if true;
    }
    match /users/{uid} {
      allow create, update: if !('checkinVariant' in request.resource.data);
    }
    match /clientErrors/{doc} {
      allow write: if true;
    }
  }
}`;

test.beforeEach(async () => {
  await resetData();
});

test.afterEach(async () => {
  await restoreFirestoreRules();
});

async function fillStep1(page: Page, name: string) {
  await expect(page.getByLabel("First name")).toBeVisible();
  await page.getByLabel("First name").fill(name);
  await page.getByLabel("Last name").fill("Test");
  await page.getByRole("button", { name: "Tennis" }).click();
  await page.locator(".onboarding__skill-row").first().click();
  await expect(page.locator("ion-action-sheet")).toBeVisible();
  await page.locator("ion-action-sheet button").filter({ hasText: "3.5" }).click();
}

async function expectSaveFailed(code: string) {
  await expect
    .poll(async () => {
      const errors = await clientErrors();
      return errors.filter((e) => e.type === "save_failed" && e.code === code)
        .length;
    })
    .toBe(1);
}

async function startAtStep1(browser: Parameters<typeof newUser>[0]) {
  const user = await newUser(browser, "Ann");
  const uid = await getUidByEmail(user.email);
  await deleteUserProfile(uid);
  await user.page.goto("/onboarding");
  return { ...user, uid };
}

async function startAtStep(
  browser: Parameters<typeof newUser>[0],
  step: 2 | 3,
) {
  const user = await newUser(browser, "Ann");
  const uid = await getUidByEmail(user.email);
  await deleteUserProfile(uid);
  await seedOnboardingStep(uid, step);
  await waitForDocument(`users/${uid}`);
  await user.page.goto("/onboarding");
  return { ...user, uid };
}

test("E2E-245 step 1 stays put and shows an error when the profile save fails", async ({
  browser,
}) => {
  const { context, page } = await startAtStep1(browser);
  await fillStep1(page, "Ann");
  await setFirestoreRules(DENY_USER_WRITES);
  await page.getByRole("button", { name: "Next" }).click();
  await expect(
    page.getByText(
      "Couldn't save your profile. Check your connection and try again.",
    ),
  ).toBeVisible({ timeout: 20_000 });
  await expect(page.getByLabel("First name")).toBeVisible();
  await expectSaveFailed("onboarding_profile");
  await restoreFirestoreRules();
  await page.getByRole("button", { name: "Next" }).click();
  await expect(page.getByText("Use your location")).toBeVisible();
  await context.close();
});

test("E2E-246 step 1 stays put when the A/B group save fails, then opens step 2 with the group", async ({
  browser,
}) => {
  const { context, page, uid } = await startAtStep1(browser);
  await fillStep1(page, "Ann");
  await setFirestoreRules(DENY_VARIANT_WRITE);
  await page.getByRole("button", { name: "Next" }).click();
  await expect(
    page.getByText(
      "Couldn't save your profile. Check your connection and try again.",
    ),
  ).toBeVisible({ timeout: 20_000 });
  await expect(page.getByLabel("First name")).toBeVisible();
  await expectSaveFailed("onboarding_variant");
  await restoreFirestoreRules();
  await page.getByRole("button", { name: "Next" }).click();
  await expect(page.getByText("Use your location")).toBeVisible();

  const doc = await waitForDocument(`users/${uid}`);
  const variant = doc.checkinVariant as string;
  expect(["auto_on", "auto_off"]).toContain(variant);

  await page.getByRole("switch", { name: "Use my location" }).click();
  const autoToggle = page.getByRole("switch", { name: "Automatic check-in" });
  if (variant === "auto_on") {
    await expect(autoToggle).toBeChecked();
  } else {
    await expect(autoToggle).not.toBeChecked();
  }
  await context.close();
});

test("E2E-247 step 2 Next stays put and keeps choices when the save fails", async ({
  browser,
}) => {
  const { context, page } = await startAtStep(browser, 2);
  await expect(page.getByText("Use your location")).toBeVisible();
  await setFirestoreRules(DENY_USER_WRITES);
  await page.getByRole("button", { name: "Next" }).click();
  await expect(
    page.getByText(
      "Couldn't save your choices. Check your connection and try again.",
    ),
  ).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("Use your location")).toBeVisible();
  await expectSaveFailed("onboarding_step2");
  await restoreFirestoreRules();
  await page.getByRole("button", { name: "Next" }).click();
  await expect(page.getByText("Get game alerts")).toBeVisible();
  await context.close();
});

test("E2E-248 step 2 Skip stays put and shows an error when the save fails", async ({
  browser,
}) => {
  const { context, page } = await startAtStep(browser, 2);
  await expect(page.getByText("Use your location")).toBeVisible();
  await setFirestoreRules(DENY_USER_WRITES);
  await page.getByText("Skip for now").click();
  await expect(
    page.getByText(
      "Couldn't save your choices. Check your connection and try again.",
    ),
  ).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("Use your location")).toBeVisible();
  await expectSaveFailed("onboarding_step2_skip");
  await restoreFirestoreRules();
  await page.getByText("Skip for now").click();
  await expect(page.getByText("Get game alerts")).toBeVisible();
  await context.close();
});

test("E2E-249 step 3 stays put and shows an error when finishing fails", async ({
  browser,
}) => {
  const { context, page } = await startAtStep(browser, 3);
  await expect(page.getByText("Get game alerts")).toBeVisible();
  await setFirestoreRules(DENY_USER_WRITES);
  await page.getByRole("button", { name: /Next|Continue/ }).click();
  await expect(
    page.getByText(
      "Couldn't finish setting up. Check your connection and try again.",
    ),
  ).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("Get game alerts")).toBeVisible();
  await expectSaveFailed("onboarding_finish");
  await restoreFirestoreRules();
  await page.getByRole("button", { name: /Next|Continue/ }).click();
  await expect(page).toHaveURL(/\/courts$/);
  await context.close();
});

test("E2E-250 step 3 Skip stays put and shows an error when finishing fails", async ({
  browser,
}) => {
  test.skip(
    test.info().project.name !== "Android",
    "Step 3 Skip for now only exists off the iPhone Safari flow",
  );
  const { context, page } = await startAtStep(browser, 3);
  await expect(page.getByText("Get game alerts")).toBeVisible();
  await setFirestoreRules(DENY_USER_WRITES);
  await page.getByText("Skip for now").click();
  await expect(
    page.getByText(
      "Couldn't finish setting up. Check your connection and try again.",
    ),
  ).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("Get game alerts")).toBeVisible();
  await expectSaveFailed("onboarding_finish");
  await restoreFirestoreRules();
  await page.getByText("Skip for now").click();
  await expect(page).toHaveURL(/\/courts$/);
  await context.close();
});
