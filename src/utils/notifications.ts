export type NotifPermission = "default" | "granted" | "denied";

export interface NotifEnv {
  hasNotification: boolean;
  hasServiceWorker: boolean;
  permission: NotifPermission;
  isIPhone: boolean;
  isStandalone: boolean;
  hasVapidKey: boolean;
}

export type NotifStatus =
  | "ok"
  | "unsupported"
  | "needs_home_screen"
  | "denied"
  | "no_vapid";

export function notificationStatus(env: NotifEnv): NotifStatus {
  if (!env.hasNotification || !env.hasServiceWorker) return "unsupported";
  if (env.isIPhone && !env.isStandalone) return "needs_home_screen";
  if (env.permission === "denied") return "denied";
  if (!env.hasVapidKey) return "no_vapid";
  return "ok";
}

export function isStandaloneDisplay(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return false;
  }
  return (
    (navigator as { standalone?: boolean }).standalone === true ||
    window.matchMedia("(display-mode: standalone)").matches
  );
}

const JOIN_SOURCES = ["push", "banner", "inbox", "browsing"] as const;
export type JoinSource = (typeof JOIN_SOURCES)[number];

export function parseJoinSource(value: string | null | undefined): JoinSource {
  return (JOIN_SOURCES as readonly string[]).includes(value ?? "")
    ? (value as JoinSource)
    : "browsing";
}

const NOTIFICATION_OPEN_PREFIX = "peachcourt-notif-opened-";

export function consumeNotificationOpen(key: string): boolean {
  const storageKey = `${NOTIFICATION_OPEN_PREFIX}${key}`;
  try {
    if (sessionStorage.getItem(storageKey) === "true") {
      return false;
    }
    sessionStorage.setItem(storageKey, "true");
    return true;
  } catch {
    return true;
  }
}

export interface PushData {
  type?: string;
  gameId?: string;
  gameCourtId?: string;
}

export function pushTargetUrl(data: PushData): string {
  if (data.type === "new_message" && data.gameId) {
    return `/chats/${data.gameId}?src=push`;
  }
  if (data.gameCourtId) {
    return `/courts/${data.gameCourtId}?src=push`;
  }
  if (data.gameId) {
    return `/courts/${data.gameId}?src=push`;
  }
  return "/courts";
}
