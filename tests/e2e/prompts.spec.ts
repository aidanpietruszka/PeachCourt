import { expect, test } from "@playwright/test";
import {
  alertButton,
  backToCourts,
  COURTS,
  newUser,
  openCourt,
  resetData,
  visibleText,
} from "./support";

test.beforeEach(async () => {
  await resetData();
});

test("E2E-23 the trust question shows once per session", async ({
  browser,
}) => {
  const { context, page } = await newUser(browser, "Ana", {
    skipPrompts: false,
  });
  await openCourt(page, COURTS.alpha.name);
  await expect(visibleText(page, /How much do you trust/)).toBeVisible({
    timeout: 10_000,
  });
  await alertButton(page, "4").click();
  await expect(visibleText(page, "Thanks for your rating.")).toBeVisible();

  await backToCourts(page);
  await openCourt(page, COURTS.beta.name);
  await page.waitForTimeout(6_000);
  await expect(
    page
      .locator("ion-alert")
      .filter({ hasText: "How much do you trust" })
      .filter({ visible: true }),
  ).toHaveCount(0);
  await context.close();
});
