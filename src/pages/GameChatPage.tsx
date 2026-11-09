import { useEffect, useRef, useState } from "react";
import { IonContent, IonPage, useIonRouter } from "@ionic/react";
import { useLocation, useParams } from "react-router-dom";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../services/firebase";
import { useAuth } from "../hooks/useAuth";
import { UserService } from "../services/UserService";
import { useChatMessages } from "../hooks/useChatMessages";
import { ChatService } from "../services/ChatService";
import { EventService } from "../services/EventService";
import { consumeNotificationOpen, parseJoinSource } from "../utils/notifications";
import type { Chat } from "../types/types";
import "./GameChatPage.css";

const FORMAT_LABEL: Record<string, string> = {
  singles: "Singles",
  doubles: "Doubles",
};

function formatChatTime(d: Date, now: number): string {
  const todayStr = new Date(now).toDateString();
  if (d.toDateString() === todayStr) {
    return `Today ${d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
  }
  const tomorrowStr = new Date(now + 86_400_000).toDateString();
  if (d.toDateString() === tomorrowStr) {
    return `Tomorrow ${d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
  }
  return `${d.toLocaleDateString([], { weekday: "short" })} ${d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
}

const GameChatPage: React.FC = () => {
  const { matchId } = useParams<{ matchId: string }>();
  const location = useLocation();
  const joinSource = parseJoinSource(
    new URLSearchParams(location.search).get("src"),
  );
  const ionRouter = useIonRouter();
  const { user } = useAuth();
  const uid = user?.uid ?? null;
  const [chat, setChat] = useState<Chat | null>(null);
  const [senderName, setSenderName] = useState("");
  const [text, setText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const messages = useChatMessages(matchId ?? null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLIonContentElement>(null);
  const now = Date.now();

  useEffect(() => {
    if (!matchId) return;
    const unsub = onSnapshot(doc(db, "chats", matchId), (snap) => {
      setChat(snap.exists() ? ({ id: snap.id, ...snap.data() } as Chat) : null);
    });
    return unsub;
  }, [matchId]);

  useEffect(() => {
    if (!matchId || !uid || joinSource !== "push") return;
    const courtId = chat?.courtId;
    if (!courtId) return;
    if (!consumeNotificationOpen(`chat:${matchId}`)) return;
    EventService.recordNotificationOpened(courtId).catch((error: unknown) =>
      console.error("Unable to log notification open", error),
    );
  }, [matchId, uid, joinSource, chat?.courtId]);

  useEffect(() => {
    if (!uid) return;
    return UserService.subscribeToProfile(
      uid,
      (p) => setSenderName(p?.firstName ?? ""),
      () => {},
    );
  }, [uid]);

  useEffect(() => {
    if (!uid || !matchId) return;
    void ChatService.markRead(matchId, uid).catch(() => {});
  }, [matchId, uid, messages]);

  useEffect(() => {
    void contentRef.current?.scrollToBottom(0);
  }, [messages]);

  const handleSend = async () => {
    if (!text.trim() || !uid || !matchId || !senderName) return;
    setIsSending(true);
    try {
      await ChatService.sendMessage(matchId, text.trim(), uid, senderName);
      setText("");
    } catch (err) {
      console.error("Unable to send message", err);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  if (!chat) return null;

  const players = chat.playerNames.join(", ");
  const startStr = formatChatTime(chat.startAt.toDate(), now);

  return (
    <IonPage>
      <IonContent ref={contentRef}>
        <div className="game-chat">
          <div className="game-chat__back-row">
            <button
              type="button"
              className="game-chat__back"
              onClick={() => ionRouter.goBack()}
            >
              <svg
                width="8"
                height="13"
                viewBox="0 0 8 13"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M7 1L1 6.5L7 12"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              Chats
            </button>
          </div>

          <div className="game-chat__header">
            <p className="game-chat__title">
              {FORMAT_LABEL[chat.format] ?? chat.format} · {chat.courtName}
            </p>
            <p className="game-chat__subtitle">
              {startStr} · {players}
              {chat.courtId && (
                <>
                  {" · "}
                  <button
                    type="button"
                    className="game-chat__details-link"
                    onClick={() =>
                      ionRouter.push(`/courts/${chat.courtId}`, "forward")
                    }
                  >
                    Game details ›
                  </button>
                </>
              )}
            </p>
          </div>

          <div className="game-chat__messages">
            <p className="game-chat__system">
              {chat.hostName} posted this game
            </p>
            {messages.map((msg) => {
              const isSelf = msg.senderUid === uid;
              return (
                <div
                  key={msg.id}
                  className={`game-chat__msg-group${isSelf ? " game-chat__msg-group--self" : ""}`}
                >
                  {!isSelf && (
                    <p className="game-chat__sender">{msg.senderName}</p>
                  )}
                  <div
                    className={`game-chat__bubble${isSelf ? " game-chat__bubble--self" : ""}`}
                  >
                    {msg.text}
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>

          <div className="game-chat__send-row">
            <input
              type="text"
              className="game-chat__input"
              placeholder="Message"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              aria-label="Message"
            />
            <button
              type="button"
              className="game-chat__send-btn"
              disabled={!text.trim() || isSending || !senderName}
              onClick={() => void handleSend()}
            >
              Send
            </button>
          </div>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default GameChatPage;
