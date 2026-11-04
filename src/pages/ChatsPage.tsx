import { IonContent, IonPage, useIonRouter } from "@ionic/react";
import type { Timestamp } from "firebase/firestore";
import { useAuth } from "../hooks/useAuth";
import { useAlerts } from "../hooks/useAlerts";
import { useChatList } from "../hooks/useChatList";
import NotificationBell from "../components/NotificationBell";
import type { Chat, Sport } from "../types/types";
import "./ChatsPage.css";

const SPORT_AVATAR_COLOR: Record<Sport, string> = {
  pickleball: "#0d9677",
  tennis: "#2b5fd9",
};

const SPORT_INITIAL: Record<Sport, string> = {
  pickleball: "P",
  tennis: "T",
};

const FORMAT_LABEL: Record<string, string> = {
  singles: "Singles",
  doubles: "Doubles",
};

function formatChatStartTime(startAt: Timestamp, now: number): string {
  const d = startAt.toDate();
  const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const todayStr = new Date(now).toDateString();
  if (d.toDateString() === todayStr) return `Today ${time}`;
  const tomorrowStr = new Date(now + 86_400_000).toDateString();
  if (d.toDateString() === tomorrowStr) return `Tomorrow ${time}`;
  if (d.getTime() - now < 7 * 86_400_000) {
    return `${d.toLocaleDateString([], { weekday: "short" })} ${time}`;
  }
  return `${d.toLocaleDateString([], { month: "short", day: "numeric" })} ${time}`;
}

function formatLastMsgTime(ts: Timestamp, now: number): string {
  const d = ts.toDate();
  if (d.toDateString() === new Date(now).toDateString()) {
    return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }
  if (d.toDateString() === new Date(now - 86_400_000).toDateString()) {
    return "Yesterday";
  }
  if (now - d.getTime() < 7 * 86_400_000) {
    return d.toLocaleDateString([], { weekday: "short" });
  }
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function chatHasUnread(chat: Chat, uid: string): boolean {
  if (!chat.lastMessageAt) return false;
  const readAt = chat.readAt?.[uid] as Timestamp | undefined;
  if (!readAt) return true;
  return chat.lastMessageAt.toMillis() > readAt.toMillis();
}

const ChatsPage: React.FC = () => {
  const ionRouter = useIonRouter();
  const { user } = useAuth();
  const uid = user?.uid ?? null;
  const { chats } = useChatList(uid);
  const { unreadCount: alertUnreadCount } = useAlerts(uid);
  const now = Date.now();

  return (
    <IonPage>
      <IonContent>
        <div className="chats-page">
          <div className="chats-page__header">
            <h1 className="chats-page__title">Chats</h1>
            <NotificationBell
              unreadCount={alertUnreadCount}
              onClick={() => ionRouter.push("/notifications", "forward")}
            />
          </div>

          {chats.length === 0 ? (
            <div className="chats-empty">
              <svg
                className="chats-empty__icon"
                width="56"
                height="56"
                viewBox="0 0 56 56"
                fill="none"
                aria-hidden="true"
              >
                <circle cx="28" cy="28" r="28" fill="#e3f5ef" />
                <path
                  d="M14 20a4 4 0 014-4h20a4 4 0 014 4v14a4 4 0 01-4 4H22l-6 4v-4h-2a4 4 0 01-4-4V20z"
                  stroke="#0d9677"
                  strokeWidth="2"
                  fill="none"
                  strokeLinejoin="round"
                />
              </svg>
              <p className="chats-empty__title">No chats right now</p>
              <p className="chats-empty__body">
                Join or post a game and its chat shows up here. Chats are
                deleted 1 hour after the game starts.
              </p>
              <button
                type="button"
                className="chats-empty__btn"
                onClick={() => ionRouter.push("/courts", "none")}
              >
                Find a game
              </button>
            </div>
          ) : (
            <div className="chats-list">
              {chats.map((chat) => {
                const unread = uid ? chatHasUnread(chat, uid) : false;
                const isHost = chat.hostUid === uid;
                const lastMsgTime = chat.lastMessageAt
                  ? formatLastMsgTime(chat.lastMessageAt, now)
                  : null;
                const lastMsgText = chat.lastMessage
                  ? chat.lastSenderUid === uid
                    ? `You: ${chat.lastMessage}`
                    : `${chat.lastSenderName ?? "Someone"}: ${chat.lastMessage}`
                  : null;

                return (
                  <button
                    key={chat.id}
                    type="button"
                    className="chat-row"
                    onClick={() =>
                      ionRouter.push(`/chats/${chat.id}`, "forward")
                    }
                  >
                    <div
                      className="chat-row__avatar"
                      style={{
                        background: SPORT_AVATAR_COLOR[chat.sport] ?? "#0d9677",
                      }}
                    >
                      {SPORT_INITIAL[chat.sport] ?? "?"}
                    </div>
                    <div className="chat-row__body">
                      <div className="chat-row__top">
                        <span className="chat-row__name">
                          {FORMAT_LABEL[chat.format] ?? chat.format} ·{" "}
                          {chat.courtName}
                        </span>
                        {lastMsgTime && (
                          <span
                            className={`chat-row__time${unread ? " chat-row__time--unread" : ""}`}
                          >
                            {lastMsgTime}
                          </span>
                        )}
                      </div>
                      <div className="chat-row__middle">
                        <span className="chat-row__start">
                          {formatChatStartTime(chat.startAt, now)}
                        </span>
                        {isHost && (
                          <span className="chat-row__hosting">
                            You&apos;re hosting
                          </span>
                        )}
                      </div>
                      <div className="chat-row__bottom">
                        {lastMsgText && (
                          <span
                            className={`chat-row__preview${unread ? " chat-row__preview--unread" : ""}`}
                          >
                            {lastMsgText}
                          </span>
                        )}
                        {unread && (
                          <span
                            className="chat-row__dot"
                            aria-label="Unread messages"
                          />
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </IonContent>
    </IonPage>
  );
};

export default ChatsPage;
