import type { AlertDb } from "./matchNotifications";

export type UserRecord = { id: string; data: Record<string, unknown> };

export async function handleGameCreated(
  matchId: string,
  data: Record<string, unknown>,
  listUsers: () => Promise<UserRecord[]>,
  alertDb: AlertDb,
  pushAlertsEnabled = true,
): Promise<void> {
  if (!pushAlertsEnabled) return;

  const sport = data.sport as string;
  const skillLevel = data.skillLevel as number | "any";
  const hostUid = data.hostUid as string;
  const spotsTotal = (data.spotsTotal as number) ?? 0;
  const playerUids = (data.playerUids as string[]) ?? [];
  const spotsOpen = spotsTotal - playerUids.length;

  const users = await listUsers();
  for (const { id: uid, data: profile } of users) {
    if (uid === hostUid) continue;
    if (!profile.newGamesAlert) continue;
    const sports = (profile.sports as string[] | undefined) ?? [];
    if (!sports.includes(sport)) continue;
    if (skillLevel !== "any") {
      const userSkill = (profile.skillLevels as Record<string, number> | undefined)?.[sport];
      if (userSkill === undefined) continue;
      if (Math.abs(userSkill - (skillLevel as number)) > 0.5) continue;
    }
    await Promise.all([
      alertDb.collection("alerts").add({
        recipientUid: uid,
        type: "new_game",
        gameId: matchId,
        gameCourtId: data.courtId ?? "",
        gameSport: sport,
        gameFormat: data.format,
        gameStartAt: data.startAt,
        gameCourtName: data.courtName ?? "",
        hostName: data.hostName,
        spotsOpen,
        read: false,
        createdAt: new Date(),
      }),
      alertDb.collection("events").add({
        eventName: "notification_sent",
        uid,
        matchId,
        alertType: "new_game",
        timestamp: new Date(),
      }),
    ]);
  }
}
