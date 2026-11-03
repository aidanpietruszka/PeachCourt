import { IonContent, IonPage, useIonRouter } from "@ionic/react";
import { useAuth } from "../hooks/useAuth";
import { useAlerts } from "../hooks/useAlerts";
import { AlertService, type Alert, type AlertType } from "../services/AlertService";
import type { Timestamp } from "firebase/firestore";
import "./NotificationInboxPage.css";

function formatAlertTime(createdAt: Timestamp | undefined, now: Date): string {
  if (!createdAt) return "";
  const d = createdAt.toDate();
  const isToday =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (isToday) {
    return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }
  const daysDiff = Math.floor((now.getTime() - d.getTime()) / 86_400_000);
  if (daysDiff < 7) {
    return d.toLocaleDateString([], { weekday: "short" });
  }
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function alertTitle(a: Alert): string {
  switch (a.type) {
    case "new_game":
      return `New ${a.gameFormat ?? "game"} at ${a.gameCourtName ?? "a court"}`;
    case "game_reminder":
      return "Starts in 1 hour";
    case "player_joined":
      return `${a.actorName ?? "Someone"} joined your game`;
    case "player_left":
      return `${a.actorName ?? "Someone"} left your game`;
    case "player_removed":
      return "You were removed from a game";
    case "host_transferred":
      return "You're the new host";
    case "game_deleted":
      return `${a.actorName ?? "Host"} cancelled the game`;
  }
}

function alertBody(a: Alert): string {
  const sport = a.gameSport
    ? a.gameSport.charAt(0).toUpperCase() + a.gameSport.slice(1)
    : "";
  const venue = a.gameCourtName ?? "";
  const fmt = a.gameFormat
    ? a.gameFormat.charAt(0).toUpperCase() + a.gameFormat.slice(1)
    : "";
  switch (a.type) {
    case "new_game": {
      const parts = [sport, a.spotsOpen != null ? `${a.spotsOpen} spots open` : ""].filter(Boolean);
      return parts.join(" · ");
    }
    case "game_reminder":
      return `${fmt} at ${venue}`;
    case "player_joined":
      return `${fmt} at ${venue}`;
    case "player_left":
      return `${fmt} at ${venue}`;
    case "player_removed":
      return `${a.actorName ?? "Host"}'s ${fmt.toLowerCase()} at ${venue}`;
    case "host_transferred":
      return `${fmt} at ${venue}`;
    case "game_deleted":
      return `${fmt} at ${venue}`;
  }
}

type IconConfig = { bg: string; color: string; symbol: string };

function alertIcon(type: AlertType): IconConfig {
  switch (type) {
    case "new_game":
      return { bg: "#e3f5ef", color: "#0d9677", symbol: "+" };
    case "game_reminder":
      return { bg: "#fdf3e1", color: "#c07c10", symbol: "⏰" };
    case "player_joined":
      return { bg: "#e8f0fe", color: "#1a73e8", symbol: "→" };
    case "player_left":
      return { bg: "#f2f2f7", color: "#8a8a8e", symbol: "←" };
    case "player_removed":
      return { bg: "#fde8e8", color: "#c0392b", symbol: "✕" };
    case "host_transferred":
      return { bg: "#e3f5ef", color: "#0d9677", symbol: "★" };
    case "game_deleted":
      return { bg: "#fde8e8", color: "#c0392b", symbol: "✕" };
  }
}

function isToday(d: Date, now: Date): boolean {
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

const NotificationInboxPage: React.FC = () => {
  const ionRouter = useIonRouter();
  const { user } = useAuth();
  const { alerts, unreadCount } = useAlerts(user?.uid ?? null);
  const now = new Date();

  const todayAlerts = alerts.filter(
    (a) => a.createdAt && isToday(a.createdAt.toDate(), now),
  );
  const earlierAlerts = alerts.filter(
    (a) => !a.createdAt || !isToday(a.createdAt.toDate(), now),
  );

  const handleMarkAllRead = () => {
    const unread = alerts.filter((a) => !a.read);
    void AlertService.markAllRead(unread).catch((err: unknown) => {
      console.error("Unable to mark all read", err);
    });
  };

  const handleRowTap = (a: Alert) => {
    void AlertService.markRead(a.id).catch((err: unknown) => {
      console.error("Unable to mark alert read", err);
    });
    if (a.gameCourtId) {
      ionRouter.push(`/courts/${a.gameCourtId}`, "forward");
    }
  };

  return (
    <IonPage>
      <IonContent>
        <div className="inbox">
          <div className="inbox__header">
            <button
              type="button"
              className="inbox__back"
              onClick={() => ionRouter.goBack()}
              aria-label="Back"
            >
              <svg width="10" height="16" viewBox="0 0 10 16" fill="none" aria-hidden="true">
                <path
                  d="M9 1L1 8L9 15"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              Back
            </button>
            {unreadCount > 0 && (
              <button
                type="button"
                className="inbox__mark-all"
                onClick={handleMarkAllRead}
              >
                Mark all read
              </button>
            )}
          </div>

          <h1 className="inbox__title">Notifications</h1>

          {alerts.length === 0 && (
            <p className="inbox__empty">No notifications yet.</p>
          )}

          {todayAlerts.length > 0 && (
            <section>
              <p className="inbox__section-label">Today</p>
              <div className="inbox__group">
                {todayAlerts.map((a) => (
                  <AlertRow
                    key={a.id}
                    alert={a}
                    now={now}
                    onTap={handleRowTap}
                  />
                ))}
              </div>
            </section>
          )}

          {earlierAlerts.length > 0 && (
            <section>
              <p className="inbox__section-label">Earlier</p>
              <div className="inbox__group">
                {earlierAlerts.map((a) => (
                  <AlertRow
                    key={a.id}
                    alert={a}
                    now={now}
                    onTap={handleRowTap}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      </IonContent>
    </IonPage>
  );
};

function AlertRow({
  alert: a,
  now,
  onTap,
}: {
  alert: Alert;
  now: Date;
  onTap: (a: Alert) => void;
}) {
  const icon = alertIcon(a.type);
  const timeStr = formatAlertTime(a.createdAt, now);
  return (
    <button
      type="button"
      className={`inbox__row ${a.read ? "inbox__row--read" : "inbox__row--unread"}`}
      onClick={() => onTap(a)}
    >
      <div
        className="inbox__icon"
        style={{ background: icon.bg, color: icon.color }}
        aria-hidden="true"
      >
        {icon.symbol}
      </div>
      <div className="inbox__row-body">
        <p className={`inbox__row-title ${a.read ? "" : "inbox__row-title--unread"}`}>
          {alertTitle(a)}
        </p>
        <p className="inbox__row-sub">{alertBody(a)}</p>
      </div>
      <div className="inbox__row-meta">
        <p className={`inbox__row-time ${a.read ? "inbox__row-time--read" : "inbox__row-time--unread"}`}>
          {timeStr}
        </p>
        {!a.read && <span className="inbox__dot" aria-hidden="true" />}
      </div>
    </button>
  );
}

export default NotificationInboxPage;
