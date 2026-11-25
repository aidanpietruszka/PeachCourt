import { describe, expect, it } from "vitest";
import {
  ALERT_SETTING,
  SETTING_DEFAULTS,
  alertTypeEnabled,
} from "./alertDefaults";
import {
  ALERT_SETTING as FUNCTIONS_ALERT_SETTING,
  SETTING_DEFAULTS as FUNCTIONS_SETTING_DEFAULTS,
} from "../../functions/src/alertDefaults";

describe("alertTypeEnabled", () => {
  it("U-280 uses the default when the setting is missing", () => {
    expect(alertTypeEnabled("new_game", {})).toBe(true);
    expect(alertTypeEnabled("game_reminder", {})).toBe(true);
    expect(alertTypeEnabled("player_joined", {})).toBe(true);
    expect(alertTypeEnabled("new_message", {})).toBe(false);
  });

  it("U-281 respects an explicit true setting", () => {
    expect(alertTypeEnabled("new_message", { chatMessagesAlert: true })).toBe(
      true,
    );
    expect(alertTypeEnabled("new_game", { newGamesAlert: true })).toBe(true);
  });

  it("U-282 respects an explicit false setting", () => {
    expect(alertTypeEnabled("new_game", { newGamesAlert: false })).toBe(false);
    expect(
      alertTypeEnabled("player_left", { changesGamesAlert: false }),
    ).toBe(false);
  });

  it("U-283 treats a non-boolean truthy value as not enabled", () => {
    expect(alertTypeEnabled("new_game", { newGamesAlert: "yes" })).toBe(false);
  });

  it("U-284 returns false for an unknown alert type", () => {
    expect(alertTypeEnabled("mystery", {})).toBe(false);
  });
});

describe("SETTING_DEFAULTS", () => {
  it("U-285 derives one default per setting key", () => {
    expect(SETTING_DEFAULTS).toEqual({
      newGamesAlert: true,
      changesGamesAlert: true,
      gameRemindersAlert: true,
      chatMessagesAlert: false,
    });
  });
});

describe("app and functions defaults parity", () => {
  it("U-286 ALERT_SETTING is identical in both packages", () => {
    expect(ALERT_SETTING).toEqual(FUNCTIONS_ALERT_SETTING);
  });

  it("U-287 SETTING_DEFAULTS is identical in both packages", () => {
    expect(SETTING_DEFAULTS).toEqual(FUNCTIONS_SETTING_DEFAULTS);
  });
});
