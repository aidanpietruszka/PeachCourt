import {
  expect,
  test,
  type Browser,
  type BrowserContext,
  type BrowserContextOptions,
  type Locator,
  type Page,
} from "@playwright/test";
import { readFileSync } from "node:fs";

export const APP_URL = `http://127.0.0.1:${process.env.E2E_APP_PORT ?? "5174"}`;
export const PIEDMONT_PARK = { latitude: 33.7851, longitude: -84.3738 };

const TILE_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC",
  "base64",
);

export function deviceContextOptions(): BrowserContextOptions {
  const projectUse = test.info().project.use as Record<string, unknown>;
  const keys = [
    "userAgent",
    "viewport",
    "deviceScaleFactor",
    "isMobile",
    "hasTouch",
    "screen",
  ] as const;
  const options: Record<string, unknown> = {};
  for (const key of keys) {
    if (projectUse[key] !== undefined) {
      options[key] = projectUse[key];
    }
  }
  return options as BrowserContextOptions;
}

export async function stubMapTiles(target: BrowserContext | Page) {
  await target.route(/tile\.openstreetmap\.org\/.*\.png/, (route) =>
    route.fulfill({ contentType: "image/png", body: TILE_PNG }),
  );
}

const APP_COLLECTIONS = [
  "users",
  "courts",
  "courtStatus",
  "checkins",
  "matches",
  "alerts",
  "config",
  "clientErrors",
];

export async function blockLiveData(denied: string[]) {
  const allowTop = APP_COLLECTIONS.filter((c) => !denied.includes(c))
    .map((c) => `    match /${c}/{doc} { allow read, write: if true; }`)
    .join("\n");
  const chatsDenied = denied.includes("chats");
  const messagesDenied = denied.includes("messages");
  const messageRule = messagesDenied
    ? "match /messages/{m} { allow read, write: if false; }"
    : "match /messages/{m} { allow read, write: if true; }";
  const chatsBlock = chatsDenied
    ? `    match /chats/{id} {\n      ${messageRule}\n    }`
    : `    match /chats/{id} {\n      allow read, write: if true;\n      ${messageRule}\n    }`;
  await setFirestoreRules(
    `rules_version = '2';\nservice cloud.firestore {\n  match /databases/{database}/documents {\n${allowTop}\n${chatsBlock}\n  }\n}`,
  );
}

export async function pullToRefresh(page: Page) {
  await page.evaluate(() => {
    const refresher = document.querySelector("ion-refresher");
    refresher?.dispatchEvent(
      new CustomEvent("ionRefresh", { detail: { complete: () => {} } }),
    );
  });
}

const PROJECT_ID = "demo-peachcourt";
const FIRESTORE = `http://127.0.0.1:${process.env.E2E_FIRESTORE_PORT ?? "8080"}`;
const AUTH = `http://127.0.0.1:${process.env.E2E_AUTH_PORT ?? "9099"}`;

export const COURTS = {
  alpha: {
    id: "court-alpha",
    name: "Alpha Tennis Center",
    address: "1 Test St NE, Atlanta",
    latitude: 33.7853,
    longitude: -84.3735,
    tennisCourts: 4,
    pickleballCourts: 0,
    pickleballLines: false,
    surfaces: ["Hard"],
    hasLights: true,
    openingHours: [{ days: "Daily", open: "07:00", close: "23:00" }],
    walkOnRules: "First come, first served",
    reservationInfo: null,
  },
  beta: {
    id: "court-beta",
    name: "Beta Park",
    address: "2 Test Ave NW, Atlanta",
    latitude: 33.81,
    longitude: -84.42,
    tennisCourts: 2,
    pickleballCourts: 2,
    pickleballLines: null,
    surfaces: null,
    hasLights: null,
    openingHours: null,
    walkOnRules: null,
    reservationInfo: null,
  },
  gamma: {
    id: "court-gamma",
    name: "Gamma Pickleball",
    address: "3 Test Rd SE, Atlanta",
    latitude: 33.74,
    longitude: -84.36,
    tennisCourts: 0,
    pickleballCourts: 6,
    pickleballLines: false,
    surfaces: ["Concrete"],
    hasLights: false,
    openingHours: [
      { days: "Mon–Fri", open: "06:00", close: "22:00" },
      { days: "Sat–Sun", open: "08:30", close: "20:00" },
    ],
    walkOnRules: "Paddle stacking",
    reservationInfo: "Call the front desk",
  },
  delta: {
    id: "court-delta",
    name: "Delta Rec Center",
    address: "4 Test Blvd NE, Atlanta",
    latitude: 33.7,
    longitude: -84.3,
    tennisCourts: 3,
    pickleballCourts: 0,
    pickleballLines: true,
    surfaces: ["Clay", "Hard"],
    hasLights: true,
    openingHours: [{ days: "Mon–Fri", open: "09:30", close: "21:00" }],
    walkOnRules: "Reservation required",
    reservationInfo: "Book online",
  },
} as const;

type FirestoreValue =
  | { stringValue: string }
  | { integerValue: string }
  | { doubleValue: number }
  | { booleanValue: boolean }
  | { nullValue: null }
  | { arrayValue: { values: FirestoreValue[] } }
  | { mapValue: { fields: Record<string, FirestoreValue> } };

function toValue(value: unknown): FirestoreValue {
  if (value === null) {
    return { nullValue: null };
  }
  if (typeof value === "boolean") {
    return { booleanValue: value };
  }
  if (typeof value === "number") {
    return Number.isInteger(value)
      ? { integerValue: String(value) }
      : { doubleValue: value };
  }
  if (Array.isArray(value)) {
    return { arrayValue: { values: value.map(toValue) } };
  }
  if (typeof value === "object") {
    return {
      mapValue: {
        fields: Object.fromEntries(
          Object.entries(value).map(([key, inner]) => [key, toValue(inner)]),
        ),
      },
    };
  }
  return { stringValue: String(value) };
}

export async function resetData() {
  await fetch(
    `${FIRESTORE}/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`,
    {
      method: "DELETE",
    },
  );
  await fetch(`${AUTH}/emulator/v1/projects/${PROJECT_ID}/accounts`, {
    method: "DELETE",
  });

  for (const { id, ...court } of Object.values(COURTS)) {
    const fields = Object.fromEntries(
      Object.entries(court).map(([key, value]) => [key, toValue(value)]),
    );
    const response = await fetch(
      `${FIRESTORE}/v1/projects/${PROJECT_ID}/databases/(default)/documents/courts?documentId=${id}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer owner",
        },
        body: JSON.stringify({ fields }),
      },
    );
    expect(response.ok).toBe(true);
  }
}

export async function getUidByEmail(email: string): Promise<string> {
  const response = await fetch(
    `${AUTH}/identitytoolkit.googleapis.com/v1/accounts:lookup`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer owner" },
      body: JSON.stringify({ email: [email] }),
    },
  );
  const body = (await response.json()) as {
    users?: Array<{ localId: string }>;
  };
  const user = (body.users ?? [])[0];
  if (!user) throw new Error(`No account found for email: ${email}`);
  return user.localId;
}

export async function seedUserProfile(
  uid: string,
  data: Record<string, unknown>,
) {
  const fields = Object.fromEntries(
    Object.entries(data).map(([key, value]) => [key, toValue(value)]),
  );
  const mask = Object.keys(data)
    .map((k) => `updateMask.fieldPaths=${encodeURIComponent(k)}`)
    .join("&");
  const response = await fetch(
    `${FIRESTORE}/v1/projects/${PROJECT_ID}/databases/(default)/documents/users/${uid}?${mask}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: "Bearer owner" },
      body: JSON.stringify({ fields }),
    },
  );
  expect(response.ok).toBe(true);
}

export async function seedTeamAccounts(uids: string[]) {
  const response = await fetch(
    `${FIRESTORE}/v1/projects/${PROJECT_ID}/databases/(default)/documents/config?documentId=teamAccounts`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer owner",
      },
      body: JSON.stringify({
        fields: {
          uids: toValue(uids),
        },
      }),
    },
  );
  if (!response.ok) {
    const patch = await fetch(
      `${FIRESTORE}/v1/projects/${PROJECT_ID}/databases/(default)/documents/config/teamAccounts?updateMask.fieldPaths=uids`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer owner",
        },
        body: JSON.stringify({
          fields: {
            uids: toValue(uids),
          },
        }),
      },
    );
    expect(patch.ok).toBe(true);
  }
}

export async function seedReport(courtId: string, playerCount: number) {
  const response = await fetch(
    `${FIRESTORE}/v1/projects/${PROJECT_ID}/databases/(default)/documents/courtStatus?documentId=${courtId}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer owner",
      },
      body: JSON.stringify({
        fields: {
          playerCount: { integerValue: String(playerCount) },
          reportedBy: { stringValue: "seed" },
          reportedAt: { timestampValue: new Date().toISOString() },
        },
      }),
    },
  );
  expect(response.ok).toBe(true);
}

export async function getAbGroup(uid: string): Promise<"auto_on" | "auto_off" | null> {
  const response = await fetch(
    `${FIRESTORE}/v1/projects/${PROJECT_ID}/databases/(default)/documents/users/${uid}`,
    { headers: { Authorization: "Bearer owner" } },
  );
  if (!response.ok) return null;
  const body = (await response.json()) as {
    fields?: Record<string, { stringValue?: string }>;
  };
  const val = body.fields?.checkinVariant?.stringValue;
  if (val === "auto_on" || val === "auto_off") return val;
  return null;
}

export async function enableAutoCheckin(uid: string) {
  const response = await fetch(
    `${FIRESTORE}/v1/projects/${PROJECT_ID}/databases/(default)/documents/users/${uid}?updateMask.fieldPaths=autoCheckin&updateMask.fieldPaths=locationEnabled`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: "Bearer owner" },
      body: JSON.stringify({
        fields: {
          autoCheckin: { booleanValue: true },
          locationEnabled: { booleanValue: true },
        },
      }),
    },
  );
  expect(response.ok).toBe(true);
}

export async function backdateReport(courtId: string, minutesAgo = 31) {
  const oldDate = new Date(Date.now() - minutesAgo * 60 * 1000);
  const response = await fetch(
    `${FIRESTORE}/v1/projects/${PROJECT_ID}/databases/(default)/documents/courtStatus/${courtId}?updateMask.fieldPaths=reportedAt`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer owner",
      },
      body: JSON.stringify({
        fields: {
          reportedAt: { timestampValue: oldDate.toISOString() },
        },
      }),
    },
  );
  expect(response.ok).toBe(true);
}

type ReadValue =
  | string
  | number
  | boolean
  | null
  | Array<string | number | boolean | null>;

type StoredValue = {
  stringValue?: string;
  integerValue?: string;
  booleanValue?: boolean;
  timestampValue?: string;
  nullValue?: null;
  arrayValue?: { values?: StoredValue[] };
};

function readStoredValue(value: StoredValue): ReadValue {
  if (value.integerValue !== undefined) return Number(value.integerValue);
  if (value.booleanValue !== undefined) return value.booleanValue;
  if (value.timestampValue !== undefined) return value.timestampValue;
  if (value.arrayValue !== undefined) {
    return (value.arrayValue.values ?? []).map(
      (v) => readStoredValue(v) as string | number | boolean | null,
    );
  }
  return value.stringValue ?? null;
}

export async function loggedEvents(
  eventName: string,
): Promise<Array<Record<string, ReadValue>>> {
  const response = await fetch(
    `${FIRESTORE}/v1/projects/${PROJECT_ID}/databases/(default)/documents/events?pageSize=500`,
    { headers: { Authorization: "Bearer owner" } },
  );
  expect(response.ok).toBe(true);
  const body = (await response.json()) as {
    documents?: Array<{ fields: Record<string, StoredValue> }>;
  };
  return (body.documents ?? [])
    .map(({ fields }) =>
      Object.fromEntries(
        Object.entries(fields).map(([key, value]) => [
          key,
          readStoredValue(value),
        ]),
      ),
    )
    .filter((event) => event.eventName === eventName);
}

export async function clientErrors(): Promise<
  Array<Record<string, ReadValue>>
> {
  const response = await fetch(
    `${FIRESTORE}/v1/projects/${PROJECT_ID}/databases/(default)/documents/clientErrors?pageSize=500`,
    { headers: { Authorization: "Bearer owner" } },
  );
  expect(response.ok).toBe(true);
  const body = (await response.json()) as {
    documents?: Array<{ fields: Record<string, StoredValue> }>;
  };
  return (body.documents ?? []).map(({ fields }) =>
    Object.fromEntries(
      Object.entries(fields).map(([key, value]) => [
        key,
        readStoredValue(value),
      ]),
    ),
  );
}

export async function newUser(
  browser: Browser,
  name: string,
  options: { skipPrompts?: boolean; geolocation?: boolean } = {},
): Promise<{ context: BrowserContext; page: Page; email: string }> {
  const { skipPrompts = true, geolocation = true } = options;
  const context = await browser.newContext({
    baseURL: APP_URL,
    ...deviceContextOptions(),
    ...(geolocation
      ? { geolocation: PIEDMONT_PARK, permissions: ["geolocation"] }
      : { permissions: [] }),
  });
  await stubMapTiles(context);
  if (skipPrompts) {
    await context.addInitScript(() => {
      try {
        window.sessionStorage.setItem("peachcourt-trust-asked", "true");
      } catch {
        return;
      }
    });
  }
  const page = await context.newPage();
  const email = await signUp(page, name);
  return { context, page, email };
}

export async function signUp(page: Page, name: string) {
  const email = `${name.toLowerCase()}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@test.dev`;
  await page.goto("/signup");
  await page.getByPlaceholder("Name (optional)").fill(name);
  await page.getByPlaceholder("Email").fill(email);
  await page.getByPlaceholder("Password (6+ characters)").fill("secret123");
  await page.getByPlaceholder("Confirm password").fill("secret123");
  await page.getByRole("button", { name: "Sign up", exact: true }).click();
  await expect(page).toHaveURL(/\/onboarding$/, { timeout: 30_000 });
  await page.getByLabel("First name").fill(name);
  await page.getByLabel("Last name").fill("Test");
  await page.getByRole("button", { name: "Tennis" }).click();
  await page.locator(".onboarding__skill-row").first().click();
  await expect(page.locator("ion-action-sheet")).toBeVisible();
  await page.locator("ion-action-sheet button").filter({ hasText: "3.5" }).click();
  await page.getByRole("button", { name: "Next" }).click();
  await expect(page.getByText("Use your location")).toBeVisible();
  await page.getByRole("button", { name: "Skip for now" }).click();
  await expect(page.getByText("Get game alerts")).toBeVisible();
  await finishOnboardingStep3(page);
  await expect(page).toHaveURL(/\/courts$/);
  return email;
}

export async function finishOnboardingStep3(page: Page) {
  const skip = page.getByRole("button", { name: "Skip for now" });
  const cont = page.getByRole("button", { name: "Continue" });
  await expect(skip.or(cont)).toBeVisible();
  if (await skip.isVisible()) {
    await skip.click();
  } else {
    await cont.click();
  }
}

export async function expectLoginPageShown(page: Page) {
  await expect(page).toHaveURL(/\/login$/);
  const loginPage = page
    .locator("div.ion-page")
    .filter({ has: page.locator("h1.pc-title", { hasText: "Log in" }) });
  await expect(loginPage).toHaveCount(1);
  await expect(loginPage).not.toHaveClass(/ion-page-(invisible|hidden)/);
}

export function visibleText(page: Page, text: string | RegExp) {
  return page.getByText(text).filter({ visible: true }).first();
}

export function infoRow(page: Page, label: string) {
  return page
    .locator(".court-info")
    .filter({ visible: true })
    .locator("ion-item")
    .filter({ has: page.getByText(label, { exact: true }) });
}

export async function expandDetails(page: Page) {
  const toggle = page.locator(".court-details__toggle");
  if ((await toggle.getAttribute("aria-expanded")) !== "true") {
    await toggle.click();
  }
  await expect(page.locator(".court-info")).toBeVisible();
}

export async function openCourt(page: Page, courtName: string) {
  await page
    .locator("ion-item")
    .filter({ hasText: courtName })
    .filter({ visible: true })
    .first()
    .click();
  await expect(
    page
      .locator("h1.pc-title")
      .filter({ hasText: courtName })
      .filter({ visible: true }),
  ).toBeVisible();
}

export async function backToCourts(page: Page) {
  await page
    .locator("ion-back-button")
    .filter({ visible: true })
    .first()
    .click();
  await expect(page).toHaveURL(/\/courts$/);
}

export function ionButton(scope: Page | Locator, text: string) {
  return scope
    .locator("ion-button")
    .filter({ hasText: new RegExp(`^\\s*${text}\\s*$`) })
    .filter({ visible: true })
    .first();
}

export function liveCard(page: Page) {
  return page.locator(".live-card").filter({ visible: true }).first();
}

export function openAlert(page: Page) {
  return page.locator("ion-alert").filter({ visible: true }).last();
}

export function alertInput(page: Page) {
  return openAlert(page).locator("input");
}

export function alertButton(page: Page, text: string) {
  return openAlert(page).locator("button").filter({ hasText: text }).first();
}

function rangeLabel(headCount: number): string {
  if (headCount === 1) return "Just me";
  if (headCount <= 4) return "A few";
  if (headCount <= 8) return "Busy";
  if (headCount <= 15) return "Packed";
  return "Very packed";
}

export async function checkIn(page: Page, headCount: number) {
  await ionButton(page.locator("ion-footer"), "Check in").click();
  const moveAlert = page
    .locator("ion-alert")
    .filter({ hasText: "Move your check-in?" });
  await moveAlert
    .waitFor({ state: "visible", timeout: 2_000 })
    .catch(() => null);
  if (await moveAlert.isVisible()) {
    await moveAlert.locator("button").filter({ hasText: "Move here" }).click();
  }
  await page
    .locator(".range-picker__row")
    .filter({ hasText: rangeLabel(headCount) })
    .first()
    .waitFor({ state: "visible" });
  await page
    .locator(".range-picker__row")
    .filter({ hasText: rangeLabel(headCount) })
    .first()
    .click();
  await ionButton(
    page.locator("ion-modal").filter({ visible: true }).last(),
    "Check in",
  ).click();
  await expect(visibleText(page, "You're checked in")).toBeVisible();
}

export async function closeConfirmation(page: Page) {
  await ionButton(page.locator("ion-modal"), "Done").click();
}

export async function dismissFeedbackIfShown(page: Page) {
  const notNow = alertButton(page, "Not now");
  const shown = await notNow
    .waitFor({ state: "visible", timeout: 2_000 })
    .then(() => true)
    .catch(() => false);
  if (shown) {
    await notNow.click();
    await expect(openAlert(page)).toHaveCount(0);
  }
}

export async function postGame(
  page: Page,
  options: { sport?: "Tennis" | "Pickleball"; skill: string; time?: string },
) {
  await ionButton(page.locator("ion-footer"), "Post a game").click();
  const modal = page.locator("ion-modal").filter({ visible: true }).last();
  if (options.sport) {
    await modal
      .locator("ion-segment-button")
      .filter({ hasText: options.sport })
      .click();
  }
  await modal.locator("ion-select").nth(0).click();
  const datePopover = page.locator("ion-popover").filter({ visible: true }).last();
  await expect(datePopover).toBeVisible();
  await datePopover.getByText("Tomorrow", { exact: true }).click();
  await expect(datePopover).toBeHidden();
  await modal.locator('input[type="time"]').fill(options.time ?? "10:00");
  await modal.locator("ion-select").nth(1).click();
  const skillPopover = page.locator("ion-popover").filter({ visible: true }).last();
  await expect(skillPopover).toBeVisible();
  await skillPopover.getByText(options.skill, { exact: true }).click();
  await expect(skillPopover).toBeHidden();
  await ionButton(modal, "Post game").click();
  const confirmSheet = page.locator('ion-modal[aria-label="Confirm game"]');
  await expect(confirmSheet).toBeVisible();
  await ionButton(confirmSheet, "Post game").click();
  await expect(visibleText(page, "Your game is posted.")).toBeVisible();
}

export function gameCard(page: Page, hostName: string) {
  return page
    .locator(".match-card")
    .filter({ hasText: hostName })
    .filter({ visible: true })
    .first();
}

export async function seedAlert(
  uid: string,
  overrides: Record<string, unknown> = {},
) {
  const fields = Object.fromEntries(
    Object.entries({
      recipientUid: uid,
      type: "new_game",
      gameId: "m1",
      gameCourtId: COURTS.alpha.id,
      gameCourtName: COURTS.alpha.name,
      gameSport: "tennis",
      gameFormat: "doubles",
      spotsOpen: 2,
      read: false,
      createdAt: { timestampValue: new Date().toISOString() },
      ...overrides,
    }).map(([key, value]) => {
      if (
        key === "createdAt" &&
        typeof value === "object" &&
        value !== null &&
        "timestampValue" in value
      ) {
        return [key, value];
      }
      return [key, toValue(value)];
    }),
  );
  const response = await fetch(
    `${FIRESTORE}/v1/projects/${PROJECT_ID}/databases/(default)/documents/alerts`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer owner" },
      body: JSON.stringify({ fields }),
    },
  );
  expect(response.ok).toBe(true);
}

export async function joinGame(page: Page, card: Locator) {
  await ionButton(card, "Join").click();
  const sheet = page.locator("ion-modal").filter({ visible: true }).last();
  await ionButton(sheet, "Join game").click();
}

export async function seedChat(
  matchId: string,
  overrides: Record<string, unknown> = {},
) {
  const merged: Record<string, unknown> = {
    matchId,
    courtId: COURTS.alpha.id,
    courtName: COURTS.alpha.name,
    format: "doubles",
    sport: "tennis",
    startAt: { timestampValue: new Date(Date.now() + 90 * 60_000).toISOString() },
    hostUid: "alice",
    hostName: "Alice",
    playerUids: ["alice", "bob"],
    playerNames: ["Alice", "Bob"],
    lastMessage: null,
    lastSenderName: null,
    lastSenderUid: null,
    lastMessageAt: null,
    readAt: {},
    createdAt: { timestampValue: new Date().toISOString() },
    ...overrides,
  };
  if (merged.memberUids === undefined) {
    merged.memberUids = [
      ...new Set([
        merged.hostUid as string,
        ...((merged.playerUids as string[] | undefined) ?? []),
      ]),
    ];
  }
  const fields = Object.fromEntries(
    Object.entries(merged).map(([key, value]) => {
      if (
        typeof value === "object" &&
        value !== null &&
        ("timestampValue" in value || "nullValue" in value)
      ) {
        if ("nullValue" in value) return [key, { nullValue: null }];
        return [key, value];
      }
      return [key, toValue(value)];
    }),
  );
  const response = await fetch(
    `${FIRESTORE}/v1/projects/${PROJECT_ID}/databases/(default)/documents/chats?documentId=${matchId}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer owner" },
      body: JSON.stringify({ fields }),
    },
  );
  expect(response.ok).toBe(true);
}

export async function seedMessage(
  matchId: string,
  msgId: string,
  senderUid: string,
  senderName: string,
  text: string,
) {
  const fields = Object.fromEntries(
    Object.entries({
      text,
      senderUid,
      senderName,
      createdAt: { timestampValue: new Date().toISOString() },
    }).map(([key, value]) => {
      if (typeof value === "object" && value !== null && "timestampValue" in value) {
        return [key, value];
      }
      return [key, toValue(value)];
    }),
  );
  const response = await fetch(
    `${FIRESTORE}/v1/projects/${PROJECT_ID}/databases/(default)/documents/chats/${matchId}/messages?documentId=${msgId}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer owner" },
      body: JSON.stringify({ fields }),
    },
  );
  expect(response.ok).toBe(true);
}

export async function signInWithGoogle(
  page: Page,
  options: { email?: string; onPage?: "login" | "signup" } = {},
): Promise<string> {
  const email =
    options.email ??
    `google-${Date.now()}-${Math.floor(Math.random() * 1e6)}@gmail.com`;
  const buttonName =
    options.onPage === "signup" ? "Sign up with Google" : "Continue with Google";
  const popupPromise = page.context().waitForEvent("page");
  await page.getByRole("button", { name: buttonName }).click();
  const popup = await popupPromise;
  await popup.waitForLoadState("domcontentloaded");
  const addAccount = popup.getByRole("button", { name: "Add new account" });
  if (await addAccount.isVisible().catch(() => false)) {
    await addAccount.click();
  }
  const emailInput = popup.locator("#email-input");
  await emailInput.waitFor({ state: "visible" });
  await emailInput.fill(email);
  await popup
    .getByRole("button", { name: /Sign in with Google\.com/i })
    .click();
  return email;
}

export async function deleteUserProfile(uid: string) {
  const response = await fetch(
    `${FIRESTORE}/v1/projects/${PROJECT_ID}/databases/(default)/documents/users/${uid}`,
    { method: "DELETE", headers: { Authorization: "Bearer owner" } },
  );
  expect(response.ok || response.status === 404).toBe(true);
}

export async function seedProfileMissingFields(uid: string) {
  await seedUserProfile(uid, {
    firstName: "Pat",
    onboardingDone: true,
  });
}

export async function seedOnboardingStep(uid: string, step: 1 | 2 | 3) {
  if (step === 1) {
    await deleteUserProfile(uid);
    return;
  }
  await seedUserProfile(uid, {
    firstName: "Sam",
    lastName: "Test",
    sports: ["tennis"],
    skillLevels: { tennis: 3.5 },
    checkinVariant: "auto_off",
  });
  if (step === 3) {
    await seedUserProfile(uid, {
      locationEnabled: false,
      autoCheckin: false,
    });
  }
}

export async function installClock(page: Page, now: number = Date.now()) {
  await page.clock.install({ time: now });
  await page.clock.pauseAt(now);
}

export async function advanceClock(page: Page, ms: number) {
  await page.clock.fastForward(ms);
}

export async function runClockFor(page: Page, ms: number) {
  await page.clock.runFor(ms);
}

export async function setClockTime(page: Page, time: number | Date) {
  await page.clock.setFixedTime(time);
}

type PermissionState = "allowed" | "denied" | "not_asked";

export async function setLocationPermission(
  context: BrowserContext,
  state: PermissionState,
) {
  if (state === "allowed") {
    await context.grantPermissions(["geolocation"]);
    return;
  }
  const reported = state === "denied" ? "denied" : "prompt";
  await context.addInitScript((value) => {
    const query = navigator.permissions.query.bind(navigator.permissions);
    navigator.permissions.query = ((descriptor: PermissionDescriptor) =>
      descriptor.name === "geolocation"
        ? Promise.resolve({
            state: value,
            onchange: null,
            addEventListener: () => undefined,
            removeEventListener: () => undefined,
            dispatchEvent: () => false,
          } as unknown as PermissionStatus)
        : query(descriptor)) as typeof navigator.permissions.query;
    navigator.geolocation.getCurrentPosition = (_success, error) => {
      if (error) {
        error({ code: 1, message: value } as GeolocationPositionError);
      }
    };
  }, reported);
}

export async function setNotificationPermission(
  context: BrowserContext,
  state: PermissionState,
) {
  const permission =
    state === "allowed" ? "granted" : state === "denied" ? "denied" : "default";
  if (state === "allowed") {
    await context.grantPermissions(["notifications"]).catch(() => undefined);
  }
  await context.addInitScript((value) => {
    const counter = globalThis as { __notifRequestCount?: number };
    counter.__notifRequestCount = counter.__notifRequestCount ?? 0;
    const request = () => {
      counter.__notifRequestCount = (counter.__notifRequestCount ?? 0) + 1;
      return Promise.resolve(value as NotificationPermission);
    };
    const holder = globalThis as { Notification?: unknown };
    if (typeof holder.Notification === "undefined") {
      holder.Notification = {
        permission: value,
        requestPermission: request,
      };
      return;
    }
    try {
      Object.defineProperty(Notification, "permission", {
        configurable: true,
        get: () => value,
      });
      Notification.requestPermission = request;
    } catch {
      return;
    }
  }, permission);
}

export async function setNotificationRequestResult(
  context: BrowserContext,
  result: "granted" | "denied",
) {
  await context.addInitScript((value) => {
    const counter = globalThis as { __notifRequestCount?: number };
    counter.__notifRequestCount = counter.__notifRequestCount ?? 0;
    const request = () => {
      counter.__notifRequestCount = (counter.__notifRequestCount ?? 0) + 1;
      return Promise.resolve(value as NotificationPermission);
    };
    const holder = globalThis as { Notification?: unknown };
    if (typeof holder.Notification === "undefined") {
      holder.Notification = {
        permission: "default",
        requestPermission: request,
      };
      return;
    }
    try {
      Object.defineProperty(Notification, "permission", {
        configurable: true,
        get: () => "default",
      });
      Notification.requestPermission = request;
    } catch {
      return;
    }
  }, result);
}

export async function setStandalone(context: BrowserContext) {
  await context.addInitScript(() => {
    try {
      Object.defineProperty(navigator, "standalone", {
        configurable: true,
        get: () => true,
      });
    } catch {
      return;
    }
    const original = window.matchMedia.bind(window);
    window.matchMedia = ((query: string) =>
      query.includes("display-mode: standalone")
        ? ({
            matches: true,
            media: query,
            onchange: null,
            addListener: () => undefined,
            removeListener: () => undefined,
            addEventListener: () => undefined,
            removeEventListener: () => undefined,
            dispatchEvent: () => false,
          } as MediaQueryList)
        : original(query)) as typeof window.matchMedia;
  });
}

export async function notificationRequestCount(page: Page): Promise<number> {
  return page.evaluate(
    () => (globalThis as { __notifRequestCount?: number }).__notifRequestCount ?? 0,
  );
}

export async function setFirestoreRules(content: string) {
  const response = await fetch(
    `${FIRESTORE}/emulator/v1/projects/${PROJECT_ID}:securityRules`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer owner",
      },
      body: JSON.stringify({
        rules: { files: [{ name: "firestore.rules", content }] },
      }),
    },
  );
  expect(response.ok).toBe(true);
}

export async function restoreFirestoreRules() {
  await setFirestoreRules(readFileSync("firestore.rules", "utf8"));
}

export async function freshContext(
  browser: Browser,
  options: { geolocation?: boolean } = {},
): Promise<BrowserContext> {
  const { geolocation = true } = options;
  const context = await browser.newContext({
    baseURL: APP_URL,
    ...deviceContextOptions(),
    ...(geolocation
      ? { geolocation: PIEDMONT_PARK, permissions: ["geolocation"] }
      : { permissions: [] }),
  });
  await stubMapTiles(context);
  return context;
}

export async function docExists(path: string): Promise<boolean> {
  const response = await fetch(
    `${FIRESTORE}/v1/projects/${PROJECT_ID}/databases/(default)/documents/${path}`,
    { headers: { Authorization: "Bearer owner" } },
  );
  return response.ok;
}

export async function readCollection(
  collection: string,
): Promise<Array<Record<string, ReadValue>>> {
  const response = await fetch(
    `${FIRESTORE}/v1/projects/${PROJECT_ID}/databases/(default)/documents/${collection}?pageSize=500`,
    { headers: { Authorization: "Bearer owner" } },
  );
  if (!response.ok) return [];
  const body = (await response.json()) as {
    documents?: Array<{ fields: Record<string, StoredValue> }>;
  };
  return (body.documents ?? []).map(({ fields }) =>
    Object.fromEntries(
      Object.entries(fields).map(([key, value]) => [
        key,
        readStoredValue(value),
      ]),
    ),
  );
}

export async function waitForDocument(
  path: string,
  timeoutMs = 10_000,
): Promise<Record<string, ReadValue>> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const response = await fetch(
      `${FIRESTORE}/v1/projects/${PROJECT_ID}/databases/(default)/documents/${path}`,
      { headers: { Authorization: "Bearer owner" } },
    );
    if (response.ok) {
      const body = (await response.json()) as {
        fields?: Record<string, StoredValue>;
      };
      return Object.fromEntries(
        Object.entries(body.fields ?? {}).map(([key, value]) => [
          key,
          readStoredValue(value),
        ]),
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error(`Document never appeared: ${path}`);
}

export async function waitForCollection(
  collection: string,
  timeoutMs = 10_000,
): Promise<Array<Record<string, ReadValue>>> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const response = await fetch(
      `${FIRESTORE}/v1/projects/${PROJECT_ID}/databases/(default)/documents/${collection}?pageSize=50`,
      { headers: { Authorization: "Bearer owner" } },
    );
    if (response.ok) {
      const body = (await response.json()) as {
        documents?: Array<{ fields: Record<string, StoredValue> }>;
      };
      const docs = body.documents ?? [];
      if (docs.length > 0) {
        return docs.map(({ fields }) =>
          Object.fromEntries(
            Object.entries(fields).map(([key, value]) => [
              key,
              readStoredValue(value),
            ]),
          ),
        );
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error(`Collection never had documents: ${collection}`);
}

export async function waitForEvent(
  eventName: string,
  timeoutMs = 10_000,
): Promise<Array<Record<string, ReadValue>>> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const events = await loggedEvents(eventName);
    if (events.length > 0) {
      return events;
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error(`Event never logged: ${eventName}`);
}
