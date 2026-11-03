import { describe, expect, it } from "vitest";
import type { Match } from "../types/types";
import {
  activeFilterCount,
  DEFAULT_FILTERS,
  filterMatches,
  type GameFilters,
} from "./gameFilters";
import { Timestamp } from "firebase/firestore";

function makeMatch(overrides: Partial<Match> = {}): Match {
  return {
    id: "m1",
    courtId: "c1",
    courtName: "Test Court",
    sport: "tennis",
    hostUid: "host1",
    hostName: "Ana",
    format: "doubles",
    startAt: Timestamp.fromMillis(Date.now() + 60 * 60 * 1000),
    skillLevel: 3.5,
    spotsTotal: 3,
    playerUids: [],
    playerNames: [],
    removedUids: [],
    status: "open",
    createdAt: Timestamp.now(),
    ...overrides,
  };
}

const NOW = new Date(2026, 0, 15, 12, 0, 0).getTime();

function msAt(offsetHours: number): number {
  return NOW + offsetHours * 60 * 60 * 1000;
}

describe("activeFilterCount", () => {
  it("U-211 zero for default filters", () => {
    expect(activeFilterCount(DEFAULT_FILTERS)).toBe(0);
  });

  it("U-212 counts each active filter", () => {
    const filters: GameFilters = {
      sport: "tennis",
      format: "singles",
      skill: "near",
      when: "today",
      hideFull: true,
    };
    expect(activeFilterCount(filters)).toBe(5);
  });

  it("U-213 counts partial set correctly", () => {
    expect(
      activeFilterCount({ ...DEFAULT_FILTERS, sport: "pickleball", hideFull: true }),
    ).toBe(2);
  });
});

describe("filterMatches – sport", () => {
  const tennis = makeMatch({ id: "t1", sport: "tennis", startAt: Timestamp.fromMillis(msAt(1)) });
  const pickleball = makeMatch({ id: "p1", sport: "pickleball", startAt: Timestamp.fromMillis(msAt(1)) });

  it("U-214 both returns all sports", () => {
    const result = filterMatches([tennis, pickleball], DEFAULT_FILTERS, NOW);
    expect(result).toHaveLength(2);
  });

  it("U-215 tennis filter keeps only tennis", () => {
    const result = filterMatches(
      [tennis, pickleball],
      { ...DEFAULT_FILTERS, sport: "tennis" },
      NOW,
    );
    expect(result).toEqual([tennis]);
  });

  it("U-216 pickleball filter keeps only pickleball", () => {
    const result = filterMatches(
      [tennis, pickleball],
      { ...DEFAULT_FILTERS, sport: "pickleball" },
      NOW,
    );
    expect(result).toEqual([pickleball]);
  });
});

describe("filterMatches – format", () => {
  const singles = makeMatch({ id: "s1", format: "singles", startAt: Timestamp.fromMillis(msAt(1)) });
  const doubles = makeMatch({ id: "d1", format: "doubles", startAt: Timestamp.fromMillis(msAt(1)) });

  it("U-217 any format returns both", () => {
    expect(filterMatches([singles, doubles], DEFAULT_FILTERS, NOW)).toHaveLength(2);
  });

  it("U-218 singles filter", () => {
    expect(
      filterMatches([singles, doubles], { ...DEFAULT_FILTERS, format: "singles" }, NOW),
    ).toEqual([singles]);
  });

  it("U-219 doubles filter", () => {
    expect(
      filterMatches([singles, doubles], { ...DEFAULT_FILTERS, format: "doubles" }, NOW),
    ).toEqual([doubles]);
  });
});

describe("filterMatches – skill", () => {
  const skill30 = makeMatch({ id: "a", skillLevel: 3.0, startAt: Timestamp.fromMillis(msAt(1)) });
  const skill35 = makeMatch({ id: "b", skillLevel: 3.5, startAt: Timestamp.fromMillis(msAt(1)) });
  const skill40 = makeMatch({ id: "c", skillLevel: 4.0, startAt: Timestamp.fromMillis(msAt(1)) });
  const anySkill = makeMatch({ id: "d", skillLevel: "any", startAt: Timestamp.fromMillis(msAt(1)) });

  it("U-220 any skill returns all", () => {
    expect(filterMatches([skill30, skill35, skill40, anySkill], DEFAULT_FILTERS, NOW)).toHaveLength(4);
  });

  it("U-221 near filter includes ±0.5 of user level", () => {
    const result = filterMatches(
      [skill30, skill35, skill40, anySkill],
      { ...DEFAULT_FILTERS, skill: "near" },
      NOW,
      3.0,
    );
    expect(result.map((m) => m.id)).toEqual(["a", "b", "d"]);
  });

  it("U-222 near filter at boundary 0.5 is included", () => {
    const result = filterMatches(
      [skill35],
      { ...DEFAULT_FILTERS, skill: "near" },
      NOW,
      3.0,
    );
    expect(result).toHaveLength(1);
  });

  it("U-223 near filter > 0.5 is excluded", () => {
    const result = filterMatches(
      [skill40],
      { ...DEFAULT_FILTERS, skill: "near" },
      NOW,
      3.0,
    );
    expect(result).toHaveLength(0);
  });

  it("U-224 near filter without userLevel returns all", () => {
    const result = filterMatches(
      [skill30, skill40],
      { ...DEFAULT_FILTERS, skill: "near" },
      NOW,
    );
    expect(result).toHaveLength(2);
  });

  it("U-225 any-skill game passes near filter", () => {
    const result = filterMatches(
      [anySkill],
      { ...DEFAULT_FILTERS, skill: "near" },
      NOW,
      2.0,
    );
    expect(result).toHaveLength(1);
  });
});

describe("filterMatches – when", () => {
  const inThirtyMin = makeMatch({ id: "w1", startAt: Timestamp.fromMillis(msAt(0.5)) });
  const inTwoHours = makeMatch({ id: "w2", startAt: Timestamp.fromMillis(msAt(2)) });
  const tomorrow9am = makeMatch({
    id: "w3",
    startAt: Timestamp.fromMillis(
      new Date(2026, 0, 16, 9, 0, 0).getTime(),
    ),
  });

  it("U-226 any when returns all", () => {
    expect(filterMatches([inThirtyMin, inTwoHours, tomorrow9am], DEFAULT_FILTERS, NOW)).toHaveLength(3);
  });

  it("U-227 next_hour keeps only games within 60 minutes", () => {
    const result = filterMatches(
      [inThirtyMin, inTwoHours],
      { ...DEFAULT_FILTERS, when: "next_hour" },
      NOW,
    );
    expect(result).toEqual([inThirtyMin]);
  });

  it("U-228 next_hour boundary: exactly 60min is included", () => {
    const atOneHour = makeMatch({ id: "b1", startAt: Timestamp.fromMillis(msAt(1)) });
    const result = filterMatches(
      [atOneHour],
      { ...DEFAULT_FILTERS, when: "next_hour" },
      NOW,
    );
    expect(result).toHaveLength(1);
  });

  it("U-229 today filter keeps today games only", () => {
    const result = filterMatches(
      [inThirtyMin, inTwoHours, tomorrow9am],
      { ...DEFAULT_FILTERS, when: "today" },
      NOW,
    );
    expect(result.map((m) => m.id)).toEqual(["w1", "w2"]);
  });

  it("U-230 tomorrow filter keeps tomorrow games only", () => {
    const result = filterMatches(
      [inThirtyMin, tomorrow9am],
      { ...DEFAULT_FILTERS, when: "tomorrow" },
      NOW,
    );
    expect(result).toEqual([tomorrow9am]);
  });
});

describe("filterMatches – hideFull", () => {
  const open = makeMatch({ id: "o1", spotsTotal: 3, playerUids: ["a"], startAt: Timestamp.fromMillis(msAt(1)) });
  const full = makeMatch({ id: "f1", spotsTotal: 1, playerUids: ["a"], startAt: Timestamp.fromMillis(msAt(1)) });

  it("U-231 hideFull false keeps full games", () => {
    expect(filterMatches([open, full], DEFAULT_FILTERS, NOW)).toHaveLength(2);
  });

  it("U-232 hideFull true removes full games", () => {
    const result = filterMatches(
      [open, full],
      { ...DEFAULT_FILTERS, hideFull: true },
      NOW,
    );
    expect(result).toEqual([open]);
  });
});

describe("filterMatches – combinations", () => {
  it("U-233 sport + format combined", () => {
    const matches = [
      makeMatch({ id: "a", sport: "tennis", format: "singles", startAt: Timestamp.fromMillis(msAt(1)) }),
      makeMatch({ id: "b", sport: "tennis", format: "doubles", startAt: Timestamp.fromMillis(msAt(1)) }),
      makeMatch({ id: "c", sport: "pickleball", format: "singles", startAt: Timestamp.fromMillis(msAt(1)) }),
    ];
    const result = filterMatches(
      matches,
      { ...DEFAULT_FILTERS, sport: "tennis", format: "singles" },
      NOW,
    );
    expect(result.map((m) => m.id)).toEqual(["a"]);
  });
});
