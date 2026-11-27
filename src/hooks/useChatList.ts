import { useEffect, useMemo, useState } from "react";
import type { Timestamp } from "firebase/firestore";
import { ChatService } from "../services/ChatService";
import type { Chat } from "../types/types";
import { useListenerError } from "./useListenerError";

export function useChatList(uid: string | null): {
  chats: Chat[];
  unreadChatCount: number;
  error: boolean;
  retry: () => void;
} {
  const [chats, setChats] = useState<Chat[]>([]);
  const { errored, retryKey, handleError, retry } = useListenerError("chats");

  useEffect(() => {
    if (!uid) {
      setChats([]);
      return;
    }
    return ChatService.subscribeToMyChats(uid, setChats, handleError);
  }, [uid, retryKey, handleError]);

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

  return { chats, unreadChatCount, error: errored, retry };
}
