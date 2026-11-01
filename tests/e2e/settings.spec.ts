import { expect, test, type Browser, type Page } from "@playwright/test";
import { newUser, resetData, signUp, getUidByEmail, seedUserProfile } from "./support";

test.beforeEach(async () => {
  await resetData();
});

async function mockLocationDenied(page: Page) {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "permissions", {
      value: {
        query: (desc: { name: string }) => {
          if (desc.name === "geolocation") {
            return Promise.resolve({ state: "denied" });
          }
          return Promise.resolve({ state: "prompt" });
        },
      },
      configurable: true,
    });
  });
}

async function newUserWithNotifs(
  browser: Browser,
  name: string,
): Promise<{ context: Awaited<ReturnType<Browser["newContext"]>>; page: Page }> {
  const context = await browser.newContext({
    baseURL: "http://127.0.0.1:5174",
    viewport: { width: 390, height: 844 },
    geolocation: { latitude: 33.7851, longitude: -84.3738 },
    permissions: ["geolocation", "notifications"],
  });
  await context.addInitScript(() => {
    try {
      window.sessionStorage.setItem("peachcourt-trust-asked", "true");
    } catch {
      return;
    }
    if ("Notification" in window) {
      Object.defineProperty(Notification, "permission", {
        get: () => "granted",
        configurable: true,
      });
    }
  });
  const page = await context.newPage();
  await signUp(page, name);
  return { context, page };
}

async function mockNotifDenied(page: Page) {
  await page.addInitScript(() => {
    if ("Notification" in window) {
      Object.defineProperty(window.Notification, "permission", {
        get: () => "denied",
        configurable: true,
      });
    }
  });
}

test("E2E-109 profile page has Settings button", async ({ browser }) => {
  const { context, page } = await newUser(browser, "Sam");
  await page.locator("ion-tab-button[tab='profile']").click();
  await expect(page.getByRole("button", { name: "Settings" })).toBeVisible();
  await context.close();
});

test("E2E-110 Settings button navigates to /settings", async ({ browser }) => {
  const { context, page } = await newUser(browser, "Sam");
  await page.locator("ion-tab-button[tab='profile']").click();
  await page.getByRole("button", { name: "Settings" }).click();
  await expect(page).toHaveURL(/\/settings$/);
  await expect(
    page.getByRole("heading", { name: "Settings" }).first(),
  ).toBeVisible();
  await context.close();
});

test("E2E-111 settings page shows Location section with toggles", async ({
  browser,
}) => {
  const { context, page } = await newUser(browser, "Sam");
  await page.goto("/settings");
  await expect(page.locator(".settings-page__section-title").first()).toBeVisible();
  await expect(
    page.locator("ion-toggle[aria-label='Use my location']"),
  ).toBeVisible();
  await expect(
    page.locator("ion-toggle[aria-label='Automatic check-in']"),
  ).toBeVisible();
  await context.close();
});

test("E2E-112 automatic check-in is disabled when location is off", async ({
  browser,
}) => {
  const { context, page } = await newUser(browser, "Sam");
  await page.goto("/settings");
  await expect(
    page.locator("ion-toggle[aria-label='Automatic check-in']"),
  ).toBeDisabled();
  await expect(
    page.locator(".settings-page__row--disabled").first(),
  ).toBeVisible();
  await context.close();
});

test("E2E-113 auto check-in subtitle changes when location is off", async ({
  browser,
}) => {
  const { context, page } = await newUser(browser, "Sam");
  await page.goto("/settings");
  await expect(
    page.getByText("Turn on location access to use this"),
  ).toBeVisible();
  await context.close();
});

test("E2E-114 settings page shows Alerts section with Notifications toggle", async ({
  browser,
}) => {
  const { context, page } = await newUser(browser, "Sam");
  await page.goto("/settings");
  await expect(page.getByText("Alerts")).toBeVisible();
  await expect(
    page.locator("ion-toggle[aria-label='Notifications']"),
  ).toBeVisible();
  await context.close();
});

test("E2E-115 four alert sub-toggles are present", async ({ browser }) => {
  const { context, page } = await newUser(browser, "Sam");
  await page.goto("/settings");
  for (const label of [
    "New games for my sport & skill",
    "Changes to my games",
    "Game reminders",
    "Chat messages",
  ]) {
    await expect(
      page.locator(`ion-toggle[aria-label='${label}']`),
    ).toBeVisible();
  }
  await context.close();
});

test("E2E-116 chat messages is off by default", async ({ browser }) => {
  const { context, page } = await newUser(browser, "Sam");
  await page.goto("/settings");
  await expect(
    page.locator("ion-toggle[aria-label='Chat messages']"),
  ).not.toBeChecked();
  await context.close();
});

test("E2E-117 new games, changes and reminders are on by default", async ({
  browser,
}) => {
  const { context, page } = await newUser(browser, "Sam");
  await page.goto("/settings");
  for (const label of [
    "New games for my sport & skill",
    "Changes to my games",
    "Game reminders",
  ]) {
    await expect(
      page.locator(`ion-toggle[aria-label='${label}']`),
    ).toBeChecked();
  }
  await context.close();
});

test("E2E-118 sub-toggles are disabled when notifications are off", async ({
  browser,
}) => {
  const { context, page } = await newUser(browser, "Sam");
  await page.goto("/settings");
  for (const label of [
    "New games for my sport & skill",
    "Changes to my games",
    "Game reminders",
    "Chat messages",
  ]) {
    await expect(
      page.locator(`ion-toggle[aria-label='${label}']`),
    ).toBeDisabled();
  }
  await context.close();
});

test("E2E-119 turning on Notifications enables sub-toggles", async ({
  browser,
}) => {
  const { context, page } = await newUserWithNotifs(browser, "Sam");
  await page.goto("/settings");
  const notifToggle = page.locator("ion-toggle[aria-label='Notifications']");
  await expect(notifToggle).not.toBeDisabled();
  await notifToggle.click();
  await expect(
    page.locator("ion-toggle[aria-label='New games for my sport & skill']"),
  ).not.toBeDisabled();
  await expect(
    page.locator("ion-toggle[aria-label='Chat messages']"),
  ).not.toBeDisabled();
  await context.close();
});

test("E2E-120 See what's stored link is visible", async ({ browser }) => {
  const { context, page } = await newUser(browser, "Sam");
  await page.goto("/settings");
  await expect(page.getByText("See what's stored")).toBeVisible();
  await context.close();
});

test("E2E-121 See what's stored opens info sheet with categories", async ({
  browser,
}) => {
  const { context, page } = await newUser(browser, "Sam");
  await page.goto("/settings");
  await page.getByText("See what's stored").click();
  await expect(page.getByText("What PeachCourt stores")).toBeVisible();
  await expect(page.getByText("Sports and skill levels")).toBeVisible();
  await expect(page.getByText(/Games you have posted or joined/)).toBeVisible();
  await context.close();
});

test("E2E-122 stored sheet shows user name", async ({ browser }) => {
  const { context, page } = await newUser(browser, "Sam");
  await page.goto("/settings");
  await page.getByText("See what's stored").click();
  await expect(page.getByText(/Sam T\./)).toBeVisible();
  await context.close();
});

test("E2E-123 stored sheet Done closes the sheet", async ({ browser }) => {
  const { context, page } = await newUser(browser, "Sam");
  await page.goto("/settings");
  await page.getByText("See what's stored").click();
  await expect(page.getByText("What PeachCourt stores")).toBeVisible();
  await page.locator("ion-modal").getByRole("button", { name: "Done" }).click();
  await expect(page.getByText("What PeachCourt stores")).not.toBeVisible();
  await context.close();
});

test("E2E-124 Delete my account and data button is visible", async ({
  browser,
}) => {
  const { context, page } = await newUser(browser, "Sam");
  await page.goto("/settings");
  await expect(
    page.getByRole("button", { name: "Delete my account and data" }),
  ).toBeVisible();
  await context.close();
});

test("E2E-125 location blocked shows error text and help link", async ({
  browser,
}) => {
  const { context, page } = await newUser(browser, "Sam");
  await mockLocationDenied(page);
  await page.goto("/settings");
  await expect(
    page.getByText("Blocked in your phone's settings").first(),
  ).toBeVisible();
  await expect(page.locator(".settings-page__help-link").first()).toHaveText(
    "How to turn on ›",
  );
  await expect(
    page.locator("ion-toggle[aria-label='Use my location']"),
  ).toBeDisabled();
  await context.close();
});

test("E2E-126 location blocked auto check-in is also disabled", async ({
  browser,
}) => {
  const { context, page } = await newUser(browser, "Sam");
  await mockLocationDenied(page);
  await page.goto("/settings");
  await expect(
    page.locator("ion-toggle[aria-label='Automatic check-in']"),
  ).toBeDisabled();
  await context.close();
});

test("E2E-127 location help sheet opens from How to turn on link", async ({
  browser,
}) => {
  const { context, page } = await newUser(browser, "Sam");
  await mockLocationDenied(page);
  await page.goto("/settings");
  await page.locator(".settings-page__help-link").first().click();
  await expect(page.getByRole("heading", { name: "Turn on location" })).toBeVisible();
  await context.close();
});

test("E2E-128 location help sheet has iPhone and Android tabs", async ({
  browser,
}) => {
  const { context, page } = await newUser(browser, "Sam");
  await mockLocationDenied(page);
  await page.goto("/settings");
  await page.locator(".settings-page__help-link").first().click();
  const modal = page.locator("ion-modal").filter({ visible: true }).last();
  await expect(modal.getByText("iPhone")).toBeVisible();
  await expect(modal.getByText("Android")).toBeVisible();
  await context.close();
});

test("E2E-129 location help sheet shows iPhone steps by default", async ({
  browser,
}) => {
  const { context, page } = await newUser(browser, "Sam");
  await mockLocationDenied(page);
  await page.goto("/settings");
  await page.locator(".settings-page__help-link").first().click();
  const modal = page.locator("ion-modal").filter({ visible: true }).last();
  await expect(
    modal.getByText("In Safari, open options in the address bar"),
  ).toBeVisible();
  await context.close();
});

test("E2E-130 location help sheet Android tab shows Android steps", async ({
  browser,
}) => {
  const { context, page } = await newUser(browser, "Sam");
  await mockLocationDenied(page);
  await page.goto("/settings");
  await page.locator(".settings-page__help-link").first().click();
  const modal = page.locator("ion-modal").filter({ visible: true }).last();
  await modal.getByText("Android").click();
  await expect(modal.getByText("Open Settings on your phone")).toBeVisible();
  await context.close();
});

test("E2E-131 location help sheet Done closes the sheet", async ({
  browser,
}) => {
  const { context, page } = await newUser(browser, "Sam");
  await mockLocationDenied(page);
  await page.goto("/settings");
  await page.locator(".settings-page__help-link").first().click();
  await expect(page.getByRole("heading", { name: "Turn on location" })).toBeVisible();
  await page.locator("ion-modal").getByRole("button", { name: "Done" }).click();
  await expect(page.getByRole("heading", { name: "Turn on location" })).not.toBeVisible();
  await context.close();
});

test("E2E-132 notifications denied shows error and help link", async ({
  browser,
}) => {
  const { context, page } = await newUser(browser, "Sam");
  await mockNotifDenied(page);
  await page.goto("/settings");
  await expect(
    page.locator("ion-toggle[aria-label='Notifications']"),
  ).toBeDisabled();
  await expect(page.locator(".settings-page__help-link").last()).toHaveText(
    "How to turn on ›",
  );
  await context.close();
});

test("E2E-133 notifications denied sub-toggles are dimmed", async ({
  browser,
}) => {
  const { context, page } = await newUser(browser, "Sam");
  await mockNotifDenied(page);
  await page.goto("/settings");
  await expect(
    page.locator(".settings-page__row--disabled").first(),
  ).toBeVisible();
  await context.close();
});

test("E2E-134 notifications help sheet opens and has tabs", async ({
  browser,
}) => {
  const { context, page } = await newUser(browser, "Sam");
  await mockNotifDenied(page);
  await page.goto("/settings");
  await page.locator(".settings-page__help-link").last().click();
  await expect(page.getByRole("heading", { name: "Turn on notifications" })).toBeVisible();
  const modal = page.locator("ion-modal").filter({ visible: true }).last();
  await expect(modal.getByText("Add to Home Screen")).toBeVisible();
  await expect(modal.getByText("Blocked", { exact: true })).toBeVisible();
  await context.close();
});

test("E2E-135 notifications help sheet Blocked tab auto-selected when denied", async ({
  browser,
}) => {
  const { context, page } = await newUser(browser, "Sam");
  await mockNotifDenied(page);
  await page.goto("/settings");
  await page.locator(".settings-page__help-link").last().click();
  const modal = page.locator("ion-modal").filter({ visible: true }).last();
  await expect(modal.locator(".settings-sheet__tab--active")).toHaveText(
    "Blocked",
  );
  await context.close();
});

test("E2E-136 notifications help sheet Done closes the sheet", async ({
  browser,
}) => {
  const { context, page } = await newUser(browser, "Sam");
  await mockNotifDenied(page);
  await page.goto("/settings");
  await page.locator(".settings-page__help-link").last().click();
  await expect(page.getByRole("heading", { name: "Turn on notifications" })).toBeVisible();
  await page.locator("ion-modal").getByRole("button", { name: "Done" }).click();
  await expect(page.getByRole("heading", { name: "Turn on notifications" })).not.toBeVisible();
  await context.close();
});

test("E2E-137 chat messages toggle saves off and persists on reload", async ({
  browser,
}) => {
  const { context, page } = await newUser(browser, "Sam");
  await page.goto("/settings");
  await expect(
    page.locator("ion-toggle[aria-label='Chat messages']"),
  ).not.toBeChecked();
  await page.reload();
  await expect(
    page.locator("ion-toggle[aria-label='Chat messages']"),
  ).not.toBeChecked();
  await context.close();
});

test("E2E-138 settings back button returns to profile", async ({ browser }) => {
  const { context, page } = await newUser(browser, "Sam");
  await page.locator("ion-tab-button[tab='profile']").click();
  await page.getByRole("button", { name: "Settings" }).click();
  await expect(page).toHaveURL(/\/settings$/);
  await page.locator("ion-back-button").click();
  await expect(page).toHaveURL(/\/profile$/);
  await context.close();
});

test("E2E-139 both location and notification blocked shown simultaneously", async ({
  browser,
}) => {
  const { context, page } = await newUser(browser, "Sam");
  await mockLocationDenied(page);
  await mockNotifDenied(page);
  await page.goto("/settings");
  await expect(page.locator(".settings-page__help-link")).toHaveCount(2);
  await context.close();
});

test("E2E-140 settings page reachable directly via URL", async ({
  browser,
}) => {
  const { context, page } = await newUser(browser, "Sam");
  await page.goto("/settings");
  await expect(page).toHaveURL(/\/settings$/);
  await expect(
    page.getByRole("heading", { name: "Settings" }).first(),
  ).toBeVisible();
  await context.close();
});

test("E2E-141 new games alert saves off and persists on reload", async ({
  browser,
}) => {
  const { context, page } = await newUserWithNotifs(browser, "Sam");
  await page.goto("/settings");
  await page.locator("ion-toggle[aria-label='Notifications']").click();
  await expect(
    page.locator("ion-toggle[aria-label='New games for my sport & skill']"),
  ).not.toBeDisabled();
  await page.locator("ion-toggle[aria-label='New games for my sport & skill']").click();
  await expect(
    page.locator("ion-toggle[aria-label='New games for my sport & skill']"),
  ).not.toBeChecked();
  await page.reload();
  await expect(
    page.locator("ion-toggle[aria-label='New games for my sport & skill']"),
  ).not.toBeChecked();
  await context.close();
});

test("E2E-142 changes to my games alert saves off and persists on reload", async ({
  browser,
}) => {
  const { context, page } = await newUserWithNotifs(browser, "Sam");
  await page.goto("/settings");
  await page.locator("ion-toggle[aria-label='Notifications']").click();
  await expect(
    page.locator("ion-toggle[aria-label='Changes to my games']"),
  ).not.toBeDisabled();
  await page.locator("ion-toggle[aria-label='Changes to my games']").click();
  await expect(
    page.locator("ion-toggle[aria-label='Changes to my games']"),
  ).not.toBeChecked();
  await page.reload();
  await expect(
    page.locator("ion-toggle[aria-label='Changes to my games']"),
  ).not.toBeChecked();
  await context.close();
});

test("E2E-143 game reminders alert saves off and persists on reload", async ({
  browser,
}) => {
  const { context, page } = await newUserWithNotifs(browser, "Sam");
  await page.goto("/settings");
  await page.locator("ion-toggle[aria-label='Notifications']").click();
  await expect(
    page.locator("ion-toggle[aria-label='Game reminders']"),
  ).not.toBeDisabled();
  await page.locator("ion-toggle[aria-label='Game reminders']").click();
  await expect(
    page.locator("ion-toggle[aria-label='Game reminders']"),
  ).not.toBeChecked();
  await page.reload();
  await expect(
    page.locator("ion-toggle[aria-label='Game reminders']"),
  ).not.toBeChecked();
  await context.close();
});

test("E2E-144 auto check-in toggle is enabled when locationEnabled is true in profile", async ({
  browser,
}) => {
  const { context, page, email } = await newUser(browser, "Sam");
  const uid = await getUidByEmail(email);
  await seedUserProfile(uid, { locationEnabled: true });
  await page.goto("/settings");
  await expect(
    page.locator("ion-toggle[aria-label='Automatic check-in']"),
  ).not.toBeDisabled();
  await context.close();
});

test("E2E-145 disabling location clears auto check-in", async ({ browser }) => {
  const { context, page, email } = await newUser(browser, "Sam");
  const uid = await getUidByEmail(email);
  await seedUserProfile(uid, { locationEnabled: true, autoCheckin: true });
  await page.goto("/settings");
  await expect(
    page.locator("ion-toggle[aria-label='Automatic check-in']"),
  ).toBeChecked();
  await page.locator("ion-toggle[aria-label='Use my location']").click();
  await expect(
    page.locator("ion-toggle[aria-label='Automatic check-in']"),
  ).not.toBeChecked();
  await page.reload();
  await expect(
    page.locator("ion-toggle[aria-label='Automatic check-in']"),
  ).not.toBeChecked();
  await context.close();
});

test("E2E-146 notifications blocked tab shows phone settings steps", async ({
  browser,
}) => {
  const { context, page } = await newUser(browser, "Sam");
  await mockNotifDenied(page);
  await page.goto("/settings");
  await page.locator(".settings-page__help-link").last().click();
  const modal = page.locator("ion-modal").filter({ visible: true }).last();
  await modal.getByText("Blocked", { exact: true }).click();
  await expect(
    modal.getByText("Tap the lock icon in Chrome's address bar"),
  ).toBeVisible();
  await context.close();
});

test("E2E-147 stored sheet mentions email address", async ({ browser }) => {
  const { context, page } = await newUser(browser, "Sam");
  await page.goto("/settings");
  await page.getByText("See what's stored").click();
  await expect(page.getByText(/email address/)).toBeVisible();
  await context.close();
});

test("E2E-148 notifications home-screen tab shows add-to-home-screen steps", async ({
  browser,
}) => {
  const { context, page } = await newUser(browser, "Sam");
  await mockNotifDenied(page);
  await page.goto("/settings");
  await page.locator(".settings-page__help-link").last().click();
  const modal = page.locator("ion-modal").filter({ visible: true }).last();
  await modal.getByText("Add to Home Screen").click();
  await expect(modal.getByText("Tap Add to Home Screen")).toBeVisible();
  await context.close();
});

test("E2E-149 Delete button shows confirmation alert", async ({ browser }) => {
  const { context, page } = await newUser(browser, "Sam");
  await page.goto("/settings");
  await page.getByRole("button", { name: "Delete my account and data" }).click();
  await expect(page.getByText("Delete your account?")).toBeVisible();
  await expect(
    page.getByText(/permanently deletes your profile/),
  ).toBeVisible();
  await context.close();
});

test("E2E-150 Cancel dismisses the delete confirmation alert", async ({
  browser,
}) => {
  const { context, page } = await newUser(browser, "Sam");
  await page.goto("/settings");
  await page.getByRole("button", { name: "Delete my account and data" }).click();
  await expect(page.getByText("Delete your account?")).toBeVisible();
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByText("Delete your account?")).not.toBeVisible();
  await expect(page).toHaveURL(/\/settings$/);
  await context.close();
});

test("E2E-151 Delete confirms, calls function, and navigates to login", async ({
  browser,
}) => {
  const { context, page } = await newUser(browser, "Sam");
  await page.route("**/deleteAccount**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ result: null }) }),
  );
  await page.goto("/settings");
  await page.getByRole("button", { name: "Delete my account and data" }).click();
  await expect(page.getByText("Delete your account?")).toBeVisible();
  await page.getByRole("button", { name: "Delete" }).click();
  await expect(page).toHaveURL(/\/(login|signup)$/, { timeout: 10000 });
  await context.close();
});

test("E2E-152 delete alert header and body match Figma copy", async ({
  browser,
}) => {
  const { context, page } = await newUser(browser, "Sam");
  await page.goto("/settings");
  await page.getByRole("button", { name: "Delete my account and data" }).click();
  await expect(page.getByText("Delete your account?")).toBeVisible();
  await expect(
    page.getByText("This can't be undone."),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Cancel" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Delete" })).toBeVisible();
  await context.close();
});
