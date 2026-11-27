import { useEffect, useState } from "react";
import { MatchService, type MyActivityGame } from "../services/MatchService";
import { useListenerError } from "./useListenerError";

export function useMyActivityGames(uid: string | null): {
  games: MyActivityGame[];
  error: boolean;
  retry: () => void;
} {
  const [games, setGames] = useState<MyActivityGame[]>([]);
  const { errored, retryKey, handleError, retry } =
    useListenerError("my-activity-games");

  useEffect(() => {
    if (!uid) {
      setGames([]);
      return;
    }
    return MatchService.subscribeToMyActivityGames(uid, setGames, handleError);
  }, [uid, retryKey, handleError]);

  return { games, error: errored, retry };
}
