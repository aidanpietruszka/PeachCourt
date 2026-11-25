import { expect, test, type Browser, type Page } from "@playwright/test";
import {
  deleteUserProfile,
  expectLoginPageShown,
  freshContext,
  getUidByEmail,
  newUser,
  resetData,
  seedOnboardingStep,
  seedUserProfile,
  signInWithGoogle,
  waitForDocument,
} from "./support";

test.beforeEach(async () => {
  await resetData();
});

const REDIRECT_ROUTES = [
  "/courts",
  "/courts/court-alpha",
  "/profile",
  "/profile/edit",
  "/settings",
  "/activity",
  "/chats",
  "/chats/m-missing",
  "/notifications",
];

const REACHABLE_ROUTES = [
  "/courts",
  "/courts/court-alpha",
  "/profile",
  "/profile/edit",
  "/settings",
  "/activity",
  "/chats",
  "/notifications",
];

test("E2E-217 every protected route sends a signed-out visitor to login", async ({
  browser,
}) => {
  const context = await freshContext(browser);
  const page = await context.newPage();
  for (const route of REDIRECT_ROUTES) {
    await page.goto(route);
    await expectLoginPageShown(page);
  }
  await context.close();
});

test("E2E-218 every protected route sends a signed-in account with no profile to onboarding", async ({
  browser,
}) => {
  const { context, page, email } = await newUser(browser, "Noa");
  const uid = await getUidByEmail(email);
  await deleteUserProfile(uid);
  for (const route of REDIRECT_ROUTES) {
    await page.goto(route);
    await expect(page).toHaveURL(/\/onboarding$/);
  }
  await context.close();
});

test("E2E-219 an onboarded account can reach every route", async ({
  browser,
}) => {
  const { context, page } = await newUser(browser, "Dee");
  for (const route of REACHABLE_ROUTES) {
    await page.goto(route);
    await expect(page).toHaveURL(new RegExp(`${route}$`));
  }
  await context.close();
});

test("E2E-233 a completed account cannot sit on /onboarding and is sent to courts", async ({
  browser,
}) => {
  const { context, page } = await newUser(browser, "Finn");
  await page.goto("/onboarding");
  await expect(page).toHaveURL(/\/courts$/);
  await expect(page.getByText("Courts near you")).toBeVisible();
  await expect(page.getByText("Your game")).toHaveCount(0);
  await context.close();
});

test("E2E-220 reopening with no profile resumes at step 1 without the resume banner", async ({
  browser,
}) => {
  const { context, page, email } = await newUser(browser, "Ira");
  const uid = await getUidByEmail(email);
  await deleteUserProfile(uid);
  await page.goto("/courts");
  await expect(page).toHaveURL(/\/onboarding$/);
  await expect(page.getByText("Your game")).toBeVisible();
  await expect(
    page.getByText("Welcome back. Finish setting up to start using PeachCourt."),
  ).toHaveCount(0);
  await context.close();
});

test("E2E-221 reopening after step 1 resumes at step 2 with the resume banner", async ({
  browser,
}) => {
  const { context, page, email } = await newUser(browser, "Jo");
  const uid = await getUidByEmail(email);
  await deleteUserProfile(uid);
  await seedOnboardingStep(uid, 2);
  await page.goto("/courts");
  await expect(page).toHaveURL(/\/onboarding$/);
  await expect(page.getByText("Use your location")).toBeVisible();
  await expect(
    page.getByText("Welcome back. Finish setting up to start using PeachCourt."),
  ).toBeVisible();
  await context.close();
});

test("E2E-222 reopening after step 2 resumes at step 3 with the resume banner", async ({
  browser,
}) => {
  const { context, page, email } = await newUser(browser, "Kai");
  const uid = await getUidByEmail(email);
  await deleteUserProfile(uid);
  await seedOnboardingStep(uid, 3);
  await page.goto("/courts");
  await expect(page).toHaveURL(/\/onboarding$/);
  await expect(page.getByText("Get game alerts")).toBeVisible();
  await expect(
    page.getByText("Welcome back. Finish setting up to start using PeachCourt."),
  ).toBeVisible();
  await context.close();
});

async function seedProfileOnly(
  uid: string,
  extra: Record<string, unknown> = {},
) {
  await deleteUserProfile(uid);
  await seedUserProfile(uid, {
    firstName: "Sam",
    lastName: "Test",
    sports: ["tennis"],
    skillLevels: { tennis: 3.5 },
    ...extra,
  });
}

async function grantedContext(browser: Browser) {
  const context = await freshContext(browser);
  await context.addInitScript(() => {
    Object.defineProperty(navigator, "permissions", {
      value: {
        query: (desc: { name: string }) =>
          Promise.resolve({
            state: desc.name === "geolocation" ? "granted" : "prompt",
          }),
      },
      configurable: true,
    });
  });
  return context;
}

async function signUpToOnboarding(page: Page, email: string) {
  await page.goto("/signup");
  await page.getByPlaceholder("Email").fill(email);
  await page.getByPlaceholder("Password (6+ characters)").fill("secret123");
  await page.getByPlaceholder("Confirm password").fill("secret123");
  await page.getByRole("button", { name: "Sign up", exact: true }).click();
  await expect(page).toHaveURL(/\/onboarding$/);
}

async function resumeStep2DefaultsTo(
  browser: Browser,
  variant: "auto_on" | "auto_off",
  expected: boolean,
) {
  const context = await grantedContext(browser);
  const page = await context.newPage();
  const email = `resume-${variant}-${Date.now()}@test.dev`;
  await signUpToOnboarding(page, email);
  const uid = await getUidByEmail(email);
  await seedProfileOnly(uid, { checkinVariant: variant });
  await page.goto("/courts");
  await expect(page.getByText("Use your location")).toBeVisible();
  await page.locator("ion-toggle[aria-label='Use my location']").click();
  const autoToggle = page.locator("ion-toggle[aria-label='Automatic check-in']");
  await expect(autoToggle).not.toBeDisabled();
  if (expected) {
    await expect(autoToggle).toBeChecked();
  } else {
    await expect(autoToggle).not.toBeChecked();
  }
  await context.close();
}

test("E2E-223 resuming at step 2 with a saved auto_on group defaults automatic check-in on", async ({
  browser,
}) => {
  await resumeStep2DefaultsTo(browser, "auto_on", true);
});

test("E2E-224 resuming at step 2 with a saved auto_off group leaves automatic check-in off", async ({
  browser,
}) => {
  await resumeStep2DefaultsTo(browser, "auto_off", false);
});

test("E2E-225 resuming at step 2 with no group assigns one before the step", async ({
  browser,
}) => {
  const { context, page, email } = await newUser(browser, "Ned");
  const uid = await getUidByEmail(email);
  await seedProfileOnly(uid);
  await page.goto("/courts");
  await expect(page.getByText("Use your location")).toBeVisible();
  const stored = await waitForDocument(`users/${uid}`);
  expect(["auto_on", "auto_off"]).toContain(stored.checkinVariant);
  await context.close();
});

test("E2E-226 resuming at step 3 with no group leaves it unassigned", async ({
  browser,
}) => {
  const { context, page, email } = await newUser(browser, "Ola");
  const uid = await getUidByEmail(email);
  await deleteUserProfile(uid);
  await seedUserProfile(uid, {
    firstName: "Ola",
    lastName: "Test",
    sports: ["tennis"],
    skillLevels: { tennis: 3.5 },
    locationEnabled: false,
    autoCheckin: false,
  });
  await page.goto("/courts");
  await expect(page.getByText("Get game alerts")).toBeVisible();
  const stored = await waitForDocument(`users/${uid}`);
  expect(stored.checkinVariant).toBeUndefined();
  await context.close();
});

test("E2E-227 finishing does not reach courts until the save is confirmed", async ({
  browser,
}) => {
  const { context, page, email } = await newUser(browser, "Ray");
  const uid = await getUidByEmail(email);
  await deleteUserProfile(uid);
  await seedOnboardingStep(uid, 3);
  await page.goto("/courts");
  await expect(page.getByText("Get game alerts")).toBeVisible();

  const finishButton = page.getByRole("button", { name: /Next|Continue/ });
  await page.route(/127\.0\.0\.1:8080/, (route) => {
    if (route.request().method() === "POST") {
      return route.fulfill({ status: 503, contentType: "application/json", body: "{}" });
    }
    return route.continue();
  });

  await finishButton.click();
  await expect(page.locator("ion-spinner")).toBeVisible();
  await expect(page.getByText("Get game alerts")).toBeVisible();
  await expect(page).toHaveURL(/\/onboarding$/);
  await expect(
    page.getByRole("heading", { name: "Courts near you" }),
  ).toHaveCount(0);
  await context.close();
});

test("E2E-228 an account marked done without an A/B group reaches courts and stays ungrouped", async ({
  browser,
}) => {
  const { context, page, email } = await newUser(browser, "Pia");
  const uid = await getUidByEmail(email);
  await deleteUserProfile(uid);
  await seedUserProfile(uid, {
    firstName: "Pia",
    lastName: "Test",
    sports: ["tennis"],
    skillLevels: { tennis: 3.5 },
    locationEnabled: false,
    autoCheckin: false,
    onboardingDone: true,
  });
  await page.goto("/courts");
  await expect(page.getByText("Courts near you")).toBeVisible();
  const stored = await waitForDocument(`users/${uid}`);
  expect(stored.checkinVariant).toBeUndefined();
  await context.close();
});

test("E2E-230 the Welcome page sends a signed-in incomplete account to onboarding", async ({
  browser,
}) => {
  const { context, page, email } = await newUser(browser, "Wes");
  const uid = await getUidByEmail(email);
  await deleteUserProfile(uid);
  await seedOnboardingStep(uid, 2);
  await page.goto("/");
  await expect(page).toHaveURL(/\/onboarding$/);
  await expect(page.getByText("Use your location")).toBeVisible();
  await context.close();
});

test("E2E-231 the Welcome page sends a signed-in completed account to courts", async ({
  browser,
}) => {
  const { context, page } = await newUser(browser, "Wyn");
  await page.goto("/");
  await expect(page).toHaveURL(/\/courts$/);
  await expect(page.getByText("Courts near you")).toBeVisible();
  await context.close();
});

test("E2E-232 email sign-in of an incomplete account lands on onboarding, not courts", async ({
  browser,
}) => {
  const { context, page, email } = await newUser(browser, "Eli");
  const uid = await getUidByEmail(email);
  await page.getByRole("button", { name: "Log out" }).click();
  await expectLoginPageShown(page);
  await deleteUserProfile(uid);
  await seedOnboardingStep(uid, 3);
  await page.getByPlaceholder("Email").fill(email);
  await page.getByPlaceholder("Password").fill("secret123");
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page).toHaveURL(/\/onboarding$/);
  await expect(page.getByText("Get game alerts")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Courts near you" }),
  ).toHaveCount(0);
  await context.close();
});

test("E2E-229 a returning Google user with an unfinished profile is sent to onboarding", async ({
  browser,
}) => {
  const email = `google-resume-${Date.now()}@gmail.com`;
  const first = await freshContext(browser);
  const firstPage = await first.newPage();
  await firstPage.goto("/signup");
  await signInWithGoogle(firstPage, { onPage: "signup", email });
  await expect(firstPage).toHaveURL(/\/onboarding$/);
  const uid = await getUidByEmail(email);
  await seedOnboardingStep(uid, 2);
  await first.close();

  const second = await freshContext(browser);
  const secondPage = await second.newPage();
  await secondPage.goto("/login");
  await signInWithGoogle(secondPage, { onPage: "login", email });
  await expect(secondPage).toHaveURL(/\/onboarding$/);
  await expect(secondPage.getByText("Use your location")).toBeVisible();
  await second.close();
});
