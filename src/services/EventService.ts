import { addDoc, collection, Timestamp } from "firebase/firestore";
import { auth, db } from "./firebase";

export const EventService = {
  async recordTrustRating(
    courtId: string,
    rating: number,
    liveCount: number,
  ): Promise<void> {
    await auth.authStateReady();
    if (!auth.currentUser) {
      return;
    }
    await addDoc(collection(db, "events"), {
      eventName: "trust_rating",
      uid: auth.currentUser.uid,
      courtId,
      rating,
      liveCount,
      timestamp: Timestamp.now(),
    });
  },
};
