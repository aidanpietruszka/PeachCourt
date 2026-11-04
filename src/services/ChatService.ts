import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
  updateDoc,
  where,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "./firebase";
import type { Chat, ChatMessage } from "../types/types";

export const ChatService = {
  subscribeToMyChats(
    uid: string,
    onChange: (chats: Chat[]) => void,
    onError: (err: Error) => void,
  ): Unsubscribe {
    const q = query(
      collection(db, "chats"),
      where("playerUids", "array-contains", uid),
    );
    return onSnapshot(
      q,
      (snap) => {
        const chats = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }) as Chat)
          .sort((a, b) => a.startAt.toMillis() - b.startAt.toMillis());
        onChange(chats);
      },
      onError,
    );
  },

  subscribeToMessages(
    matchId: string,
    onChange: (messages: ChatMessage[]) => void,
    onError: (err: Error) => void,
  ): Unsubscribe {
    const q = query(
      collection(db, "chats", matchId, "messages"),
      orderBy("createdAt", "asc"),
    );
    return onSnapshot(
      q,
      (snap) => {
        onChange(
          snap.docs.map((d) => ({ id: d.id, ...d.data() }) as ChatMessage),
        );
      },
      onError,
    );
  },

  async sendMessage(
    matchId: string,
    text: string,
    senderUid: string,
    senderName: string,
  ): Promise<void> {
    await addDoc(collection(db, "chats", matchId, "messages"), {
      text,
      senderUid,
      senderName,
      createdAt: Timestamp.now(),
    });
  },

  async markRead(matchId: string, uid: string): Promise<void> {
    await updateDoc(doc(db, "chats", matchId), {
      [`readAt.${uid}`]: Timestamp.now(),
    });
  },
};
