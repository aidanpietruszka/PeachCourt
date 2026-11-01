import { onCall, HttpsError } from "firebase-functions/v2/https";
import { FieldValue } from "firebase-admin/firestore";

type DocRef = {
  delete: () => Promise<unknown>;
  update: (data: Record<string, unknown>) => Promise<unknown>;
};

type DocSnap = { ref: DocRef; data: () => Record<string, unknown> };

type DbLike = {
  collection: (name: string) => {
    where: (
      field: string,
      op: string,
      val: unknown,
    ) => { get: () => Promise<{ docs: DocSnap[] }> };
    doc: (id: string) => DocRef;
  };
};

type AuthLike = { deleteUser: (uid: string) => Promise<void> };

export async function handleDeleteAccount(
  uid: string,
  db: DbLike,
  adminAuth: AuthLike,
): Promise<void> {
  const hostedSnap = await db
    .collection("matches")
    .where("hostUid", "==", uid)
    .get();

  for (const d of hostedSnap.docs) {
    const playerUids: string[] = (d.data().playerUids as string[]) ?? [];
    if (playerUids.length > 0) {
      await d.ref.update({
        hostUid: playerUids[0],
        playerUids: FieldValue.arrayRemove(playerUids[0]),
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
    await d.ref.update({ playerUids: FieldValue.arrayRemove(uid) });
  }

  const checkinsSnap = await db
    .collection("checkins")
    .where("uid", "==", uid)
    .get();

  for (const d of checkinsSnap.docs) {
    await d.ref.delete();
  }

  await db.collection("activeCheckins").doc(uid).delete();
  await db.collection("users").doc(uid).delete();
  await adminAuth.deleteUser(uid);
}

export const deleteAccount = onCall(
  { region: "us-east1" },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Must be signed in.");
    }
    const { getAuth } = await import("firebase-admin/auth");
    const { getFirestore } = await import("firebase-admin/firestore");
    await handleDeleteAccount(
      request.auth.uid,
      getFirestore() as unknown as DbLike,
      getAuth() as unknown as AuthLike,
    );
  },
);
