export type AlertDb = {
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
        gameCourtId: after.courtId ?? "",
        gameSport: after.sport,
        gameFormat: after.format,
        gameStartAt: after.startAt,
        gameCourtName: after.courtName ?? "",
        actorName: after.hostName,
        read: false,
        createdAt: new Date(),
      });
    }
    return;
  }

  const beforePlayers = (before.playerUids as string[]) ?? [];
  const afterPlayers = (after.playerUids as string[]) ?? [];

  if (afterPlayers.length > beforePlayers.length) {
    const joinedUid = afterPlayers.find((uid) => !beforePlayers.includes(uid));
    const joinedIndex = joinedUid !== undefined ? afterPlayers.indexOf(joinedUid) : -1;
    const joinedName =
      joinedIndex >= 0 ? (after.playerNames as string[])[joinedIndex] : "A player";
    await db.collection("alerts").add({
      recipientUid: after.hostUid,
      type: "player_joined",
      gameId: matchId,
      gameCourtId: after.courtId ?? "",
      gameSport: after.sport,
      gameFormat: after.format,
      gameStartAt: after.startAt,
      gameCourtName: after.courtName ?? "",
      actorName: joinedName,
      read: false,
      createdAt: new Date(),
    });
    return;
  }

  if (afterPlayers.length < beforePlayers.length && before.hostUid === after.hostUid) {
    const leftUid = beforePlayers.find((uid) => !afterPlayers.includes(uid));
    const leftIndex = leftUid !== undefined ? beforePlayers.indexOf(leftUid) : -1;
    const leftName =
      leftIndex >= 0 ? (before.playerNames as string[])[leftIndex] : "A player";
    await db.collection("alerts").add({
      recipientUid: before.hostUid,
      type: "player_left",
      gameId: matchId,
      gameCourtId: before.courtId ?? "",
      gameSport: before.sport,
      gameFormat: before.format,
      gameStartAt: before.startAt,
      gameCourtName: before.courtName ?? "",
      actorName: leftName,
      read: false,
      createdAt: new Date(),
    });
    return;
  }

  if (before.hostUid !== after.hostUid) {
    await db.collection("alerts").add({
      recipientUid: after.hostUid,
      type: "host_transferred",
      gameId: matchId,
      gameCourtId: after.courtId ?? "",
      gameSport: after.sport,
      gameFormat: after.format,
      gameStartAt: after.startAt,
      gameCourtName: after.courtName ?? "",
      actorName: before.hostName,
      read: false,
      createdAt: new Date(),
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
      gameCourtId: data.courtId ?? "",
      gameSport: data.sport,
      gameFormat: data.format,
      gameStartAt: data.startAt,
      gameCourtName: data.courtName ?? "",
      actorName: data.hostName,
      read: false,
      createdAt: new Date(),
    });
  }
}
