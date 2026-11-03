import type { Match, MatchFormat, Sport } from "../types/types";

export type GameFilterSport = "both" | Sport;
export type GameFilterFormat = "any" | MatchFormat;
export type GameFilterSkill = "near" | "any";
export type GameFilterWhen = "next_hour" | "today" | "tomorrow" | "any";

export interface GameFilters {
  sport: GameFilterSport;
  format: GameFilterFormat;
  skill: GameFilterSkill;
  when: GameFilterWhen;
  hideFull: boolean;
}

export const DEFAULT_FILTERS: GameFilters = {
  sport: "both",
  format: "any",
  skill: "any",
  when: "any",
  hideFull: false,
};

export function activeFilterCount(filters: GameFilters): number {
  let n = 0;
  if (filters.sport !== "both") n++;
  if (filters.format !== "any") n++;
  if (filters.skill !== "any") n++;
  if (filters.when !== "any") n++;
  if (filters.hideFull) n++;
  return n;
}

function startOfDayMs(ms: number): number {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

export function filterMatches(
  matches: Match[],
  filters: GameFilters,
  now: number,
  userLevel?: number,
): Match[] {
  return matches.filter((match) => {
    const startMs = match.startAt.toMillis();
    const spotsLeft = Math.max(0, match.spotsTotal - match.playerUids.length);

    if (filters.sport !== "both" && match.sport !== filters.sport) return false;
    if (filters.format !== "any" && match.format !== filters.format) return false;
    if (
      filters.skill === "near" &&
      typeof userLevel === "number" &&
      typeof match.skillLevel === "number" &&
      Math.abs(match.skillLevel - userLevel) > 0.5
    )
      return false;
    if (filters.when === "next_hour" && startMs > now + 60 * 60 * 1000)
      return false;
    if (filters.when === "today" && startOfDayMs(startMs) !== startOfDayMs(now))
      return false;
    if (
      filters.when === "tomorrow" &&
      startOfDayMs(startMs) !== startOfDayMs(now) + 86_400_000
    )
      return false;
    if (filters.hideFull && spotsLeft === 0) return false;
    return true;
  });
}
