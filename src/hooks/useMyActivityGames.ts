import { useEffect, useState } from "react";
import { MatchService, type MyActivityGame } from "../services/MatchService";

export function useMyActivityGames(uid: string | null): MyActivityGame[] {
  const [games, setGames] = useState<MyActivityGame[]>([]);

  useEffect(() => {
    if (!uid) {
      setGames([]);
      return;
    }
    return MatchService.subscribeToMyActivityGames(uid, setGames, (err) => {
      console.error("Unable to load your games", err);
    });
  }, [uid]);

  return games;
}
