import {
  deleteToken,
  getMessaging,
  getToken,
  isSupported,
} from "firebase/messaging";
import { app } from "./firebase";
import { UserService } from "./UserService";
import {
  notificationStatus,
  type NotifEnv,
  type NotifPermission,
} from "../utils/notifications";

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY as string | undefined;
const SW_PATH = "/firebase-messaging-sw.js";

function currentEnv(): NotifEnv {
  const hasNotification =
    typeof window !== "undefined" && "Notification" in window;
  const hasServiceWorker =
    typeof navigator !== "undefined" && "serviceWorker" in navigator;
  const isStandalone =
    (navigator as { standalone?: boolean }).standalone === true ||
    window.matchMedia("(display-mode: standalone)").matches;
  return {
    hasNotification,
    hasServiceWorker,
    permission: hasNotification
      ? (Notification.permission as NotifPermission)
      : "denied",
    isIPhone: /iPhone|iPad|iPod/.test(navigator.userAgent),
    isStandalone,
    hasVapidKey: !!VAPID_KEY,
  };
}

function serviceWorkerUrl(): string {
  const options = app.options as Record<string, string | undefined>;
  const params = new URLSearchParams();
  for (const key of [
    "apiKey",
    "authDomain",
    "projectId",
    "messagingSenderId",
    "appId",
  ]) {
    const value = options[key];
    if (value) params.set(key, value);
  }
  return `${SW_PATH}?${params.toString()}`;
}

async function register(): Promise<ServiceWorkerRegistration> {
  return navigator.serviceWorker.register(serviceWorkerUrl());
}

export const MessagingService = {
  async enable(uid: string): Promise<string | null> {
    if (notificationStatus(currentEnv()) !== "ok") return null;
    if (!(await isSupported().catch(() => false))) return null;
    const registration = await register();
    const token = await getToken(getMessaging(app), {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration,
    });
    if (!token) return null;
    await UserService.saveFcmToken(uid, token);
    return token;
  },

  async disable(uid: string): Promise<void> {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }
    if (!(await isSupported().catch(() => false))) return;
    try {
      const messaging = getMessaging(app);
      const registration = await register();
      const token = await getToken(messaging, {
        vapidKey: VAPID_KEY,
        serviceWorkerRegistration: registration,
      });
      if (!token) return;
      await UserService.removeFcmToken(uid, token);
      await deleteToken(messaging);
    } catch {
      return;
    }
  },
};
