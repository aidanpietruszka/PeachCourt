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
import {
  summarizeActivity,
  type CourtActivity,
  type CourtReport,
} from "../utils/activity";
import { useAuth } from "./useAuth";

export {
  EMPTY_ACTIVITY,
  REPORT_WINDOW_MINUTES,
  type CourtActivity,
} from "../utils/activity";

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

  return useMemo(
    () => summarizeActivity(checkins, reports, matches, now),
    [checkins, reports, matches, now],
  );
}
