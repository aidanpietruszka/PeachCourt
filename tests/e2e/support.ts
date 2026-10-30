import {
  expect,
  type Browser,
  type BrowserContext,
  type Locator,
  type Page,
} from "@playwright/test";

export const APP_URL = "http://127.0.0.1:5174";
export const PIEDMONT_PARK = { latitude: 33.7851, longitude: -84.3738 };

const PROJECT_ID = "demo-peachcourt";
const FIRESTORE = "http://127.0.0.1:8080";
const AUTH = "http://127.0.0.1:9099";

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

type StoredValue = {
  stringValue?: string;
  integerValue?: string;
  nullValue?: null;
};

export async function loggedEvents(
  eventName: string,
): Promise<Array<Record<string, string | number | null>>> {
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
          value.integerValue !== undefined
            ? Number(value.integerValue)
            : (value.stringValue ?? null),
        ]),
      ),
    )
    .filter((event) => event.eventName === eventName);
}

export async function newUser(
  browser: Browser,
  name: string,
  options: { skipPrompts?: boolean; geolocation?: boolean } = {},
): Promise<{ context: BrowserContext; page: Page; email: string }> {
  const { skipPrompts = true, geolocation = true } = options;
  const context = await browser.newContext({
    baseURL: APP_URL,
    viewport: { width: 390, height: 844 },
    ...(geolocation
      ? { geolocation: PIEDMONT_PARK, permissions: ["geolocation"] }
      : { permissions: [] }),
  });
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
  await expect(page).toHaveURL(/\/courts$/);
  return email;
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

export async function checkIn(page: Page, headCount: number) {
  await ionButton(page.locator("ion-footer"), "Check in").click();
  await alertInput(page).fill(String(headCount));
  await alertButton(page, "Check in").click();
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
  await page
    .locator("ion-popover")
    .getByText("Tomorrow", { exact: true })
    .click();
  await modal.locator('input[type="time"]').fill(options.time ?? "10:00");
  await modal.locator("ion-select").nth(1).click();
  await page
    .locator("ion-popover")
    .getByText(options.skill, { exact: true })
    .click();
  await ionButton(modal, "Post game").click();
  await expect(visibleText(page, "Your game is posted.")).toBeVisible();
}

export function gameCard(page: Page, hostName: string) {
  return page
    .locator(".match-card")
    .filter({ hasText: hostName })
    .filter({ visible: true })
    .first();
}
