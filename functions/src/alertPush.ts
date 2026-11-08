export type AlertDoc = {
  recipientUid: string;
  type: string;
  gameId?: string;
  gameCourtId?: string;
  gameSport?: string;
  gameFormat?: string;
  gameCourtName?: string;
  actorName?: string;
  hostName?: string;
  spotsOpen?: number;
};

export type PushMessage = {
  title: string;
  body: string;
  data: Record<string, string>;
};

export type SendResult = {
  results: Array<{ success: boolean; invalidToken?: boolean }>;
};

export type PushDeps = {
  getUser: (uid: string) => Promise<Record<string, unknown> | null>;
  getTokens: (uid: string) => Promise<string[]>;
  sendPush: (tokens: string[], message: PushMessage) => Promise<SendResult>;
  logEvent: (data: Record<string, unknown>) => Promise<void>;
  deleteToken: (uid: string, token: string) => Promise<void>;
};

export const ALERT_SETTING: Record<string, { key: string; defaultOn: boolean }> = {
  new_game: { key: "newGamesAlert", defaultOn: true },
  game_reminder: { key: "gameRemindersAlert", defaultOn: true },
  new_message: { key: "chatMessagesAlert", defaultOn: false },
  player_joined: { key: "changesGamesAlert", defaultOn: true },
  player_left: { key: "changesGamesAlert", defaultOn: true },
  player_removed: { key: "changesGamesAlert", defaultOn: true },
  host_transferred: { key: "changesGamesAlert", defaultOn: true },
  game_deleted: { key: "changesGamesAlert", defaultOn: true },
};

export function alertTypeEnabled(
  type: string,
  profile: Record<string, unknown>,
): boolean {
  const map = ALERT_SETTING[type];
  if (!map) return false;
  const value = profile[map.key];
  return value === undefined ? map.defaultOn : value === true;
}

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function pushTitle(alert: AlertDoc): string {
  switch (alert.type) {
    case "new_game":
      return `New ${alert.gameFormat ?? "game"} at ${alert.gameCourtName ?? "a court"}`;
    case "game_reminder":
      return "Starts in 1 hour";
    case "new_message":
      return `${alert.actorName ?? "Someone"} sent a message`;
    case "player_joined":
      return `${alert.actorName ?? "Someone"} joined your game`;
    case "player_left":
      return `${alert.actorName ?? "Someone"} left your game`;
    case "player_removed":
      return "You were removed from a game";
    case "host_transferred":
      return "You're the new host";
    case "game_deleted":
      return `${alert.actorName ?? "Host"} cancelled the game`;
    default:
      return "PeachCourt";
  }
}

export function pushBody(alert: AlertDoc): string {
  const sport = alert.gameSport ? titleCase(alert.gameSport) : "";
  const venue = alert.gameCourtName ?? "";
  const fmt = alert.gameFormat ? titleCase(alert.gameFormat) : "";
  switch (alert.type) {
    case "new_game": {
      const parts = [
        sport,
        alert.spotsOpen != null ? `${alert.spotsOpen} spots open` : "",
      ].filter(Boolean);
      return parts.join(" · ");
    }
    case "player_removed":
      return `${alert.actorName ?? "Host"}'s ${fmt.toLowerCase()} at ${venue}`.trim();
    default:
      return `${fmt} at ${venue}`.trim();
  }
}

export function buildPushMessage(alert: AlertDoc): PushMessage {
  return {
    title: pushTitle(alert),
    body: pushBody(alert),
    data: {
      type: alert.type,
      gameId: alert.gameId ?? "",
      gameCourtId: alert.gameCourtId ?? "",
    },
  };
}

export async function sendAlertPush(
  alert: AlertDoc,
  deps: PushDeps,
): Promise<void> {
  const profile = await deps.getUser(alert.recipientUid);
  if (!profile) return;
  if (profile.notificationsEnabled === false) return;
  if (!alertTypeEnabled(alert.type, profile)) return;

  const tokens = await deps.getTokens(alert.recipientUid);
  if (tokens.length === 0) return;

  const result = await deps.sendPush(tokens, buildPushMessage(alert));
  await Promise.all(
    result.results.map((r, index) =>
      r.invalidToken
        ? deps.deleteToken(alert.recipientUid, tokens[index])
        : Promise.resolve(),
    ),
  );

  await deps.logEvent({
    eventName: "notification_sent",
    uid: alert.recipientUid,
    matchId: alert.gameId ?? null,
    alertType: alert.type,
    timestamp: new Date(),
  });
}
