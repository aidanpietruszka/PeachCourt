import {
  collection,
  doc,
  onSnapshot,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "./firebase";
import type { Court } from "../types/types";

export const CourtService = {
  subscribeToCourts(
    onChange: (courts: Court[]) => void,
    onError: (error: Error) => void,
  ): Unsubscribe {
    return onSnapshot(
      collection(db, "courts"),
      (snapshot) => {
        onChange(
          snapshot.docs.map((court) => ({
            ...(court.data() as Court),
            id: court.id,
          })),
        );
      },
      onError,
    );
  },

  subscribeToCourt(
    courtId: string,
    onChange: (court: Court | null) => void,
    onError: (error: Error) => void,
  ): Unsubscribe {
    return onSnapshot(
      doc(db, "courts", courtId),
      (snapshot) => {
        onChange(
          snapshot.exists()
            ? { ...(snapshot.data() as Court), id: snapshot.id }
            : null,
        );
      },
      onError,
    );
  },
};
