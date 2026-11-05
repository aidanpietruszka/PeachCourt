import type { AlertDb } from "./matchNotifications";

export type ChatDb = {
  collection: (name: string) => {
    where: (
      field: string,
      op: string,
      value: unknown,
    ) => {
      get: () => Promise<{
        docs: Array<{ id: string; ref: { delete: () => Promise<unknown> } }>;
      }>;
    };
    doc: (id: string) => {
      set: (data: Record<string, unknown>) => Promise<unknown>;
      delete: () => Promise<unknown>;
      recursiveDelete?: () => Promise<unknown>;
    };
  };
  recursiveDelete: (ref: { path: string }) => Promise<unknown>;
  doc: (path: string) => { path: string };
};

export async function handleMessageCreated(
  matchId: string,
  msgData: Record<string, unknown>,
  chatData: Record<string, unknown>,
  db: AlertDb,
): Promise<void> {
  const senderUid = msgData.senderUid as string;
  const senderName = msgData.senderName as string;
  const playerUids = (chatData.playerUids as string[]) ?? [];

  for (const uid of playerUids) {
    if (uid === senderUid) continue;
    await db.collection("alerts").add({
      recipientUid: uid,
      type: "new_message",
      gameId: matchId,
      gameCourtId: chatData.courtId ?? "",
      gameSport: chatData.sport,
      gameFormat: chatData.format,
      gameStartAt: chatData.startAt,
      gameCourtName: chatData.courtName ?? "",
      actorName: senderName,
      read: false,
      createdAt: new Date(),
    });
  }
}

export const GAME_DURATION_MINUTES = 60;
export const CHAT_DELETION_DELAY_MINUTES = 60;

export function chatDeletionCutoffMillis(nowMs: number): number {
  return nowMs - (GAME_DURATION_MINUTES + CHAT_DELETION_DELAY_MINUTES) * 60_000;
}

export async function deleteExpiredChatsImpl(
  now: number,
  db: ChatDb,
): Promise<void> {
  const { Timestamp } = await import("firebase-admin/firestore");
  const cutoff = Timestamp.fromMillis(chatDeletionCutoffMillis(now));
  const snap = await db
    .collection("chats")
    .where("startAt", "<=", cutoff)
    .get();
  for (const docSnap of snap.docs) {
    await db.recursiveDelete(db.doc(`chats/${docSnap.id}`));
  }
}
