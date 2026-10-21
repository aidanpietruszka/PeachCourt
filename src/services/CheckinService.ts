import { signInAnonymously } from 'firebase/auth';
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  runTransaction,
  Timestamp,
  type Unsubscribe,
} from 'firebase/firestore';
import { auth, db } from './firebase';

const CHECK_IN_DURATION_MS = 90 * 60 * 1000;

export interface ActiveCheckIn {
  checkinId: string;
  courtId: string;
  playerCount: number;
  expiresAt: Timestamp;
}

const activeCheckInRef = (uid: string) => doc(db, 'activeCheckins', uid);

async function getUid(): Promise<string> {
  await auth.authStateReady();
  if (auth.currentUser) {
    return auth.currentUser.uid;
  }

  const credential = await signInAnonymously(auth);
  return credential.user.uid;
}

export const CheckinService = {
  async checkIn(
    courtId: string,
    playerCount: number,
    distance: number | null,
    requestStartedAt: number,
  ): Promise<void> {
    const uid = await getUid();
    const activeRef = activeCheckInRef(uid);
    const newCheckinRef = doc(collection(db, 'checkins'));
    const checkInEventRef = doc(collection(db, 'events'));

    await runTransaction(db, async (transaction) => {
      const activeSnapshot = await transaction.get(activeRef);
      const previousCheckinId = activeSnapshot.data()?.checkinId as string | undefined;
      const previousRef = previousCheckinId ? doc(db, 'checkins', previousCheckinId) : null;
      const previousSnapshot = previousRef ? await transaction.get(previousRef) : null;
      const now = Date.now();
      const timeToCheckIn = Math.max(0, Math.round(performance.now() - requestStartedAt));
      const checkedInAt = Timestamp.fromMillis(now);
      const expiresAt = Timestamp.fromMillis(now + CHECK_IN_DURATION_MS);

      if (previousRef && previousSnapshot?.exists() && previousSnapshot.data().active) {
        const previous = previousSnapshot.data();
        const checkoutEventRef = doc(collection(db, 'events'));
        transaction.update(previousRef, {
          active: false,
          checkedOutAt: checkedInAt,
        });
        transaction.set(checkoutEventRef, {
          eventName: 'check_out',
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
        expiresAt,
      });
      transaction.set(checkInEventRef, {
        eventName: 'check_in',
        uid,
        courtId,
        timestamp: checkedInAt,
        timeToCheckIn,
        distance,
        playerCount,
      });
    });
  },

  async checkOut(): Promise<boolean> {
    const uid = await getUid();
    const activeRef = activeCheckInRef(uid);
    const checkOutEventRef = doc(collection(db, 'events'));

    return runTransaction(db, async (transaction) => {
      const activeSnapshot = await transaction.get(activeRef);
      if (!activeSnapshot.exists()) {
        return false;
      }

      const active = activeSnapshot.data();
      const checkinRef = doc(db, 'checkins', active.checkinId as string);
      const checkinSnapshot = await transaction.get(checkinRef);
      const checkedOutAt = Timestamp.now();

      if (checkinSnapshot.exists() && checkinSnapshot.data().active) {
        const checkin = checkinSnapshot.data();
        transaction.update(checkinRef, {
          active: false,
          checkedOutAt,
        });
        transaction.set(checkOutEventRef, {
          eventName: 'check_out',
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
        if (!data || !(data.expiresAt instanceof Timestamp) || data.expiresAt.toMillis() <= Date.now()) {
          onChange(null);
          return;
        }

        onChange({
          checkinId: data.checkinId as string,
          courtId: data.courtId as string,
          playerCount: data.playerCount as number,
          expiresAt: data.expiresAt,
        });
      },
      onError,
    );
  },

  async recordFeedback(answer: string): Promise<void> {
    const uid = await getUid();
    await addDoc(collection(db, 'events'), {
      eventName: 'checkin_feedback',
      uid,
      answer,
      timestamp: Timestamp.now(),
    });
  },
};
