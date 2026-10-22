import {
  collection,
  doc,
  onSnapshot,
  query,
  runTransaction,
  Timestamp,
  where,
  writeBatch,
  type Unsubscribe,
} from "firebase/firestore";
import { auth, db } from "./firebase";
import type { Match, MatchFormat, SkillLevel, Sport } from "../types/types";
import { isValidSkill } from "../utils/skill";

export const SPOTS_BY_FORMAT: Record<MatchFormat, number> = {
  singles: 1,
  doubles: 3,
};

async function currentUid(): Promise<string> {
  await auth.authStateReady();
  if (!auth.currentUser) {
    throw new Error("Sign in to use the match board.");
  }
  return auth.currentUser.uid;
}

export const MatchService = {
  subscribeToCourtMatches(
    courtId: string,
    onChange: (matches: Match[]) => void,
    onError: (error: Error) => void,
  ): Unsubscribe {
    return onSnapshot(
      query(collection(db, "matches"), where("courtId", "==", courtId)),
      (snapshot) => {
        onChange(
          snapshot.docs
            .map((match) => ({
              ...(match.data() as Omit<Match, "id">),
              id: match.id,
            }))
            .filter((match) => isValidSkill(match.sport, match.skillLevel)),
        );
      },
      onError,
    );
  },

  async postMatch(
    courtId: string,
    sport: Sport,
    hostName: string,
    format: MatchFormat,
    startAt: Date,
    skillLevel: SkillLevel,
  ): Promise<void> {
    if (!isValidSkill(sport, skillLevel)) {
      throw new Error("Choose a valid skill level.");
    }
    const uid = await currentUid();
    const matchRef = doc(collection(db, "matches"));
    const eventRef = doc(collection(db, "events"));
    const now = Timestamp.now();
    const spotsTotal = SPOTS_BY_FORMAT[format];
    const batch = writeBatch(db);

    batch.set(matchRef, {
      courtId,
      sport,
      hostUid: uid,
      hostName,
      format,
      startAt: Timestamp.fromDate(startAt),
      skillLevel,
      spotsTotal,
      playerUids: [],
      playerNames: [],
      status: "open",
      createdAt: now,
    });
    batch.set(eventRef, {
      eventName: "match_posted",
      uid,
      courtId,
      matchId: matchRef.id,
      sport,
      format,
      skillLevel,
      spotsTotal,
      timestamp: now,
    });

    await batch.commit();
  },

  async joinMatch(matchId: string, playerName: string): Promise<void> {
    const uid = await currentUid();
    const matchRef = doc(db, "matches", matchId);
    const eventRef = doc(collection(db, "events"));

    await runTransaction(db, async (transaction) => {
      const snapshot = await transaction.get(matchRef);
      if (!snapshot.exists()) {
        throw new Error("This game no longer exists.");
      }

      const match = snapshot.data() as Omit<Match, "id">;
      if (match.hostUid === uid) {
        throw new Error("You can't join your own game.");
      }
      if (match.playerUids.includes(uid)) {
        throw new Error("You've already joined this game.");
      }
      if (match.playerUids.length >= match.spotsTotal) {
        throw new Error("This game is full.");
      }
      if (match.startAt.toMillis() <= Date.now()) {
        throw new Error("This game has already started.");
      }

      const now = Timestamp.now();
      const playerUids = [...match.playerUids, uid];
      const playerNames = [...match.playerNames, playerName];

      transaction.update(matchRef, {
        playerUids,
        playerNames,
        status: playerUids.length >= match.spotsTotal ? "full" : "open",
      });
      transaction.set(eventRef, {
        eventName: "match_joined",
        uid,
        courtId: match.courtId,
        matchId,
        minutesToJoin: Math.max(
          0,
          Math.round((now.toMillis() - match.createdAt.toMillis()) / 60_000),
        ),
        timestamp: now,
      });
    });
  },

  async leaveMatch(matchId: string): Promise<void> {
    const uid = await currentUid();
    const matchRef = doc(db, "matches", matchId);

    await runTransaction(db, async (transaction) => {
      const snapshot = await transaction.get(matchRef);
      if (!snapshot.exists()) {
        throw new Error("This game no longer exists.");
      }

      const match = snapshot.data() as Omit<Match, "id">;
      const index = match.playerUids.indexOf(uid);
      if (index === -1) {
        throw new Error("You're not in this game.");
      }
      if (match.startAt.toMillis() <= Date.now()) {
        throw new Error("This game has already started.");
      }

      transaction.update(matchRef, {
        playerUids: match.playerUids.filter(
          (_, position) => position !== index,
        ),
        playerNames: match.playerNames.filter(
          (_, position) => position !== index,
        ),
        status: "open",
      });
    });
  },
};
