import { useEffect, useMemo, useState } from "react";
import type { Timestamp } from "firebase/firestore";
import { ChatService } from "../services/ChatService";
import type { Chat } from "../types/types";

export function useChatList(uid: string | null): {
  chats: Chat[];
  unreadChatCount: number;
} {
  const [chats, setChats] = useState<Chat[]>([]);

  useEffect(() => {
    if (!uid) {
      setChats([]);
      return;
    }
    return ChatService.subscribeToMyChats(uid, setChats, (err) => {
      console.error("Unable to load chats", err);
    });
  }, [uid]);

  const unreadChatCount = useMemo(() => {
    if (!uid) return 0;
    return chats.filter((chat) => {
      const lastMsgAt = chat.lastMessageAt as Timestamp | null;
      if (!lastMsgAt) return false;
      const readAt = chat.readAt?.[uid] as Timestamp | undefined;
      if (!readAt) return true;
      return lastMsgAt.toMillis() > readAt.toMillis();
    }).length;
  }, [chats, uid]);

  return { chats, unreadChatCount };
}
