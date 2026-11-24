import { addDoc, collection, Timestamp } from "firebase/firestore";
import { auth, db } from "./firebase";

export type ClientErrorType =
  | "listener_failed"
  | "save_failed"
  | "push_token_failed"
  | "sign_in_failed"
  | "unexpected";

const MESSAGE_MAX = 1000;
const FIELD_MAX = 200;

const loggedListeners = new Set<string>();

function truncate(value: string, max: number): string {
  return value.length > max ? value.slice(0, max) : value;
}

function deviceName(ua: string): string {
  if (/iPhone|iPad|iPod/.test(ua)) return "iPhone";
  if (/Android/.test(ua)) return "Android";
  if (/Macintosh/.test(ua)) return "Mac";
  if (/Windows/.test(ua)) return "Windows";
  return "other";
}

function browserName(ua: string): string {
  if (/Edg\//.test(ua)) return "Edge";
  if (/Chrome\//.test(ua)) return "Chrome";
  if (/Firefox\//.test(ua)) return "Firefox";
  if (/Safari\//.test(ua) || /Safari/.test(ua)) return "Safari";
  return "other";
}

function errorCode(error: unknown): string {
  if (error && typeof error === "object" && "code" in error) {
    return String((error as { code: unknown }).code);
  }
  if (error instanceof Error) return error.name;
  return "";
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (error == null) return "";
  return String(error);
}

interface LogInput {
  type: ClientErrorType;
  code?: string;
  message?: string;
}

async function write(input: LogInput): Promise<void> {
  try {
    await auth.authStateReady();
    const ua = navigator.userAgent ?? "";
    await addDoc(collection(db, "clientErrors"), {
      type: input.type,
      screen: truncate(location.pathname ?? "", FIELD_MAX),
      device: truncate(deviceName(ua), FIELD_MAX),
      browser: truncate(browserName(ua), FIELD_MAX),
      appVersion: truncate(__APP_VERSION__, FIELD_MAX),
      code: truncate(input.code ?? "", FIELD_MAX),
      message: truncate(input.message ?? "", MESSAGE_MAX),
      uid: auth.currentUser?.uid ?? null,
      createdAt: Timestamp.now(),
    });
  } catch (writeError) {
    console.error("clientErrors write failed", writeError);
  }
}

export const ErrorService = {
  async logListener(listenerName: string, error: unknown): Promise<void> {
    if (loggedListeners.has(listenerName)) {
      return;
    }
    loggedListeners.add(listenerName);
    await write({
      type: "listener_failed",
      code: listenerName,
      message: errorMessage(error),
    });
  },

  async logSignInFailed(error: unknown): Promise<void> {
    await write({
      type: "sign_in_failed",
      code: errorCode(error),
      message: errorMessage(error),
    });
  },

  async logUnexpected(error: unknown): Promise<void> {
    await write({
      type: "unexpected",
      code: errorCode(error),
      message: errorMessage(error),
    });
  },
};
