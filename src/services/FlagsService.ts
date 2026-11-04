import { doc, onSnapshot, type Unsubscribe } from "firebase/firestore";
import { db } from "./firebase";

export interface AppFlags {
  autoCheckin: boolean;
  stillHere: boolean;
  pushAlerts: boolean;
  gameReminders: boolean;
  gameChat: boolean;
  teamTools: boolean;
}

const FLAG_KEYS: (keyof AppFlags)[] = [
  "autoCheckin",
  "stillHere",
  "pushAlerts",
  "gameReminders",
  "gameChat",
  "teamTools",
];

export function parseFlags(data: Record<string, unknown> | undefined): AppFlags {
  const flags = {} as AppFlags;
  for (const key of FLAG_KEYS) {
    flags[key] = data?.[key] !== false;
  }
  return flags;
}

export const DEFAULT_FLAGS: AppFlags = parseFlags(undefined);

export const FlagsService = {
  subscribeToFlags(
    onChange: (flags: AppFlags) => void,
    onError: (error: Error) => void,
  ): Unsubscribe {
    return onSnapshot(
      doc(db, "config", "flags"),
      (snapshot) => {
        onChange(parseFlags(snapshot.data() as Record<string, unknown> | undefined));
      },
      onError,
    );
  },
};
