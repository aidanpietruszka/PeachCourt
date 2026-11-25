export type AlertSetting = { key: string; defaultOn: boolean };

export const ALERT_SETTING: Record<string, AlertSetting> = {
  new_game: { key: "newGamesAlert", defaultOn: true },
  game_reminder: { key: "gameRemindersAlert", defaultOn: true },
  new_message: { key: "chatMessagesAlert", defaultOn: false },
  player_joined: { key: "changesGamesAlert", defaultOn: true },
  player_left: { key: "changesGamesAlert", defaultOn: true },
  player_removed: { key: "changesGamesAlert", defaultOn: true },
  host_transferred: { key: "changesGamesAlert", defaultOn: true },
  game_deleted: { key: "changesGamesAlert", defaultOn: true },
};

export const SETTING_DEFAULTS: Record<string, boolean> = Object.fromEntries(
  Object.values(ALERT_SETTING).map((setting) => [setting.key, setting.defaultOn]),
);

export function alertTypeEnabled(
  type: string,
  profile: Record<string, unknown>,
): boolean {
  const setting = ALERT_SETTING[type];
  if (!setting) return false;
  const value = profile[setting.key];
  return value === undefined ? setting.defaultOn : value === true;
}
