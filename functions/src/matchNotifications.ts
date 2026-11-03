type AlertDb = {
  collection: (name: string) => { add: (data: Record<string, unknown>) => Promise<unknown> };
};

export async function handleMatchUpdated(
  matchId: string,
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  db: AlertDb,
): Promise<void> {
  const beforeRemoved = (before.removedUids as string[]) ?? [];
  const afterRemoved = (after.removedUids as string[]) ?? [];

  if (afterRemoved.length > beforeRemoved.length) {
    const removedUid = afterRemoved.find((uid) => !beforeRemoved.includes(uid));
    if (removedUid) {
      await db.collection("alerts").add({
        recipientUid: removedUid,
        type: "player_removed",
        gameId: matchId,
        gameSport: after.sport,
        gameFormat: after.format,
        gameStartAt: after.startAt,
        gameCourtName: after.courtName ?? "",
        actorName: after.hostName,
        read: false,
      });
    }
    return;
  }

  const beforePlayers = (before.playerUids as string[]) ?? [];
  const afterPlayers = (after.playerUids as string[]) ?? [];

  if (afterPlayers.length < beforePlayers.length && before.hostUid === after.hostUid) {
    const leftUid = beforePlayers.find((uid) => !afterPlayers.includes(uid));
    const leftIndex = leftUid !== undefined ? beforePlayers.indexOf(leftUid) : -1;
    const leftName =
      leftIndex >= 0 ? (before.playerNames as string[])[leftIndex] : "A player";
    await db.collection("alerts").add({
      recipientUid: before.hostUid,
      type: "player_left",
      gameId: matchId,
      gameSport: before.sport,
      gameFormat: before.format,
      gameStartAt: before.startAt,
      gameCourtName: before.courtName ?? "",
      actorName: leftName,
      read: false,
    });
    return;
  }

  if (before.hostUid !== after.hostUid) {
    await db.collection("alerts").add({
      recipientUid: after.hostUid,
      type: "host_transferred",
      gameId: matchId,
      gameSport: after.sport,
      gameFormat: after.format,
      gameStartAt: after.startAt,
      gameCourtName: after.courtName ?? "",
      actorName: before.hostName,
      read: false,
    });
  }
}

export async function handleMatchDeleted(
  matchId: string,
  data: Record<string, unknown>,
  db: AlertDb,
): Promise<void> {
  const playerUids = (data.playerUids as string[]) ?? [];
  for (const uid of playerUids) {
    await db.collection("alerts").add({
      recipientUid: uid,
      type: "game_deleted",
      gameId: matchId,
      gameSport: data.sport,
      gameFormat: data.format,
      gameStartAt: data.startAt,
      gameCourtName: data.courtName ?? "",
      actorName: data.hostName,
      read: false,
    });
  }
}
