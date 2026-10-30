import { describe, expect, it } from "vitest";
import {
  describeGame,
  findConflict,
  GAME_DURATION_MINUTES,
  gamesOverlap,
  type PlayerGame,
  uniqueGames,
} from "./gameOverlap";

const now = Date.UTC(2026, 9, 24, 15, 0);
const ms = (minutes: number) => now + minutes * 60_000;

function game(
  id: string,
  startMinutes: number,
  overrides: Partial<PlayerGame> = {},
): PlayerGame {
  return {
    id,
    sport: "tennis",
    format: "doubles",
    startAt: ms(startMinutes),
    courtName: "Grove Park",
    ...overrides,
  };
}

describe("GAME_DURATION_MINUTES", () => {
  it("U-37 is 60", () => {
    expect(GAME_DURATION_MINUTES).toBe(60);
  });
});

describe("gamesOverlap", () => {
  it("U-38 games exactly 60 minutes apart do not overlap", () => {
    expect(gamesOverlap(ms(0), ms(60))).toBe(false);
  });

  it("U-39 games less than 60 minutes apart overlap", () => {
    expect(gamesOverlap(ms(0), ms(59))).toBe(true);
  });

  it("U-40 same start time overlaps", () => {
    expect(gamesOverlap(ms(0), ms(0))).toBe(true);
  });

  it("U-41 overlap is symmetric", () => {
    expect(gamesOverlap(ms(45), ms(0))).toBe(true);
    expect(gamesOverlap(ms(0), ms(45))).toBe(true);
  });

  it("U-42 one minute before the 60-minute boundary overlaps", () => {
    expect(gamesOverlap(ms(0), ms(59))).toBe(true);
  });
});

describe("findConflict", () => {
  it("U-43 returns null when there are no games", () => {
    expect(findConflict(ms(120), [], now)).toBeNull();
  });

  it("U-44 returns null when start is not finite", () => {
    expect(findConflict(NaN, [game("a", 120)], now)).toBeNull();
    expect(findConflict(Infinity, [game("a", 120)], now)).toBeNull();
  });

  it("U-45 skips games that have already started", () => {
    expect(findConflict(ms(30), [game("a", -1)], now)).toBeNull();
    expect(findConflict(ms(30), [game("a", 0)], now)).toBeNull();
  });

  it("U-46 detects a conflict with an upcoming game", () => {
    const result = findConflict(ms(30), [game("a", 60)], now);
    expect(result?.id).toBe("a");
  });

  it("U-47 returns null when games are exactly 60 minutes apart", () => {
    expect(findConflict(ms(0), [game("a", 60)], now)).toBeNull();
    expect(findConflict(ms(60), [game("a", 0)], now)).toBeNull();
  });

  it("U-48 skips the ignored id", () => {
    expect(
      findConflict(ms(30), [game("a", 60)], now, "a"),
    ).toBeNull();
  });

  it("U-49 returns the nearest conflict when there are multiple", () => {
    const result = findConflict(
      ms(30),
      [game("a", 75), game("b", 61)],
      now,
    );
    expect(result?.id).toBe("b");
  });

  it("U-50 breaks ties by earlier startAt then by id", () => {
    const sameTime = ms(45);
    const result = findConflict(
      ms(10),
      [game("z", 45), game("a", 45)],
      now,
    );
    expect(result?.id).toBe("a");
    expect(result?.startAt).toBe(sameTime);
  });

  it("U-51 a game exactly 60 min after an upcoming game does not conflict", () => {
    expect(
      findConflict(ms(120), [game("a", 60)], now),
    ).toBeNull();
  });

  it("U-52 a game 45 min after an upcoming game conflicts", () => {
    const result = findConflict(ms(105), [game("a", 60)], now);
    expect(result?.id).toBe("a");
  });
});

describe("uniqueGames", () => {
  it("U-53 deduplicates by id keeping first occurrence", () => {
    const games = [game("a", 60), game("b", 120), game("a", 180)];
    const result = uniqueGames(games);
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe("a");
    expect(result[0].startAt).toBe(ms(60));
    expect(result[1].id).toBe("b");
  });

  it("U-54 returns empty array unchanged", () => {
    expect(uniqueGames([])).toEqual([]);
  });
});

describe("describeGame", () => {
  it("U-55 formats game description correctly", () => {
    const g = game("a", 60, {
      sport: "pickleball",
      format: "singles",
      courtName: "Grove Park",
    });
    const result = describeGame(g, "Grove Park", now);
    expect(result).toMatch(/^Singles · Pickleball at Grove Park, Today/);
    expect(result).toMatch(/\.$/);
  });

  it("U-56 uses the passed court name", () => {
    const g = game("a", 60);
    expect(describeGame(g, "City Park", now)).toContain("at City Park");
  });

  it("U-57 formats doubles tennis correctly", () => {
    const g = game("a", 60, { sport: "tennis", format: "doubles" });
    expect(describeGame(g, "Park", now)).toMatch(/^Doubles · Tennis at Park/);
  });
});

describe("findConflict edge cases", () => {
  it("U-58 past game at exactly now is skipped", () => {
    expect(findConflict(ms(30), [game("a", 0)], now)).toBeNull();
  });

  it("U-59 game one millisecond in the future can conflict", () => {
    const futureNow = now - 1;
    const result = findConflict(ms(30), [game("a", 0)], futureNow);
    expect(result?.id).toBe("a");
  });

  it("U-60 ignoreId does not affect other conflict detection", () => {
    const result = findConflict(
      ms(30),
      [game("ignore-me", 60), game("block-me", 61)],
      now,
      "ignore-me",
    );
    expect(result?.id).toBe("block-me");
  });

  it("U-61 returns null when the only conflicting game is the one being ignored", () => {
    expect(findConflict(ms(30), [game("a", 60)], now, "a")).toBeNull();
  });
});
