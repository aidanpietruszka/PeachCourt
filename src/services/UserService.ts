import {
  doc,
  getDoc,
  onSnapshot,
  runTransaction,
  setDoc,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "./firebase";
import type { CheckinVariant, UserProfile } from "../types/types";
import { isCheckinVariant, pickCheckinVariant } from "../utils/abTest";
import { SKILL_LEVELS } from "../utils/skill";

export const TENNIS_SKILL_LEVELS = SKILL_LEVELS.tennis;
export const PICKLEBALL_SKILL_LEVELS = SKILL_LEVELS.pickleball;

export const UserService = {
  async saveProfile(uid: string, profile: UserProfile): Promise<void> {
    await setDoc(
      doc(db, "users", uid),
      {
        firstName: profile.firstName,
        lastName: profile.lastName,
        sports: profile.sports,
        skillLevels: profile.skillLevels,
      },
      { merge: true },
    );
  },

  async assignCheckinVariant(uid: string): Promise<CheckinVariant> {
    const ref = doc(db, "users", uid);
    return runTransaction(db, async (transaction) => {
      const existing = (await transaction.get(ref)).data()?.checkinVariant;
      if (isCheckinVariant(existing)) {
        return existing;
      }
      const variant = pickCheckinVariant();
      transaction.set(ref, { checkinVariant: variant }, { merge: true });
      return variant;
    });
  },

  async saveOnboardingPrefs(
    uid: string,
    prefs: Partial<Pick<UserProfile, "locationEnabled" | "autoCheckin" | "notificationsEnabled" | "notificationsPrompted" | "onboardingDone">>,
  ): Promise<void> {
    await setDoc(doc(db, "users", uid), prefs, { merge: true });
  },

  async saveSettings(
    uid: string,
    settings: Partial<Pick<UserProfile, "locationEnabled" | "autoCheckin" | "notificationsEnabled" | "newGamesAlert" | "changesGamesAlert" | "gameRemindersAlert" | "chatMessagesAlert">>,
  ): Promise<void> {
    await setDoc(doc(db, "users", uid), settings, { merge: true });
  },

  async getProfile(uid: string): Promise<UserProfile | null> {
    const snap = await getDoc(doc(db, "users", uid));
    if (!snap.exists()) {
      return null;
    }
    const data = snap.data();
    return {
      firstName: data.firstName ?? "",
      lastName: data.lastName ?? "",
      sports: data.sports ?? [],
      skillLevels: data.skillLevels ?? {},
      locationEnabled: data.locationEnabled,
      autoCheckin: data.autoCheckin,
      checkinVariant: isCheckinVariant(data.checkinVariant)
        ? data.checkinVariant
        : undefined,
      notificationsEnabled: data.notificationsEnabled,
      notificationsPrompted: data.notificationsPrompted,
      onboardingDone: data.onboardingDone,
      newGamesAlert: data.newGamesAlert,
      changesGamesAlert: data.changesGamesAlert,
      gameRemindersAlert: data.gameRemindersAlert,
      chatMessagesAlert: data.chatMessagesAlert,
    };
  },

  async deleteAccount(): Promise<void> {
    await httpsCallable(functions, "deleteAccount")();
  },

  subscribeToProfile(
    uid: string,
    onChange: (profile: UserProfile | null) => void,
    onError: (error: Error) => void,
  ): () => void {
    return onSnapshot(
      doc(db, "users", uid),
      (snap) => {
        if (!snap.exists()) {
          onChange(null);
          return;
        }
        const data = snap.data();
        onChange({
          firstName: data.firstName ?? "",
          lastName: data.lastName ?? "",
          sports: data.sports ?? [],
          skillLevels: data.skillLevels ?? {},
          locationEnabled: data.locationEnabled,
          autoCheckin: data.autoCheckin,
          checkinVariant: isCheckinVariant(data.checkinVariant)
            ? data.checkinVariant
            : undefined,
          notificationsEnabled: data.notificationsEnabled,
          notificationsPrompted: data.notificationsPrompted,
          onboardingDone: data.onboardingDone,
          newGamesAlert: data.newGamesAlert,
          changesGamesAlert: data.changesGamesAlert,
          gameRemindersAlert: data.gameRemindersAlert,
          chatMessagesAlert: data.chatMessagesAlert,
        });
      },
      onError,
    );
  },
};
