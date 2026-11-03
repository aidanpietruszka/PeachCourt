import type { AlertDb } from "./matchNotifications";

export type GameRecord = { id: string; data: Record<string, unknown> };

export async function sendGameReminders(
  games: GameRecord[],
  getUser: (uid: string) => Promise<Record<string, unknown> | null>,
  alertDb: AlertDb,
): Promise<void> {
  for (const { id: matchId, data } of games) {
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
  }
}
