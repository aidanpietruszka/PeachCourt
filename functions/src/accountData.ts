export type DocRef = {
  delete: () => Promise<unknown>;
  update: (data: Record<string, unknown>) => Promise<unknown>;
  get: () => Promise<DocSnap>;
};

export type DocSnap = {
  ref: DocRef;
  data: () => Record<string, unknown>;
  exists?: boolean;
};

type Query = { get: () => Promise<{ docs: DocSnap[] }> };

type BatchLike = {
  delete: (ref: DocRef) => void;
  update: (ref: DocRef, data: Record<string, unknown>) => void;
  commit: () => Promise<unknown>;
};

export type DbLike = {
  collection: (name: string) => {
    where: (field: string, op: string, val: unknown) => Query;
    doc: (id: string) => DocRef;
    get?: () => Promise<{ docs: DocSnap[] }>;
  };
  collectionGroup: (name: string) => {
    where: (field: string, op: string, val: unknown) => Query;
    get?: () => Promise<{ docs: DocSnap[] }>;
  };
  recursiveDelete: (ref: DocRef) => Promise<unknown>;
  batch: () => BatchLike;
};

export type AuthLike = { deleteUser: (uid: string) => Promise<void> };

const BATCH_LIMIT = 500;

async function deleteInBatches(db: DbLike, docs: DocSnap[]): Promise<void> {
  for (let i = 0; i < docs.length; i += BATCH_LIMIT) {
    const batch = db.batch();
    for (const d of docs.slice(i, i + BATCH_LIMIT)) {
      batch.delete(d.ref);
    }
    await batch.commit();
  }
}

async function docsWhere(
  db: DbLike,
  collection: string,
  field: string,
  uid: string,
): Promise<DocSnap[]> {
  const snap = await db.collection(collection).where(field, "==", uid).get();
  return snap.docs;
}

export async function deleteUserData(uid: string, db: DbLike): Promise<void> {
  const hostedSnap = await db
    .collection("matches")
    .where("hostUid", "==", uid)
    .get();

  for (const d of hostedSnap.docs) {
    const playerUids: string[] = (d.data().playerUids as string[]) ?? [];
    const playerNames: string[] = (d.data().playerNames as string[]) ?? [];
    if (playerUids.length > 0) {
      await d.ref.update({
        hostUid: playerUids[0],
        hostName: playerNames[0] ?? "",
        playerUids: playerUids.slice(1),
        playerNames: playerNames.slice(1),
      });
    } else {
      await d.ref.delete();
    }
  }

  const joinedSnap = await db
    .collection("matches")
    .where("playerUids", "array-contains", uid)
    .get();

  for (const d of joinedSnap.docs) {
    const playerUids: string[] = (d.data().playerUids as string[]) ?? [];
    const playerNames: string[] = (d.data().playerNames as string[]) ?? [];
    const index = playerUids.indexOf(uid);
    if (index === -1) {
      continue;
    }
    await d.ref.update({
      playerUids: playerUids.filter((_, i) => i !== index),
      playerNames: playerNames.filter((_, i) => i !== index),
    });
  }

  await deleteInBatches(db, await docsWhere(db, "checkins", "uid", uid));
  await db.collection("activeCheckins").doc(uid).delete();

  await deleteInBatches(db, await docsWhere(db, "alerts", "recipientUid", uid));
  await deleteInBatches(db, await docsWhere(db, "events", "uid", uid));
  await deleteInBatches(db, await docsWhere(db, "clientErrors", "uid", uid));
  await deleteInBatches(db, await docsWhere(db, "inPersonCounts", "uid", uid));

  const messagesSnap = await db
    .collectionGroup("messages")
    .where("senderUid", "==", uid)
    .get();
  await deleteInBatches(db, messagesSnap.docs);

  const chatsSnap = await db
    .collection("chats")
    .where("memberUids", "array-contains", uid)
    .get();
  for (let i = 0; i < chatsSnap.docs.length; i += BATCH_LIMIT) {
    const batch = db.batch();
    for (const d of chatsSnap.docs.slice(i, i + BATCH_LIMIT)) {
      const data = d.data();
      const memberUids = ((data.memberUids as string[] | undefined) ?? []).filter(
        (id) => id !== uid,
      );
      const update: Record<string, unknown> = { memberUids };
      const readAt = data.readAt as Record<string, unknown> | undefined;
      if (readAt != null && uid in readAt) {
        const next = { ...readAt };
        delete next[uid];
        update.readAt = next;
      }
      if (data.lastSenderUid === uid) {
        update.lastMessage = null;
        update.lastSenderName = null;
        update.lastSenderUid = null;
      }
      batch.update(d.ref, update);
    }
    await batch.commit();
  }

  const teamRef = db.collection("config").doc("teamAccounts");
  const teamSnap = await teamRef.get();
  const teamUids = ((teamSnap.data() ?? {}).uids as string[] | undefined) ?? [];
  if (teamUids.includes(uid)) {
    await teamRef.update({ uids: teamUids.filter((id) => id !== uid) });
  }

  await db.recursiveDelete(db.collection("users").doc(uid));
}
