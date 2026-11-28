import { onCall, HttpsError } from "firebase-functions/v2/https";
import { deleteUserData, type DbLike, type AuthLike } from "./accountData";

export async function handleDeleteAccount(
  uid: string,
  db: DbLike,
  adminAuth: AuthLike,
): Promise<void> {
  await deleteUserData(uid, db);
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
