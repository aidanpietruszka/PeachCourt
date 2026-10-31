import {
  doc,
  getDoc,
  onSnapshot,
  setDoc,
} from "firebase/firestore";
import { db } from "./firebase";
import type { UserProfile } from "../types/types";
import { SKILL_LEVELS } from "../utils/skill";

export const TENNIS_SKILL_LEVELS = SKILL_LEVELS.tennis;
export const PICKLEBALL_SKILL_LEVELS = SKILL_LEVELS.pickleball;

export const UserService = {
  async saveProfile(uid: string, profile: UserProfile): Promise<void> {
    await setDoc(doc(db, "users", uid), {
      firstName: profile.firstName,
      lastName: profile.lastName,
      sports: profile.sports,
      skillLevels: profile.skillLevels,
    });
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
    };
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
        });
      },
      onError,
    );
  },
};
