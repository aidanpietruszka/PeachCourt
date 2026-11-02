import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  Timestamp,
  writeBatch,
  type Unsubscribe,
} from "firebase/firestore";
import { auth, db } from "./firebase";
import { CROWD_RANGE_MINS } from "../utils/crowdRange";

const ALLOWED_DURATIONS_MINUTES = [30, 60] as const;

export interface ActiveCheckIn {
  checkinId: string;
  courtId: string;
  playerCount: number;
  expiresAt: Timestamp;
  scheduledArrivalAt: Timestamp;
  durationMinutes: number;
  method?: string;
}

const activeCheckInRef = (uid: string) => doc(db, "activeCheckins", uid);

async function getUid(): Promise<string> {
  await auth.authStateReady();
  return auth.currentUser!.uid;
}

export const CheckinService = {
  async checkIn(
    courtId: string,
    playerCount: number,
    distance: number | null,
    requestStartedAt: number,
    requestedArrivalAt: number,
    durationMinutes: number,
  ): Promise<void> {
    if (
      !ALLOWED_DURATIONS_MINUTES.includes(
        durationMinutes as (typeof ALLOWED_DURATIONS_MINUTES)[number],
      )
    ) {
      throw new Error("Choose a valid check-in duration.");
    }
    if (!CROWD_RANGE_MINS.includes(playerCount as (typeof CROWD_RANGE_MINS)[number])) {
      throw new Error("Choose a valid number of players.");
    }
    if (!Number.isFinite(requestedArrivalAt) || requestedArrivalAt < 0) {
      throw new Error("Choose a valid arrival time.");
    }

    const uid = await getUid();
    const activeRef = activeCheckInRef(uid);
    const newCheckinRef = doc(collection(db, "checkins"));
    const checkInEventRef = doc(collection(db, "events"));

    await runTransaction(db, async (transaction) => {
      const activeSnapshot = await transaction.get(activeRef);
      const previousCheckinId = activeSnapshot.data()?.checkinId as
        | string
        | undefined;
      const previousRef = previousCheckinId
        ? doc(db, "checkins", previousCheckinId)
        : null;
      const previousSnapshot = previousRef
        ? await transaction.get(previousRef)
        : null;
      const now = Date.now();
      const timeToCheckIn = Math.max(
        0,
        Math.round(performance.now() - requestStartedAt),
      );
      const checkedInAt = Timestamp.fromMillis(now);
      const scheduledArrivalAt = Timestamp.fromMillis(
        Math.max(now, requestedArrivalAt),
      );
      const expiresAt = Timestamp.fromMillis(
        scheduledArrivalAt.toMillis() + durationMinutes * 60 * 1000,
      );

      if (
        previousRef &&
        previousSnapshot?.exists() &&
        previousSnapshot.data().active
      ) {
        const previous = previousSnapshot.data();
        const checkoutEventRef = doc(collection(db, "events"));
        transaction.update(previousRef, {
          active: false,
          checkedOutAt: checkedInAt,
        });
        transaction.set(checkoutEventRef, {
          eventName: "check_out",
          uid,
          courtId: previous.courtId,
          timestamp: checkedInAt,
          timeToCheckIn: previous.timeToCheckIn ?? null,
          distance: previous.distance ?? null,
        });
      }

      transaction.set(newCheckinRef, {
        courtId,
        uid,
        playerCount,
        checkedInAt,
        scheduledArrivalAt,
        durationMinutes,
        expiresAt,
        distance,
        timeToCheckIn,
        active: true,
      });
      transaction.set(activeRef, {
        checkinId: newCheckinRef.id,
        uid,
        courtId,
        playerCount,
        checkedInAt,
        scheduledArrivalAt,
        durationMinutes,
        expiresAt,
      });
      transaction.set(doc(db, "courtStatus", courtId), {
        playerCount,
        reportedBy: uid,
        reportedAt: serverTimestamp(),
      });
      transaction.set(checkInEventRef, {
        eventName: "check_in",
        uid,
        courtId,
        timestamp: checkedInAt,
        scheduledArrivalAt,
        durationMinutes,
        timeToCheckIn,
        distance,
        playerCount,
      });
    });
  },

  async checkOut(): Promise<boolean> {
    const uid = await getUid();
    const activeRef = activeCheckInRef(uid);
    const checkOutEventRef = doc(collection(db, "events"));

    return runTransaction(db, async (transaction) => {
      const activeSnapshot = await transaction.get(activeRef);
      if (!activeSnapshot.exists()) {
        return false;
      }

      const active = activeSnapshot.data();
      const checkinRef = doc(db, "checkins", active.checkinId as string);
      const checkinSnapshot = await transaction.get(checkinRef);
      const checkedOutAt = Timestamp.now();

      if (checkinSnapshot.exists() && checkinSnapshot.data().active) {
        const checkin = checkinSnapshot.data();
        transaction.update(checkinRef, {
          active: false,
          checkedOutAt,
        });
        transaction.set(checkOutEventRef, {
          eventName: "check_out",
          uid,
          courtId: checkin.courtId,
          timestamp: checkedOutAt,
          timeToCheckIn: checkin.timeToCheckIn ?? null,
          distance: checkin.distance ?? null,
        });
      }

      transaction.delete(activeRef);
      return true;
    });
  },

  subscribeToActiveCheckIn(
    uid: string,
    onChange: (checkIn: ActiveCheckIn | null) => void,
    onError: (error: Error) => void,
  ): Unsubscribe {
    return onSnapshot(
      activeCheckInRef(uid),
      (snapshot) => {
        const data = snapshot.data();
        if (
          !data ||
          !(data.expiresAt instanceof Timestamp) ||
          data.expiresAt.toMillis() <= Date.now()
        ) {
          onChange(null);
          return;
        }

        onChange({
          checkinId: data.checkinId as string,
          courtId: data.courtId as string,
          playerCount: data.playerCount as number,
          expiresAt: data.expiresAt,
          scheduledArrivalAt:
            data.scheduledArrivalAt instanceof Timestamp
              ? data.scheduledArrivalAt
              : (data.checkedInAt as Timestamp),
          durationMinutes:
            typeof data.durationMinutes === "number"
              ? data.durationMinutes
              : 90,
          method: typeof data.method === "string" ? data.method : undefined,
        });
      },
      onError,
    );
  },

  async updateCount(courtId: string, playerCount: number): Promise<void> {
    const uid = await getUid();
    const batch = writeBatch(db);
    batch.set(doc(db, "courtStatus", courtId), {
      playerCount,
      reportedBy: uid,
      reportedAt: serverTimestamp(),
    });
    batch.set(doc(collection(db, "events")), {
      eventName: "count_updated",
      uid,
      courtId,
      playerCount,
      timestamp: Timestamp.now(),
    });
    await batch.commit();
  },

  async confirmStillHere(courtId: string, playerCount: number): Promise<void> {
    const uid = await getUid();
    const batch = writeBatch(db);
    batch.set(doc(db, "courtStatus", courtId), {
      playerCount,
      reportedBy: uid,
      reportedAt: serverTimestamp(),
    });
    batch.set(doc(collection(db, "events")), {
      eventName: "still_here_yes",
      uid,
      courtId,
      playerCount,
      timestamp: Timestamp.now(),
    });
    await batch.commit();
  },

  async stillHereSkipped(courtId: string): Promise<void> {
    const uid = await getUid();
    await addDoc(collection(db, "events"), {
      eventName: "still_here_skipped",
      uid,
      courtId,
      timestamp: Timestamp.now(),
    });
  },

  async autoCheckIn(courtId: string, distance: number | null): Promise<void> {
    const uid = await getUid();
    const activeRef = activeCheckInRef(uid);
    const newCheckinRef = doc(collection(db, "checkins"));
    const checkInEventRef = doc(collection(db, "events"));

    await runTransaction(db, async (transaction) => {
      const activeSnapshot = await transaction.get(activeRef);
      const previousCheckinId = activeSnapshot.data()?.checkinId as
        | string
        | undefined;
      const previousRef = previousCheckinId
        ? doc(db, "checkins", previousCheckinId)
        : null;
      const previousSnapshot = previousRef
        ? await transaction.get(previousRef)
        : null;

      const now = Date.now();
      const checkedInAt = Timestamp.fromMillis(now);
      const scheduledArrivalAt = checkedInAt;
      const durationMinutes = 60;
      const expiresAt = Timestamp.fromMillis(now + durationMinutes * 60 * 1000);

      if (
        previousRef &&
        previousSnapshot?.exists() &&
        previousSnapshot.data().active
      ) {
        const previous = previousSnapshot.data();
        const checkoutEventRef = doc(collection(db, "events"));
        transaction.update(previousRef, {
          active: false,
          checkedOutAt: checkedInAt,
        });
        transaction.set(checkoutEventRef, {
          eventName: "check_out",
          uid,
          courtId: previous.courtId,
          timestamp: checkedInAt,
          timeToCheckIn: previous.timeToCheckIn ?? null,
          distance: previous.distance ?? null,
        });
      }

      transaction.set(newCheckinRef, {
        courtId,
        uid,
        playerCount: 1,
        method: "auto",
        checkedInAt,
        scheduledArrivalAt,
        durationMinutes,
        expiresAt,
        distance,
        timeToCheckIn: 0,
        active: true,
      });
      transaction.set(activeRef, {
        checkinId: newCheckinRef.id,
        uid,
        courtId,
        playerCount: 1,
        method: "auto",
        checkedInAt,
        scheduledArrivalAt,
        durationMinutes,
        expiresAt,
      });
      transaction.set(checkInEventRef, {
        eventName: "check_in",
        uid,
        courtId,
        timestamp: checkedInAt,
        scheduledArrivalAt,
        durationMinutes,
        timeToCheckIn: 0,
        distance,
        playerCount: 1,
        method: "auto",
      });
    });
  },

  async recordFeedback(answer: string): Promise<void> {
    const uid = await getUid();
    await addDoc(collection(db, "events"), {
      eventName: "checkin_feedback",
      uid,
      answer,
      timestamp: Timestamp.now(),
    });
  },
};
