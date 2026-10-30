import { describe, expect, it } from "vitest";
import type { Court } from "../types/types";
import type { CourtActivity } from "./activity";
import {
  DEFAULT_FILTERS,
  FILTER_STORAGE_KEY,
  activeFilterChips,
  atlantaClock,
  buildRows,
  clearFilters,
  isOpenNow,
  loadFilters,
  parseFilters,
  saveFilters,
  sportMatches,
  toggleSurface,
  type CourtFilters,
} from "./courtFilters";
import { courtSummary, timeToMinutes } from "./courts";

const at = (day: number, hour: number, minute = 0) =>
  Date.UTC(2026, 9, 19 + day, hour + 4, minute);

function court(id: string, overrides: Partial<Court> = {}): Court {
  return {
    id,
    name: id,
    address: "1 Test St",
    latitude: 33.78,
    longitude: -84.38,
    tennisCourts: 2,
    pickleballCourts: 0,
    pickleballLines: false,
    surfaces: ["Hard"],
    hasLights: true,
    openingHours: [{ days: "Daily", open: "07:00", close: "22:00" }],
    walkOnRules: "First come, first served",
    reservationInfo: null,
    ...overrides,
  };
}

function live(overrides: Partial<CourtActivity> = {}): CourtActivity {
  return {
    checkedIn: 0,
    reported: null,
    reportedAt: null,
    openGames: 0,
    ...overrides,
  };
}

function filters(overrides: Partial<CourtFilters> = {}): CourtFilters {
  return { ...DEFAULT_FILTERS, surfaces: [], ...overrides };
}

const noon = at(4, 12);

function ids(rows: { court: Court }[]) {
  return rows.map((row) => row.court.id);
}

describe("timeToMinutes", () => {
  it("U-118 converts valid times", () => {
    expect(timeToMinutes("00:00")).toBe(0);
    expect(timeToMinutes("09:30")).toBe(570);
    expect(timeToMinutes("23:59")).toBe(1439);
  });

  it("U-119 rejects invalid times", () => {
    for (const bad of ["24:00", "9:30", "09:60", "", "noon", "09:30 AM"]) {
      expect(timeToMinutes(bad)).toBeNull();
    }
    expect(timeToMinutes(null as unknown as string)).toBeNull();
  });
});

describe("courtSummary", () => {
  it("U-120 lists tennis and pickleball counts", () => {
    expect(
      courtSummary({
        tennisCourts: 25,
        pickleballCourts: 11,
        pickleballLines: false,
      }),
    ).toBe("25 tennis · 11 pickleball");
  });

  it("U-121 leaves out zero and null counts", () => {
    expect(
      courtSummary({
        tennisCourts: 4,
        pickleballCourts: 0,
        pickleballLines: null,
      }),
    ).toBe("4 tennis");
    expect(
      courtSummary({
        tennisCourts: null,
        pickleballCourts: 6,
        pickleballLines: null,
      }),
    ).toBe("6 pickleball");
  });

  it("U-122 shows pickleball lines when there are no pickleball courts", () => {
    expect(
      courtSummary({
        tennisCourts: 3,
        pickleballCourts: 0,
        pickleballLines: true,
      }),
    ).toBe("3 tennis · pickleball lines");
  });

  it("U-123 prefers the pickleball count over the lines note", () => {
    expect(
      courtSummary({
        tennisCourts: 3,
        pickleballCourts: 2,
        pickleballLines: true,
      }),
    ).toBe("3 tennis · 2 pickleball");
  });

  it("U-124 says unknown when nothing is known", () => {
    expect(
      courtSummary({
        tennisCourts: null,
        pickleballCourts: null,
        pickleballLines: null,
      }),
    ).toBe("Courts unknown");
  });

  it("U-125 appends Lights only when lights are confirmed", () => {
    const base = {
      tennisCourts: 4,
      pickleballCourts: 0,
      pickleballLines: false,
    };
    expect(courtSummary({ ...base, hasLights: true })).toBe(
      "4 tennis · Lights",
    );
    expect(courtSummary({ ...base, hasLights: false })).toBe("4 tennis");
    expect(courtSummary({ ...base, hasLights: null })).toBe("4 tennis");
  });
});

describe("atlantaClock", () => {
  it("U-126 reads Atlanta weekday and minutes in summer time", () => {
    expect(atlantaClock(at(4, 12, 30))).toEqual({ day: 4, minutes: 750 });
  });

  it("U-127 reads Atlanta time in winter time", () => {
    const monday = Date.UTC(2026, 10, 2, 14, 0);
    expect(atlantaClock(monday)).toEqual({ day: 0, minutes: 540 });
  });

  it("U-128 midnight is minute 0 of the new day", () => {
    expect(atlantaClock(at(5, 0, 0))).toEqual({ day: 5, minutes: 0 });
    expect(atlantaClock(at(4, 23, 59))).toEqual({ day: 4, minutes: 1439 });
  });

  it("U-129 the clock does not depend on the device time zone", () => {
    const utcLate = Date.UTC(2026, 9, 31, 3, 30);
    expect(atlantaClock(utcLate)).toEqual({ day: 4, minutes: 23 * 60 + 30 });
  });
});

describe("isOpenNow", () => {
  const daily = [{ days: "Daily", open: "07:00", close: "22:00" }];

  it("U-130 is unknown without hours", () => {
    expect(isOpenNow(null, noon)).toBeNull();
    expect(isOpenNow(undefined, noon)).toBeNull();
    expect(isOpenNow([], noon)).toBeNull();
  });

  it("U-131 is open inside hours and closed outside", () => {
    expect(isOpenNow(daily, at(2, 12))).toBe(true);
    expect(isOpenNow(daily, at(2, 6, 59))).toBe(false);
    expect(isOpenNow(daily, at(2, 22, 30))).toBe(false);
  });

  it("U-132 opens at the opening minute and closes at the closing minute", () => {
    expect(isOpenNow(daily, at(2, 7, 0))).toBe(true);
    expect(isOpenNow(daily, at(2, 21, 59))).toBe(true);
    expect(isOpenNow(daily, at(2, 22, 0))).toBe(false);
  });

  it("U-133 matches Mon-Fri and Sat-Sun groups", () => {
    const hours = [
      { days: "Mon–Fri", open: "09:00", close: "21:00" },
      { days: "Sat–Sun", open: "08:00", close: "18:00" },
    ];
    expect(isOpenNow(hours, at(0, 20))).toBe(true);
    expect(isOpenNow(hours, at(4, 20))).toBe(true);
    expect(isOpenNow(hours, at(5, 20))).toBe(false);
    expect(isOpenNow(hours, at(5, 9))).toBe(true);
    expect(isOpenNow(hours, at(6, 17))).toBe(true);
    expect(isOpenNow(hours, at(6, 18))).toBe(false);
  });

  it("U-134 matches single days and ranges with a hyphen", () => {
    const hours = [
      { days: "Mon-Thu", open: "09:00", close: "21:00" },
      { days: "Fri", open: "09:00", close: "17:00" },
      { days: "Sat", open: "10:00", close: "14:00" },
    ];
    expect(isOpenNow(hours, at(3, 20))).toBe(true);
    expect(isOpenNow(hours, at(4, 20))).toBe(false);
    expect(isOpenNow(hours, at(4, 16))).toBe(true);
    expect(isOpenNow(hours, at(5, 12))).toBe(true);
    expect(isOpenNow(hours, at(6, 12))).toBe(false);
  });

  it("U-135 a day with no group is closed while other days are known", () => {
    const hours = [{ days: "Sat", open: "10:00", close: "14:00" }];
    expect(isOpenNow(hours, at(2, 12))).toBe(false);
  });

  it("U-136 supports ranges that wrap past Sunday", () => {
    const hours = [{ days: "Sat–Mon", open: "09:00", close: "17:00" }];
    expect(isOpenNow(hours, at(6, 10))).toBe(true);
    expect(isOpenNow(hours, at(0, 10))).toBe(true);
    expect(isOpenNow(hours, at(1, 10))).toBe(false);
  });

  it("U-137 ignores malformed entries", () => {
    const bad = [
      { days: "Someday", open: "09:00", close: "17:00" },
      { days: "Daily", open: "9am", close: "5pm" },
      { days: "Daily", open: "17:00", close: "09:00" },
      { days: "Daily", open: "09:00", close: "09:00" },
      { days: "Mon–Tue–Wed", open: "09:00", close: "17:00" },
      null,
    ] as unknown as Court["openingHours"];
    expect(isOpenNow(bad, noon)).toBeNull();
  });

  it("U-188 a day range with one unknown day name is ignored", () => {
    for (const days of ["Mon–Foo", "Foo–Fri", "Foo–Bar"]) {
      expect(
        isOpenNow([{ days, open: "00:00", close: "23:59" }], noon),
      ).toBeNull();
    }
  });

  it("U-189 an entry with only one valid time is ignored", () => {
    for (const hours of [
      { days: "Daily", open: "9am", close: "17:00" },
      { days: "Daily", open: "09:00", close: "5pm" },
      { days: "Daily", open: "", close: "17:00" },
      { days: "Daily", open: "09:00", close: "" },
    ]) {
      expect(isOpenNow([hours], noon)).toBeNull();
    }
  });

  it("U-138 a valid entry still counts next to malformed ones", () => {
    const mixed = [
      { days: "Someday", open: "09:00", close: "17:00" },
      { days: "Daily", open: "09:00", close: "17:00" },
    ];
    expect(isOpenNow(mixed, at(2, 12))).toBe(true);
    expect(isOpenNow(mixed, at(2, 20))).toBe(false);
  });

  it("U-139 uses Atlanta time, not UTC", () => {
    const hours = [{ days: "Daily", open: "07:00", close: "22:00" }];
    expect(isOpenNow(hours, Date.UTC(2026, 9, 30, 3, 0))).toBe(false);
    expect(isOpenNow(hours, Date.UTC(2026, 9, 30, 14, 0))).toBe(true);
  });
});

describe("parseFilters", () => {
  it("U-140 returns defaults for anything that is not an object", () => {
    for (const bad of [null, undefined, 5, "x", true, [], [1, 2]]) {
      expect(parseFilters(bad)).toEqual(DEFAULT_FILTERS);
    }
  });

  it("U-141 keeps valid values", () => {
    const saved = filters({
      sort: "games",
      playersNow: true,
      openGames: true,
      openNow: true,
      lights: true,
      pickleballLines: true,
      firstCome: true,
      surfaces: ["Hard", "Clay"],
      distanceMiles: 3,
    });
    expect(parseFilters(JSON.parse(JSON.stringify(saved)))).toEqual(saved);
  });

  it("U-142 rejects wrong types and unknown values field by field", () => {
    expect(
      parseFilters({
        sort: "random",
        playersNow: "yes",
        lights: 1,
        surfaces: ["Grass", 5, "Hard", "Hard"],
        distanceMiles: 7,
      }),
    ).toEqual(filters({ surfaces: ["Hard"] }));
  });

  it("U-143 rejects a non-array surface list and non-numeric distance", () => {
    expect(parseFilters({ surfaces: "Hard", distanceMiles: "3" })).toEqual(
      DEFAULT_FILTERS,
    );
  });

  it("U-144 orders surfaces in the standard order", () => {
    expect(parseFilters({ surfaces: ["Clay", "Hard"] }).surfaces).toEqual([
      "Hard",
      "Clay",
    ]);
  });

  it("U-145 never shares the default surface array", () => {
    const first = parseFilters(null);
    first.surfaces.push("Hard");
    expect(parseFilters(null).surfaces).toEqual([]);
    expect(DEFAULT_FILTERS.surfaces).toEqual([]);
  });
});

describe("saved filters", () => {
  const memory = (initial: Record<string, string> = {}) => {
    const data = { ...initial };
    return {
      data,
      getItem: (key: string) => data[key] ?? null,
      setItem: (key: string, value: string) => {
        data[key] = value;
      },
    };
  };

  it("U-146 round-trips through storage", () => {
    const store = memory();
    const saved = filters({
      lights: true,
      surfaces: ["Clay"],
      distanceMiles: 5,
    });
    saveFilters(store, saved);
    expect(loadFilters(store)).toEqual(saved);
  });

  it("U-147 loads defaults when nothing is saved", () => {
    expect(loadFilters(memory())).toEqual(DEFAULT_FILTERS);
  });

  it("U-148 loads defaults for corrupt JSON", () => {
    expect(loadFilters(memory({ [FILTER_STORAGE_KEY]: "{not json" }))).toEqual(
      DEFAULT_FILTERS,
    );
  });

  it("U-149 loads defaults for JSON of the wrong shape", () => {
    expect(loadFilters(memory({ [FILTER_STORAGE_KEY]: "42" }))).toEqual(
      DEFAULT_FILTERS,
    );
    expect(loadFilters(memory({ [FILTER_STORAGE_KEY]: "null" }))).toEqual(
      DEFAULT_FILTERS,
    );
  });

  it("U-150 survives storage that throws or is missing", () => {
    const broken = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    };
    expect(loadFilters(broken)).toEqual(DEFAULT_FILTERS);
    expect(() => saveFilters(broken, DEFAULT_FILTERS)).not.toThrow();
    expect(loadFilters(null)).toEqual(DEFAULT_FILTERS);
    expect(() => saveFilters(null, DEFAULT_FILTERS)).not.toThrow();
  });
});

describe("filter chips and edits", () => {
  it("U-151 no filters means no chips", () => {
    expect(activeFilterChips(DEFAULT_FILTERS, true)).toEqual([]);
  });

  it("U-152 sort alone is not a chip", () => {
    expect(activeFilterChips(filters({ sort: "games" }), true)).toEqual([]);
  });

  it("U-153 each active filter is one chip in a stable order", () => {
    const chips = activeFilterChips(
      filters({
        playersNow: true,
        openGames: true,
        openNow: true,
        lights: true,
        pickleballLines: true,
        firstCome: true,
        surfaces: ["Hard", "Clay"],
        distanceMiles: 3,
      }),
      true,
    );
    expect(chips.map((chip) => chip.label)).toEqual([
      "Players now",
      "Has open games",
      "Open now",
      "Lights",
      "Pickleball lines",
      "First come, first served",
      "Hard",
      "Clay",
      "3 mi",
    ]);
  });

  it("U-154 distance is not a chip without location", () => {
    expect(activeFilterChips(filters({ distanceMiles: 3 }), false)).toEqual([]);
  });

  it("U-157 clear all keeps the chosen sort", () => {
    const cleared = clearFilters(
      filters({ sort: "players", lights: true, surfaces: ["Hard"] }),
    );
    expect(cleared).toEqual(filters({ sort: "players" }));
  });

  it("U-158 toggling a surface adds it in order and removes it again", () => {
    const withClay = toggleSurface(DEFAULT_FILTERS, "Clay");
    const withBoth = toggleSurface(withClay, "Hard");
    expect(withBoth.surfaces).toEqual(["Hard", "Clay"]);
    expect(toggleSurface(withBoth, "Hard").surfaces).toEqual(["Clay"]);
    expect(DEFAULT_FILTERS.surfaces).toEqual([]);
  });
});

describe("sportMatches", () => {
  it("U-159 matches tennis and pickleball like the derived sports rule", () => {
    const tennisOnly = court("a", { tennisCourts: 2, pickleballCourts: 0 });
    const lines = court("b", {
      tennisCourts: 3,
      pickleballCourts: 0,
      pickleballLines: true,
    });
    const pickleOnly = court("c", { tennisCourts: 0, pickleballCourts: 4 });
    const unknown = court("d", {
      tennisCourts: null,
      pickleballCourts: null,
      pickleballLines: null,
    });
    expect(sportMatches(tennisOnly, "tennis")).toBe(true);
    expect(sportMatches(tennisOnly, "pickleball")).toBe(false);
    expect(sportMatches(lines, "pickleball")).toBe(true);
    expect(sportMatches(lines, "tennis")).toBe(true);
    expect(sportMatches(pickleOnly, "tennis")).toBe(false);
    expect(sportMatches(pickleOnly, "pickleball")).toBe(true);
    expect(sportMatches(unknown, "tennis")).toBe(false);
    expect(sportMatches(unknown, "pickleball")).toBe(false);
  });
});

describe("buildRows filtering", () => {
  const courts = [
    court("lit-hard", {
      hasLights: true,
      surfaces: ["Hard"],
      pickleballCourts: 2,
    }),
    court("dark-clay", { hasLights: false, surfaces: ["Clay"] }),
    court("unknown", {
      hasLights: null,
      surfaces: null,
      openingHours: null,
      walkOnRules: null,
      pickleballLines: null,
    }),
    court("lines", {
      pickleballLines: true,
      surfaces: ["Asphalt", "Hard"],
      walkOnRules: "Members only",
    }),
  ];

  const run = (
    overrides: Partial<CourtFilters>,
    sport: "tennis" | "pickleball" = "tennis",
    activity: Record<string, CourtActivity> = {},
    location: [number, number] | null = null,
    time = noon,
  ) =>
    ids(buildRows(courts, sport, filters(overrides), activity, location, time));

  it("U-160 no filters returns every court of the sport", () => {
    expect(run({}).sort()).toEqual([
      "dark-clay",
      "lines",
      "lit-hard",
      "unknown",
    ]);
    expect(run({}, "pickleball").sort()).toEqual(["lines", "lit-hard"]);
  });

  it("U-161 lights keeps only confirmed lights and hides unknown", () => {
    expect(run({ lights: true }).sort()).toEqual(["lines", "lit-hard"]);
    expect(run({ lights: true })).not.toContain("unknown");
    expect(run({ lights: true })).not.toContain("dark-clay");
  });

  it("U-162 pickleball lines needs the flag to be true", () => {
    expect(run({ pickleballLines: true })).toEqual(["lines"]);
  });

  it("U-163 first come first served matches the walk-on text only", () => {
    const result = run({ firstCome: true });
    expect(result).toContain("lit-hard");
    expect(result).not.toContain("lines");
    expect(result).not.toContain("unknown");
  });

  it("U-164 first come first served ignores case and spacing", () => {
    const sample = [court("x", { walkOnRules: "  FIRST COME, FIRST SERVED " })];
    expect(
      ids(
        buildRows(
          sample,
          "tennis",
          filters({ firstCome: true }),
          {},
          null,
          noon,
        ),
      ),
    ).toEqual(["x"]);
  });

  it("U-165 surface filter matches any selected surface", () => {
    expect(run({ surfaces: ["Clay"] })).toEqual(["dark-clay"]);
    expect(run({ surfaces: ["Hard", "Clay"] }).sort()).toEqual(
      ["dark-clay", "lines", "lit-hard"].sort(),
    );
    expect(run({ surfaces: ["Asphalt"] })).toEqual(["lines"]);
    expect(run({ surfaces: ["Acrylic"] })).toEqual([]);
  });

  it("U-166 surface filter hides courts with unknown surfaces", () => {
    expect(run({ surfaces: ["Hard", "Clay", "Asphalt"] })).not.toContain(
      "unknown",
    );
  });

  it("U-167 open now keeps only courts known to be open", () => {
    expect(run({ openNow: true })).not.toContain("unknown");
    expect(run({ openNow: true }, "tennis", {}, null, at(2, 3))).toEqual([]);
    expect(run({ openNow: true }, "tennis", {}, null, at(2, 12)).length).toBe(
      3,
    );
  });

  it("U-168 players now needs a report or a check-in", () => {
    const activity = {
      "lit-hard": live({ reported: 4 }),
      "dark-clay": live({ checkedIn: 1 }),
      lines: live({ openGames: 3 }),
    };
    expect(run({ playersNow: true }, "tennis", activity).sort()).toEqual([
      "dark-clay",
      "lit-hard",
    ]);
  });

  it("U-169 a report of zero-like data still counts as a report", () => {
    expect(
      run({ playersNow: true }, "tennis", { unknown: live({ reported: 1 }) }),
    ).toEqual(["unknown"]);
  });

  it("U-170 has open games needs at least one open game", () => {
    const activity = {
      lines: live({ openGames: 1 }),
      unknown: live({ openGames: 0, reported: 5 }),
    };
    expect(run({ openGames: true }, "tennis", activity)).toEqual(["lines"]);
  });

  it("U-171 distance keeps courts within the limit", () => {
    const near = court("near", { latitude: 33.78, longitude: -84.38 });
    const mid = court("mid", { latitude: 33.78, longitude: -84.3 });
    const far = court("far", { latitude: 33.9, longitude: -84.38 });
    const here: [number, number] = [33.78, -84.38];
    const pick = (miles: number) =>
      ids(
        buildRows(
          [near, mid, far],
          "tennis",
          filters({ distanceMiles: miles }),
          {},
          here,
          noon,
        ),
      );
    expect(pick(1)).toEqual(["near"]);
    expect(pick(5)).toEqual(["near", "mid"]);
    expect(pick(1).includes("far")).toBe(false);
  });

  it("U-172 distance is ignored without location", () => {
    expect(run({ distanceMiles: 1 }).length).toBe(4);
  });

  it("U-173 a court exactly at the limit is included", () => {
    const here: [number, number] = [33.78, -84.38];
    const edge = court("edge", { latitude: 33.78, longitude: -84.38 });
    expect(
      ids(
        buildRows(
          [edge],
          "tennis",
          filters({ distanceMiles: 1 }),
          {},
          here,
          noon,
        ),
      ),
    ).toEqual(["edge"]);
  });

  it("U-174 filters combine with and", () => {
    expect(run({ lights: true, surfaces: ["Hard"] }).sort()).toEqual([
      "lines",
      "lit-hard",
    ]);
    expect(run({ lights: true, surfaces: ["Clay"] })).toEqual([]);
    expect(run({ lights: true, pickleballLines: true })).toEqual(["lines"]);
  });

  it("U-175 the sport filter applies before the other filters", () => {
    expect(run({ lights: true }, "pickleball").sort()).toEqual([
      "lines",
      "lit-hard",
    ]);
  });

  it("U-176 an empty court list gives no rows", () => {
    expect(buildRows([], "tennis", DEFAULT_FILTERS, {}, null, noon)).toEqual(
      [],
    );
  });

  it("U-177 rows carry live data and distance", () => {
    const here: [number, number] = [33.78, -84.38];
    const rows = buildRows(
      [court("a")],
      "tennis",
      DEFAULT_FILTERS,
      { a: live({ reported: 6, checkedIn: 2, openGames: 4 }) },
      here,
      noon,
    );
    expect(rows[0]).toMatchObject({
      reported: 6,
      openGames: 4,
      players: 6,
      distance: 0,
    });
  });

  it("U-190 a court with zero reports keeps 0, not null", () => {
    const rows = buildRows(
      [court("a")],
      "tennis",
      DEFAULT_FILTERS,
      { a: live({ reported: 0, checkedIn: 0, openGames: 0 }) },
      null,
      noon,
    );
    expect(rows[0].reported).toBe(0);
  });

  it("U-191 activity fallback adds reports and open games", () => {
    const order = (high: string, low: string) =>
      buildRows(
        [court("a"), court("b")],
        "tennis",
        DEFAULT_FILTERS,
        {
          [high]: live({ reported: 4, checkedIn: 0, openGames: 2 }),
          [low]: live({ reported: 2, checkedIn: 0, openGames: 3 }),
        },
        null,
        noon,
      ).map((row) => row.court.id);
    expect(order("a", "b")).toEqual(["a", "b"]);
    expect(order("b", "a")).toEqual(["b", "a"]);
  });

  it("U-178 players is the larger of the report and the check-ins", () => {
    const rows = buildRows(
      [court("a"), court("b")],
      "tennis",
      DEFAULT_FILTERS,
      {
        a: live({ reported: 2, checkedIn: 5 }),
        b: live({ reported: null, checkedIn: 0 }),
      },
      null,
      noon,
    );
    const byId = Object.fromEntries(rows.map((row) => [row.court.id, row]));
    expect(byId.a.players).toBe(5);
    expect(byId.b.players).toBe(0);
  });
});

describe("buildRows sorting", () => {
  const here: [number, number] = [33.78, -84.38];
  const courts = [
    court("c-far", { latitude: 33.9, longitude: -84.38 }),
    court("a-near", { latitude: 33.781, longitude: -84.38 }),
    court("b-mid", { latitude: 33.82, longitude: -84.38 }),
  ];
  const activity = {
    "c-far": live({ reported: 9, openGames: 0 }),
    "a-near": live({ reported: null, openGames: 1 }),
    "b-mid": live({ reported: 3, openGames: 5 }),
  };
  const order = (
    sort: CourtFilters["sort"],
    location: [number, number] | null,
  ) =>
    ids(
      buildRows(courts, "tennis", filters({ sort }), activity, location, noon),
    );

  it("U-179 nearest sorts by distance", () => {
    expect(order("nearest", here)).toEqual(["a-near", "b-mid", "c-far"]);
  });

  it("U-180 most players sorts by head count", () => {
    expect(order("players", here)).toEqual(["c-far", "b-mid", "a-near"]);
  });

  it("U-181 most open games sorts by game count", () => {
    expect(order("games", here)).toEqual(["b-mid", "a-near", "c-far"]);
  });

  it("U-182 nearest without location falls back to activity", () => {
    expect(order("nearest", null)).toEqual(["c-far", "b-mid", "a-near"]);
  });

  it("U-183 sort ties break by name", () => {
    const tied = [court("z"), court("m"), court("a")];
    for (const sort of ["nearest", "players", "games"] as const) {
      expect(
        ids(buildRows(tied, "tennis", filters({ sort }), {}, null, noon)),
      ).toEqual(["a", "m", "z"]);
    }
  });

  it("U-184 equal distances break by name", () => {
    const same = [court("b"), court("a")];
    expect(
      ids(buildRows(same, "tennis", DEFAULT_FILTERS, {}, here, noon)),
    ).toEqual(["a", "b"]);
  });

  it("U-185 players ties break by open games, games ties by players", () => {
    const tie = [court("a"), court("b")];
    const playersTie = {
      a: live({ reported: 4, openGames: 0 }),
      b: live({ reported: 4, openGames: 2 }),
    };
    expect(
      ids(
        buildRows(
          tie,
          "tennis",
          filters({ sort: "players" }),
          playersTie,
          null,
          noon,
        ),
      ),
    ).toEqual(["b", "a"]);
    const gamesTie = {
      a: live({ reported: 1, openGames: 2 }),
      b: live({ reported: 6, openGames: 2 }),
    };
    expect(
      ids(
        buildRows(
          tie,
          "tennis",
          filters({ sort: "games" }),
          gamesTie,
          null,
          noon,
        ),
      ),
    ).toEqual(["b", "a"]);
  });

  it("U-186 sorting does not change the input order of courts", () => {
    const input = [...courts];
    buildRows(
      input,
      "tennis",
      filters({ sort: "players" }),
      activity,
      here,
      noon,
    );
    expect(ids(input.map((item) => ({ court: item })))).toEqual([
      "c-far",
      "a-near",
      "b-mid",
    ]);
  });
});
