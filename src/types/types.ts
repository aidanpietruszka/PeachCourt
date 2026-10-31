import type { Timestamp } from "firebase/firestore";

export type Sport = "pickleball" | "tennis";

export interface OpeningHours {
  days: string;
  open: string;
  close: string;
}

export interface Court {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  tennisCourts: number | null;
  pickleballCourts: number | null;
  pickleballLines: boolean | null;
  surfaces: string[] | null;
  hasLights: boolean | null;
  openingHours: OpeningHours[] | null;
  walkOnRules: string | null;
  reservationInfo: string | null;
}

export interface UserProfile {
  firstName: string;
  lastName: string;
  sports: Sport[];
  skillLevels: Partial<Record<Sport, number>>;
}

export type MatchFormat = "singles" | "doubles";

export type SkillLevel = number | "any";

export interface Match {
  id: string;
  courtId: string;
  courtName?: string;
  sport: Sport;
  hostUid: string;
  hostName: string;
  format: MatchFormat;
  startAt: Timestamp;
  skillLevel: SkillLevel;
  spotsTotal: number;
  playerUids: string[];
  playerNames: string[];
  status: "open" | "full";
  createdAt: Timestamp;
}
