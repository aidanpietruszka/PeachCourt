import {
  collection,
  doc,
  onSnapshot,
  Timestamp,
  writeBatch,
  type Unsubscribe,
} from "firebase/firestore";
import { auth, db } from "./firebase";

async function getUid(): Promise<string> {
  await auth.authStateReady();
  return auth.currentUser!.uid;
}

export const TeamService = {
  subscribeToIsTeamMember(
    uid: string,
    onChange: (isMember: boolean) => void,
    onError: (error: Error) => void,
  ): Unsubscribe {
    return onSnapshot(
      doc(db, "config", "teamAccounts"),
      (snapshot) => {
        const data = snapshot.data();
        const uids: unknown = data?.uids;
        onChange(Array.isArray(uids) && uids.includes(uid));
      },
      onError,
    );
  },

  async recordRealCount(
    courtId: string,
    playerCount: number,
    appPlayerCount: number | null,
  ): Promise<void> {
    const uid = await getUid();
    const now = Timestamp.now();
    const batch = writeBatch(db);
    batch.set(doc(collection(db, "inPersonCounts")), {
      courtId,
      uid,
      playerCount,
      recordedAt: now,
    });
    batch.set(doc(collection(db, "events")), {
      eventName: "in_person_count",
      uid,
      courtId,
      playerCount,
      appPlayerCount: appPlayerCount ?? null,
      timestamp: now,
    });
    await batch.commit();
  },
};
