import { addDoc, collection, doc, getDoc, Timestamp } from "firebase/firestore";
import { REPORT_WINDOW_MINUTES } from "../utils/activity";
import { auth, db } from "./firebase";

async function signedInUid(): Promise<string | null> {
  await auth.authStateReady();
  return auth.currentUser?.uid ?? null;
}

async function logEvent(
  eventName: string,
  fields: Record<string, unknown> = {},
): Promise<void> {
  const uid = await signedInUid();
  if (!uid) {
    return;
  }
  await addDoc(collection(db, "events"), {
    eventName,
    uid,
    ...fields,
    timestamp: Timestamp.now(),
  });
}

async function currentReport(courtId: string): Promise<number | null> {
  const snapshot = await getDoc(doc(db, "courtStatus", courtId));
  const data = snapshot.data();
  if (
    !data ||
    typeof data.playerCount !== "number" ||
    !(data.reportedAt instanceof Timestamp) ||
    Date.now() - data.reportedAt.toMillis() > REPORT_WINDOW_MINUTES * 60_000
  ) {
    return null;
  }
  return data.playerCount;
}

export const EventService = {
  async recordCourtView(courtId: string): Promise<void> {
    if (!(await signedInUid())) {
      return;
    }
    await logEvent("court_viewed", {
      courtId,
      reportedCount: await currentReport(courtId),
    });
  },

  async recordTrustRating(
    courtId: string,
    rating: number,
    liveCount: number,
  ): Promise<void> {
    await logEvent("trust_rating", { courtId, rating, liveCount });
  },

  async recordTrustSkipped(courtId: string, liveCount: number): Promise<void> {
    await logEvent("trust_skipped", { courtId, liveCount });
  },

  async recordFeedbackSkipped(): Promise<void> {
    await logEvent("feedback_skipped");
  },
};
