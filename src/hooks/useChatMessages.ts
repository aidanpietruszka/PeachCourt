import { useEffect, useState } from "react";
import { ChatService } from "../services/ChatService";
import type { ChatMessage } from "../types/types";

export function useChatMessages(matchId: string | null): ChatMessage[] {
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  useEffect(() => {
    if (!matchId) {
      setMessages([]);
      return;
    }
    return ChatService.subscribeToMessages(matchId, setMessages, (err) => {
      console.error("Unable to load chat messages", err);
    });
  }, [matchId]);

  return messages;
}
