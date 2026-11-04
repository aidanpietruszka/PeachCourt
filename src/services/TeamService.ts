import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  Timestamp,
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

  async recordRealCount(courtId: string, playerCount: number): Promise<void> {
    const uid = await getUid();
    await addDoc(collection(db, "inPersonCounts"), {
      courtId,
      uid,
      playerCount,
      recordedAt: Timestamp.now(),
    });
  },
};
