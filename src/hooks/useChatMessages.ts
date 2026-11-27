import { useEffect, useState } from "react";
import { ChatService } from "../services/ChatService";
import type { ChatMessage } from "../types/types";
import { useListenerError } from "./useListenerError";

export function useChatMessages(matchId: string | null): {
  messages: ChatMessage[];
  error: boolean;
  retry: () => void;
} {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const { errored, retryKey, handleError, retry } =
    useListenerError("chat-messages");

  useEffect(() => {
    if (!matchId) {
      setMessages([]);
      return;
    }
    return ChatService.subscribeToMessages(matchId, setMessages, handleError);
  }, [matchId, retryKey, handleError]);

  return { messages, error: errored, retry };
}
