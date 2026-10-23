import type { Timestamp } from "firebase/firestore";

export type Sport = "pickleball" | "tennis";

export interface Court {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  sports: Sport[];
  numberOfCourts: number;
  surface: string;
  hasLights: boolean | null;
  hours: string;
  walkOnRules: string;
  reservationInfo: string;
}

export type MatchFormat = "singles" | "doubles";

export type SkillLevel = number | "any";

export interface Match {
  id: string;
  courtId: string;
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
