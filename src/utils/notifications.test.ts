import { describe, expect, it } from "vitest";
import {
  notificationStatus,
  parseJoinSource,
  pushTargetUrl,
  type NotifEnv,
} from "./notifications";

const baseEnv: NotifEnv = {
  hasNotification: true,
  hasServiceWorker: true,
  permission: "granted",
  isIPhone: false,
  isStandalone: false,
  hasVapidKey: true,
};

describe("notificationStatus", () => {
  it("U-230 returns ok when everything is available", () => {
    expect(notificationStatus(baseEnv)).toBe("ok");
  });

  it("U-231 is unsupported without the Notification API", () => {
    expect(notificationStatus({ ...baseEnv, hasNotification: false })).toBe(
      "unsupported",
    );
  });

  it("U-232 is unsupported without a service worker", () => {
    expect(notificationStatus({ ...baseEnv, hasServiceWorker: false })).toBe(
      "unsupported",
    );
  });

  it("U-233 needs home screen on an iPhone that is not standalone", () => {
    expect(
      notificationStatus({ ...baseEnv, isIPhone: true, isStandalone: false }),
    ).toBe("needs_home_screen");
  });

  it("U-234 allows an iPhone added to the Home Screen", () => {
    expect(
      notificationStatus({ ...baseEnv, isIPhone: true, isStandalone: true }),
    ).toBe("ok");
  });

  it("U-235 reports denied permission", () => {
    expect(notificationStatus({ ...baseEnv, permission: "denied" })).toBe(
      "denied",
    );
  });

  it("U-236 reports a missing VAPID key", () => {
    expect(notificationStatus({ ...baseEnv, hasVapidKey: false })).toBe(
      "no_vapid",
    );
  });

  it("U-237 home-screen block takes priority over denied permission", () => {
    expect(
      notificationStatus({
        ...baseEnv,
        isIPhone: true,
        isStandalone: false,
        permission: "denied",
      }),
    ).toBe("needs_home_screen");
  });
});

describe("pushTargetUrl", () => {
  it("U-238 opens the chat for a new message", () => {
    expect(pushTargetUrl({ type: "new_message", gameId: "m1" })).toBe(
      "/chats/m1?src=push",
    );
  });

  it("U-239 opens the court for a game alert", () => {
    expect(
      pushTargetUrl({ type: "new_game", gameCourtId: "c1", gameId: "m1" }),
    ).toBe("/courts/c1?src=push");
  });

  it("U-240 falls back to the game's court id when only a game id exists", () => {
    expect(pushTargetUrl({ type: "player_joined", gameId: "m1" })).toBe(
      "/courts/m1?src=push",
    );
  });

  it("U-241 falls back to the courts list with no ids", () => {
    expect(pushTargetUrl({})).toBe("/courts");
  });
});

describe("parseJoinSource", () => {
  it("U-242 keeps known sources", () => {
    expect(parseJoinSource("push")).toBe("push");
    expect(parseJoinSource("banner")).toBe("banner");
    expect(parseJoinSource("inbox")).toBe("inbox");
    expect(parseJoinSource("browsing")).toBe("browsing");
  });

  it("U-243 falls back to browsing for unknown or missing values", () => {
    expect(parseJoinSource("spam")).toBe("browsing");
    expect(parseJoinSource(null)).toBe("browsing");
    expect(parseJoinSource(undefined)).toBe("browsing");
  });
});
