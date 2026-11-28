import { deleteUserData, type DbLike } from "./accountData";

type CleanupAuth = { getUser: (uid: string) => Promise<unknown> };

async function authAccountExists(
  uid: string,
  adminAuth: CleanupAuth,
): Promise<boolean> {
  try {
    await adminAuth.getUser(uid);
    return true;
  } catch {
    return false;
  }
}

export async function cleanupDeletedAccount(
  uid: string,
  db: DbLike,
  adminAuth: CleanupAuth,
): Promise<boolean> {
  const userSnap = await db.collection("users").doc(uid).get();
  if (userSnap.exists) {
    return false;
  }
  if (await authAccountExists(uid, adminAuth)) {
    return false;
  }
  await deleteUserData(uid, db);
  return true;
}

const CANDIDATE_SOURCES: Array<{ collection: string; field: string }> = [
  { collection: "events", field: "uid" },
  { collection: "alerts", field: "recipientUid" },
  { collection: "clientErrors", field: "uid" },
  { collection: "inPersonCounts", field: "uid" },
];

export async function findCandidateUids(db: DbLike): Promise<string[]> {
  const uids = new Set<string>();
  for (const source of CANDIDATE_SOURCES) {
    const snap = await db.collection(source.collection).get?.();
    for (const d of snap?.docs ?? []) {
      const value = d.data()[source.field];
      if (typeof value === "string" && value) uids.add(value);
    }
  }
  const messagesSnap = await db.collectionGroup("messages").get?.();
  for (const d of messagesSnap?.docs ?? []) {
    const value = d.data().senderUid;
    if (typeof value === "string" && value) uids.add(value);
  }
  return [...uids];
}

export async function cleanupDeletedAccounts(
  db: DbLike,
  adminAuth: CleanupAuth,
): Promise<{ scanned: number; cleaned: number }> {
  const candidates = await findCandidateUids(db);
  let cleaned = 0;
  for (const uid of candidates) {
    if (await cleanupDeletedAccount(uid, db, adminAuth)) {
      cleaned += 1;
    }
  }
  return { scanned: candidates.length, cleaned };
}
