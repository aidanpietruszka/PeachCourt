import type { MatchFormat, Sport } from "../types/types";
import { SPORT_LABEL } from "./skill";
import { formatStart } from "./time";

export const GAME_DURATION_MINUTES = 60;

const FORMAT_LABEL: Record<MatchFormat, string> = {
  singles: "Singles",
  doubles: "Doubles",
};

export interface PlayerGame {
  id: string;
  sport: Sport;
  format: MatchFormat;
  startAt: number;
  courtName: string;
}

export function gamesOverlap(firstStartMs: number, secondStartMs: number): boolean {
  return Math.abs(firstStartMs - secondStartMs) < GAME_DURATION_MINUTES * 60_000;
}

export function uniqueGames(games: PlayerGame[]): PlayerGame[] {
  const seen = new Set<string>();
  return games.filter((game) => {
    if (seen.has(game.id)) return false;
    seen.add(game.id);
    return true;
  });
}

export function findConflict(
  startMs: number,
  games: PlayerGame[],
  now: number,
  ignoreId?: string,
): PlayerGame | null {
  if (!Number.isFinite(startMs)) return null;

  let conflict: PlayerGame | null = null;
  for (const game of games) {
    if (game.id === ignoreId) continue;
    if (game.startAt <= now) continue;
    if (!gamesOverlap(startMs, game.startAt)) continue;
    if (
      conflict === null ||
      game.startAt < conflict.startAt ||
      (game.startAt === conflict.startAt && game.id < conflict.id)
    ) {
      conflict = game;
    }
  }
  return conflict;
}

export function describeGame(game: PlayerGame, courtName: string, now: number): string {
  const start = formatStart(new Date(game.startAt), now);
  return `${FORMAT_LABEL[game.format]} · ${SPORT_LABEL[game.sport]} at ${courtName}, ${start}.`;
}
