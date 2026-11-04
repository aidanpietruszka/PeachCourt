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

export type CheckinVariant = "auto_on" | "auto_off";

export interface UserProfile {
  firstName: string;
  lastName: string;
  sports: Sport[];
  skillLevels: Partial<Record<Sport, number>>;
  locationEnabled?: boolean;
  autoCheckin?: boolean;
  checkinVariant?: CheckinVariant;
  notificationsEnabled?: boolean;
  notificationsPrompted?: boolean;
  onboardingDone?: boolean;
  newGamesAlert?: boolean;
  changesGamesAlert?: boolean;
  gameRemindersAlert?: boolean;
  chatMessagesAlert?: boolean;
}

export interface Chat {
  id: string;
  matchId: string;
  courtId: string;
  courtName: string;
  format: MatchFormat;
  sport: Sport;
  startAt: Timestamp;
  hostUid: string;
  hostName: string;
  playerUids: string[];
  playerNames: string[];
  lastMessage: string | null;
  lastSenderName: string | null;
  lastSenderUid: string | null;
  lastMessageAt: Timestamp | null;
  readAt: Record<string, Timestamp>;
  createdAt: Timestamp;
}

export interface ChatMessage {
  id: string;
  text: string;
  senderUid: string;
  senderName: string;
  createdAt: Timestamp;
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
  removedUids: string[];
  status: "open" | "full";
  createdAt: Timestamp;
}
