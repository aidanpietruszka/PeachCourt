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
import { useListenerError } from "./useListenerError";

export {
  EMPTY_ACTIVITY,
  REPORT_WINDOW_MINUTES,
  type CourtActivity,
} from "../utils/activity";

export function useLiveCourtData(): {
  activity: Record<string, CourtActivity>;
  error: boolean;
  retry: () => void;
} {
  const { user } = useAuth();
  const [checkins, setCheckins] = useState<DocumentData[]>([]);
  const [reports, setReports] = useState<CourtReport[]>([]);
  const [matches, setMatches] = useState<DocumentData[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const { errored, retryKey, handleError, retry } =
    useListenerError("live-court-data");

  useEffect(() => {
    if (!user) {
      setCheckins([]);
      return;
    }
    return onSnapshot(
      query(collection(db, "checkins"), where("active", "==", true)),
      (snapshot) => setCheckins(snapshot.docs.map((item) => item.data())),
      handleError,
    );
  }, [user, retryKey, handleError]);

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
      handleError,
    );
  }, [user, retryKey, handleError]);

  useEffect(() => {
    if (!user) {
      setMatches([]);
      return;
    }
    return onSnapshot(
      query(collection(db, "matches"), where("startAt", ">", Timestamp.now())),
      (snapshot) => setMatches(snapshot.docs.map((item) => item.data())),
      handleError,
    );
  }, [user, retryKey, handleError]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const activity = useMemo(
    () => summarizeActivity(checkins, reports, matches, now),
    [checkins, reports, matches, now],
  );

  return { activity, error: errored, retry };
}
