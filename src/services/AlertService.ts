import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import type { Timestamp } from "firebase/firestore";
import { db } from "./firebase";
import type { Sport, MatchFormat } from "../types/types";

export type AlertType =
  | "new_game"
  | "game_reminder"
  | "new_message"
  | "player_joined"
  | "player_left"
  | "player_removed"
  | "host_transferred"
  | "game_deleted";

export interface Alert {
  id: string;
  recipientUid: string;
  type: AlertType;
  gameId?: string;
  gameCourtId?: string;
  gameSport?: Sport;
  gameFormat?: MatchFormat;
  gameStartAt?: Timestamp;
  gameCourtName?: string;
  actorName?: string;
  hostName?: string;
  spotsOpen?: number;
  read: boolean;
  createdAt: Timestamp;
}

export const AlertService = {
  subscribeToAlerts(
    uid: string,
    onChange: (alerts: Alert[]) => void,
    onError: (err: Error) => void,
  ): () => void {
    const q = query(
      collection(db, "alerts"),
      where("recipientUid", "==", uid),
      orderBy("createdAt", "desc"),
      limit(100),
    );
    return onSnapshot(
      q,
      (snap) => {
        onChange(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Alert));
      },
      onError,
    );
  },

  async markRead(alertId: string): Promise<void> {
    await updateDoc(doc(db, "alerts", alertId), { read: true });
  },

  async markAllRead(unreadAlerts: Alert[]): Promise<void> {
    if (unreadAlerts.length === 0) return;
    const batch = writeBatch(db);
    for (const a of unreadAlerts) {
      batch.update(doc(db, "alerts", a.id), { read: true });
    }
    await batch.commit();
  },
};
