import { useEffect, useState } from "react";
import { MatchService } from "../services/MatchService";
import { ErrorService } from "../services/ErrorService";
import type { PlayerGame } from "../utils/gameOverlap";

export function useMyGames(uid: string | null): PlayerGame[] {
  const [games, setGames] = useState<PlayerGame[]>([]);

  useEffect(() => {
    if (!uid) {
      setGames([]);
      return;
    }
    return MatchService.subscribeToMyGames(uid, setGames, (error) =>
      void ErrorService.logListener("my-games", error),
    );
  }, [uid]);

  return games;
}
