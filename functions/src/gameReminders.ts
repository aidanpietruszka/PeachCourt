import type { AlertDb } from "./matchNotifications";

export type GameRecord = { id: string; data: Record<string, unknown> };

export const REMINDER_WINDOW_FROM_MINUTES = 50;
export const REMINDER_WINDOW_TO_MINUTES = 65;

export function reminderWindow(nowMs: number): { fromMs: number; toMs: number } {
  return {
    fromMs: nowMs + REMINDER_WINDOW_FROM_MINUTES * 60_000,
    toMs: nowMs + REMINDER_WINDOW_TO_MINUTES * 60_000,
  };
}

export async function sendGameReminders(
  games: GameRecord[],
  getUser: (uid: string) => Promise<Record<string, unknown> | null>,
  alertDb: AlertDb,
  gameRemindersEnabled = true,
  markReminded?: (matchId: string) => Promise<void>,
): Promise<void> {
  if (!gameRemindersEnabled) return;
  for (const { id: matchId, data } of games) {
    if (data.reminderSent === true) continue;
    const playerUids = (data.playerUids as string[]) ?? [];
    const hostUid = data.hostUid as string;
    const allUids = hostUid ? [hostUid, ...playerUids] : playerUids;
    for (const uid of allUids) {
      const profile = await getUser(uid);
      if (!profile?.gameRemindersAlert) continue;
      await alertDb.collection("alerts").add({
        recipientUid: uid,
        type: "game_reminder",
        gameId: matchId,
        gameCourtId: data.courtId ?? "",
        gameSport: data.sport,
        gameFormat: data.format,
        gameStartAt: data.startAt,
        gameCourtName: data.courtName ?? "",
        read: false,
        createdAt: new Date(),
      });
    }
    if (markReminded) {
      await markReminded(matchId);
    }
  }
}
