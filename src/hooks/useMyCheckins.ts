import { useEffect, useState } from "react";
import { collection, documentId, getDocs, query, where } from "firebase/firestore";
import { db } from "../services/firebase";
import { CheckinService, type PastCheckin } from "../services/CheckinService";

export interface CheckinWithCourt extends PastCheckin {
  courtName: string;
}

export function useMyCheckins(uid: string | null): CheckinWithCourt[] {
  const [checkins, setCheckins] = useState<CheckinWithCourt[]>([]);

  useEffect(() => {
    if (!uid) {
      setCheckins([]);
      return;
    }
    return CheckinService.subscribeToMyCheckins(
      uid,
      (raw) => {
        if (raw.length === 0) {
          setCheckins([]);
          return;
        }
        const uniqueIds = [...new Set(raw.map((c) => c.courtId))];
        const chunks: string[][] = [];
        for (let i = 0; i < uniqueIds.length; i += 10) {
          chunks.push(uniqueIds.slice(i, i + 10));
        }
        Promise.all(
          chunks.map((chunk) =>
            getDocs(
              query(collection(db, "courts"), where(documentId(), "in", chunk)),
            ),
          ),
        )
          .then((snaps) => {
            const nameMap: Record<string, string> = {};
            snaps.forEach((snap) =>
              snap.forEach((d) => {
                nameMap[d.id] = (d.data().name as string) ?? d.id;
              }),
            );
            setCheckins(
              raw.map((c) => ({ ...c, courtName: nameMap[c.courtId] ?? c.courtId })),
            );
          })
          .catch((err: unknown) => {
            console.error("Unable to load court names", err);
          });
      },
      (err) => {
        console.error("Unable to load check-ins", err);
      },
    );
  }, [uid]);

  return checkins;
}
