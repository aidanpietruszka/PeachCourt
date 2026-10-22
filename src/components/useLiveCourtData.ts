import { useEffect, useMemo, useState } from "react";
import {
  collection,
  onSnapshot,
  query,
  Timestamp,
  where,
  type DocumentData,
} from "firebase/firestore";
import { db } from "../services/firebase";
import { isValidSkill } from "../utils/skill";
import { useAuth } from "./useAuth";

export const REPORT_WINDOW_MINUTES = 120;

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

interface CourtReport {
  courtId: string;
  playerCount: number;
  reportedAt: Timestamp;
}

export function useLiveCourtData(): Record<string, CourtActivity> {
  const { user } = useAuth();
  const [checkins, setCheckins] = useState<DocumentData[]>([]);
  const [reports, setReports] = useState<CourtReport[]>([]);
  const [matches, setMatches] = useState<DocumentData[]>([]);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!user) {
      setCheckins([]);
      return;
    }
    return onSnapshot(
      query(collection(db, "checkins"), where("active", "==", true)),
      (snapshot) => setCheckins(snapshot.docs.map((item) => item.data())),
      (error) => console.error("Unable to load live check-ins", error),
    );
  }, [user]);

  useEffect(() => {
    if (!user) {
      setReports([]);
      return;
    }
    return onSnapshot(
      collection(db, "courtStatus"),
      (snapshot) =>
        setReports(
          snapshot.docs.flatMap((item) => {
            const data = item.data();
            return typeof data.playerCount === "number" &&
              data.reportedAt instanceof Timestamp
              ? [
                  {
                    courtId: item.id,
                    playerCount: data.playerCount,
                    reportedAt: data.reportedAt,
                  },
                ]
              : [];
          }),
        ),
      (error) => console.error("Unable to load player reports", error),
    );
  }, [user]);

  useEffect(() => {
    if (!user) {
      setMatches([]);
      return;
    }
    return onSnapshot(
      query(collection(db, "matches"), where("startAt", ">", Timestamp.now())),
      (snapshot) => setMatches(snapshot.docs.map((item) => item.data())),
      (error) => console.error("Unable to load open games", error),
    );
  }, [user]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  return useMemo(() => {
    const activity: Record<string, CourtActivity> = {};
    const entryFor = (courtId: string) => {
      activity[courtId] ??= { ...EMPTY_ACTIVITY };
      return activity[courtId];
    };

    checkins.forEach((checkin) => {
      const arrival =
        checkin.scheduledArrivalAt instanceof Timestamp
          ? checkin.scheduledArrivalAt
          : checkin.checkedInAt;
      if (
        typeof checkin.courtId !== "string" ||
        !(arrival instanceof Timestamp) ||
        !(checkin.expiresAt instanceof Timestamp) ||
        arrival.toMillis() > now ||
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
  }, [checkins, reports, matches, now]);
}
