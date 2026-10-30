import { Timestamp, type DocumentData } from "firebase/firestore";
import { isValidSkill } from "./skill";

export const REPORT_WINDOW_MINUTES = 60;

export interface CourtActivity {
  checkedIn: number;
  reported: number | null;
  reportedAt: Date | null;
  openGames: number;
}

export const EMPTY_ACTIVITY: CourtActivity = {
  checkedIn: 0,
  reported: null,
  reportedAt: null,
  openGames: 0,
};

export interface CourtReport {
  courtId: string;
  playerCount: number;
  reportedAt: Timestamp;
}

export function summarizeActivity(
  checkins: DocumentData[],
  reports: CourtReport[],
  matches: DocumentData[],
  now: number,
): Record<string, CourtActivity> {
  const activity: Record<string, CourtActivity> = {};
  const entryFor = (courtId: string) => {
    activity[courtId] ??= { ...EMPTY_ACTIVITY };
    return activity[courtId];
  };

  checkins.forEach((checkin) => {
    if (
      typeof checkin.courtId !== "string" ||
      !(checkin.expiresAt instanceof Timestamp) ||
      checkin.expiresAt.toMillis() <= now
    ) {
      return;
    }
    entryFor(checkin.courtId).checkedIn += 1;
  });

  reports.forEach((report) => {
    if (now - report.reportedAt.toMillis() > REPORT_WINDOW_MINUTES * 60_000) {
      return;
    }
    const entry = entryFor(report.courtId);
    entry.reported = report.playerCount;
    entry.reportedAt = report.reportedAt.toDate();
  });

  matches.forEach((match) => {
    if (
      typeof match.courtId !== "string" ||
      !isValidSkill(match.sport, match.skillLevel) ||
      !(match.startAt instanceof Timestamp) ||
      match.startAt.toMillis() <= now ||
      !Array.isArray(match.playerUids) ||
      match.playerUids.length >= match.spotsTotal
    ) {
      return;
    }
    entryFor(match.courtId).openGames += 1;
  });

  return activity;
}
