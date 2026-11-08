import { describe, expect, it } from "vitest";
import {
  checkInMethod,
  includeInExport,
  mean,
  median,
  participantRows,
  percent,
  rangesMatch,
  summarize,
  type ExportEvent,
  type Participant,
  type StatRow,
} from "./exportStats";

const start = Date.UTC(2026, 9, 24, 14, 0);

function event(
  participant: string,
  eventName: string,
  fields: Record<string, unknown> = {},
): ExportEvent {
  return { participant, eventName, timestamp: start, ...fields };
}

function testers(count: number): Participant[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `P0${index + 1}`,
    signedUpAt: start,
    method: "email",
  }));
}

function stat(rows: StatRow[], metric: string) {
  const row = rows.find((item) => item.metric === metric);
  if (!row) {
    throw new Error(`Missing metric ${metric}`);
  }
  return { value: row.value, n: row.n };
}

describe("summary math", () => {
  it("U-37 median handles odd, even and empty lists", () => {
    expect(median([5, 1, 3])).toBe(3);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(median([])).toBeNull();
  });

  it("U-38 mean and percent return null instead of dividing by zero", () => {
    expect(mean([2, 3, 4])).toBe(3);
    expect(mean([])).toBeNull();
    expect(percent(1, 3)).toBe(33.3);
    expect(percent(0, 0)).toBeNull();
  });
});

describe("summarize", () => {
  it("U-39 counts testers, viewers and check-in rates", () => {
    const rows = summarize(
      testers(4),
      [
        event("P01", "court_viewed", { courtId: "a", reportedCount: null }),
        event("P01", "check_in", { courtId: "a" }),
        event("P02", "court_viewed", { courtId: "a", reportedCount: 2 }),
        event("P03", "check_in", { courtId: "b" }),
      ],
      {},
    );
    expect(stat(rows, "Testers")).toEqual({ value: 4, n: 4 });
    expect(stat(rows, "Testers who viewed a court")).toEqual({
      value: 2,
      n: 4,
    });
    expect(stat(rows, "Testers who checked in")).toEqual({ value: 2, n: 4 });
    expect(stat(rows, "Check-in rate, all testers (%)")).toEqual({
      value: 50,
      n: 4,
    });
    expect(stat(rows, "Check-in rate, testers who viewed a court (%)")).toEqual(
      { value: 50, n: 2 },
    );
  });

  it("U-40 summarizes check-in time, head counts, location and busiest courts", () => {
    const rows = summarize(
      testers(3),
      [
        event("P01", "check_in", {
          courtId: "a",
          timeToCheckIn: 4000,
          playerCount: 2,
          distance: 20,
        }),
        event("P02", "check_in", {
          courtId: "a",
          timeToCheckIn: 2000,
          playerCount: 4,
          distance: null,
        }),
        event("P03", "check_in", {
          courtId: "b",
          timeToCheckIn: 9000,
          playerCount: 3,
          distance: 60,
        }),
        event("P01", "check_out", { courtId: "a" }),
      ],
      { a: "Alpha", b: "Beta" },
    );
    expect(stat(rows, "Median time to check in (s)")).toEqual({
      value: 4,
      n: 3,
    });
    expect(stat(rows, "Check-ins")).toEqual({ value: 3, n: 3 });
    expect(stat(rows, "Check-outs")).toEqual({ value: 1, n: 1 });
    expect(stat(rows, "Average head count reported")).toEqual({
      value: 3,
      n: 3,
    });
    expect(stat(rows, "Check-ins with location on (%)")).toEqual({
      value: 66.7,
      n: 3,
    });
    expect(stat(rows, "Median distance from court (m)")).toEqual({
      value: 40,
      n: 2,
    });
    expect(stat(rows, "Busiest court 1: Alpha")).toEqual({ value: 2, n: 3 });
    expect(stat(rows, "Busiest court 2: Beta")).toEqual({ value: 1, n: 3 });
  });

  it("U-41 trust counts ratings and skips as prompts shown", () => {
    const rows = summarize(
      testers(4),
      [
        event("P01", "trust_rating", { courtId: "a", rating: 4, liveCount: 2 }),
        event("P02", "trust_rating", { courtId: "a", rating: 5, liveCount: 2 }),
        event("P03", "trust_rating", { courtId: "a", rating: 2, liveCount: 1 }),
        event("P04", "trust_skipped", { courtId: "a", liveCount: 1 }),
      ],
      {},
    );
    expect(stat(rows, "Prompts shown")).toEqual({ value: 4, n: 4 });
    expect(stat(rows, "Ratings")).toEqual({ value: 3, n: 4 });
    expect(stat(rows, "Skips")).toEqual({ value: 1, n: 4 });
    expect(stat(rows, "Response rate (%)")).toEqual({ value: 75, n: 4 });
    expect(stat(rows, "Mean rating")).toEqual({ value: 3.67, n: 3 });
    expect(stat(rows, "Median rating")).toEqual({ value: 4, n: 3 });
    expect(stat(rows, "Rated 5")).toEqual({ value: 1, n: 3 });
    expect(stat(rows, "Rated 3")).toEqual({ value: 0, n: 3 });
  });

  it("U-42 games use the first join and a 30 minute window", () => {
    const rows = summarize(
      testers(3),
      [
        event("P01", "match_posted", { matchId: "m1" }),
        event("P01", "match_posted", { matchId: "m2" }),
        event("P01", "match_posted", { matchId: "m3" }),
        event("P02", "match_joined", { matchId: "m1", minutesToJoin: 30 }),
        event("P03", "match_joined", { matchId: "m1", minutesToJoin: 50 }),
        event("P02", "match_joined", { matchId: "m2", minutesToJoin: 31 }),
        event("P02", "match_joined", { matchId: "old", minutesToJoin: 5 }),
      ],
      {},
    );
    expect(stat(rows, "Games posted")).toEqual({ value: 3, n: 3 });
    expect(stat(rows, "Games with at least 1 join")).toEqual({
      value: 2,
      n: 3,
    });
    expect(stat(rows, "Games joined within 30 min")).toEqual({
      value: 1,
      n: 3,
    });
    expect(stat(rows, "Games joined within 30 min (%)")).toEqual({
      value: 33.3,
      n: 3,
    });
    expect(stat(rows, "Median minutes to first join")).toEqual({
      value: 30.5,
      n: 2,
    });
  });

  it("U-43 barriers count answers, skips and each answer's share", () => {
    const rows = summarize(
      testers(3),
      [
        event("P01", "checkin_feedback", { answer: "forgot" }),
        event("P02", "checkin_feedback", { answer: "privacy" }),
        event("P03", "feedback_skipped"),
      ],
      {},
    );
    expect(stat(rows, "Asked")).toEqual({ value: 3, n: 3 });
    expect(stat(rows, "Answered")).toEqual({ value: 2, n: 3 });
    expect(stat(rows, "Skipped")).toEqual({ value: 1, n: 3 });
    expect(stat(rows, "Forgot")).toEqual({ value: 1, n: 2 });
    expect(stat(rows, "Forgot (%)")).toEqual({ value: 50, n: 2 });
    expect(stat(rows, "Too much effort (%)")).toEqual({ value: 0, n: 2 });
  });

  it("U-44 counts court views and distinct courts", () => {
    const rows = summarize(
      testers(2),
      [
        event("P01", "court_viewed", { courtId: "a", reportedCount: 3 }),
        event("P02", "court_viewed", { courtId: "a", reportedCount: null }),
        event("P02", "court_viewed", { courtId: "b", reportedCount: null }),
      ],
      {},
    );
    expect(stat(rows, "Court views")).toEqual({ value: 3, n: 3 });
    expect(stat(rows, "Courts viewed at least once")).toEqual({
      value: 2,
      n: 3,
    });
  });

  it("U-45 no data gives zero counts and empty statistics", () => {
    const rows = summarize([], [], {});
    expect(stat(rows, "Testers")).toEqual({ value: 0, n: 0 });
    expect(stat(rows, "Check-in rate, all testers (%)").value).toBeNull();
    expect(stat(rows, "Mean rating").value).toBeNull();
    expect(stat(rows, "Median minutes to first join").value).toBeNull();
    expect(rows.some((row) => Number.isNaN(row.value))).toBe(false);
  });

  it("U-46 participant rows count each tester's events", () => {
    const rows = participantRows(testers(2), [
      event("P01", "court_viewed", { courtId: "a" }),
      event("P01", "court_viewed", { courtId: "b" }),
      event("P01", "check_in", { courtId: "a" }),
      event("P01", "check_out", { courtId: "a" }),
      event("P02", "trust_rating", { rating: 4 }),
      event("P02", "match_posted", { matchId: "m1" }),
      event("P01", "match_joined", { matchId: "m1" }),
    ]);
    expect(rows).toEqual([
      {
        participant: "P01",
        signedUpAt: start,
        method: "email",
        courtViews: 2,
        checkIns: 1,
        checkOuts: 1,
        trustRatings: 0,
        gamesPosted: 0,
        gamesJoined: 1,
        variant: null,
        locationOn: null,
        autoCheckinNow: null,
        autoOnToOff: 0,
        autoOffToOn: 0,
        autoOffByLocation: 0,
      },
      {
        participant: "P02",
        signedUpAt: start,
        method: "email",
        courtViews: 0,
        checkIns: 0,
        checkOuts: 0,
        trustRatings: 1,
        gamesPosted: 1,
        gamesJoined: 0,
        variant: null,
        locationOn: null,
        autoCheckinNow: null,
        autoOnToOff: 0,
        autoOffToOn: 0,
        autoOffByLocation: 0,
      },
    ]);
  });
});

describe("auto check-in test (SAC-50)", () => {
  const change = (
    participant: string,
    from: boolean,
    to: boolean,
    cause: "user" | "location_off" = "user",
  ) =>
    event(participant, "auto_checkin_changed", {
      wasOn: from,
      isOn: to,
      cause,
      source: "settings",
    });

  const group: Participant[] = [
    { id: "P01", signedUpAt: start, method: "email", variant: "auto_on", locationEnabled: true, autoCheckin: false },
    { id: "P02", signedUpAt: start, method: "email", variant: "auto_on", locationEnabled: true, autoCheckin: true },
    { id: "P03", signedUpAt: start, method: "email", variant: "auto_off", locationEnabled: true, autoCheckin: true },
    { id: "P04", signedUpAt: start, method: "email", variant: "auto_off", locationEnabled: false, autoCheckin: false },
    { id: "P05", signedUpAt: start, method: "email", variant: null, locationEnabled: true, autoCheckin: true },
  ];

  const events = [
    change("P01", true, false),
    change("P01", false, true),
    change("P01", true, false),
    change("P02", true, false, "location_off"),
    change("P03", false, true),
    change("P04", false, true),
    change("P05", true, false),
    event("P01", "check_in", { courtId: "a" }),
    event("P03", "check_in", { courtId: "a" }),
  ];

  it("U-205 counts on-to-off and off-to-on changes per group", () => {
    const rows = summarize(group, events, {});
    expect(stat(rows, "Default on: turned on to off (times)").value).toBe(2);
    expect(stat(rows, "Default on: turned off to on (times)").value).toBe(1);
    expect(stat(rows, "Default off: turned on to off (times)").value).toBe(0);
    expect(stat(rows, "Default off: turned off to on (times)").value).toBe(1);
  });

  it("U-206 only players who allowed location are compared", () => {
    const rows = summarize(group, events, {});
    expect(stat(rows, "Testers in the test")).toEqual({ value: 4, n: 5 });
    expect(
      stat(rows, "Testers in the test who allowed location (compared)"),
    ).toEqual({ value: 3, n: 4 });
    // P04 (location off) and P05 (no variant) never count toward any group.
    expect(stat(rows, "Default off: testers who allowed location").value).toBe(1);
    expect(stat(rows, "Default off: turned off to on (times)").value).toBe(1);
  });

  it("U-207 changes caused by turning location off are counted separately", () => {
    const rows = summarize(group, events, {});
    expect(
      stat(rows, "Default on: turned off by switching location off (times)")
        .value,
    ).toBe(1);
    expect(stat(rows, "Default on: turned on to off (times)").value).toBe(2);
  });

  it("U-208 reports how many compared players are on now and who changed it", () => {
    const rows = summarize(group, events, {});
    expect(stat(rows, "Default on: auto check-in on now (%)")).toEqual({
      value: 50,
      n: 2,
    });
    expect(stat(rows, "Default on: testers who changed the setting (%)")).toEqual({
      value: 50,
      n: 2,
    });
    expect(stat(rows, "Default on: testers who checked in (%)").value).toBe(50);
    expect(stat(rows, "Default off: testers who checked in (%)").value).toBe(100);
  });

  it("U-209 participant rows carry the variant and each tester's change counts", () => {
    const rows = participantRows(group, events);
    const p01 = rows.find((row) => row.participant === "P01");
    expect(p01).toMatchObject({
      variant: "auto_on",
      locationOn: true,
      autoCheckinNow: false,
      autoOnToOff: 2,
      autoOffToOn: 1,
      autoOffByLocation: 0,
    });
    expect(rows.find((row) => row.participant === "P02")).toMatchObject({
      autoOnToOff: 0,
      autoOffByLocation: 1,
    });
  });

  it("U-210 no test data gives zero counts and empty percentages", () => {
    const rows = summarize(testers(2), [], {});
    expect(stat(rows, "Testers in the test").value).toBe(0);
    expect(stat(rows, "Default on: auto check-in on now (%)").value).toBeNull();
    expect(stat(rows, "Default off: turned on to off (times)").value).toBe(0);
  });
});

describe("rangesMatch (Q2)", () => {
  it("U-211 same range returns true", () => {
    expect(rangesMatch(2, 3)).toBe(true);
    expect(rangesMatch(1, 1)).toBe(true);
    expect(rangesMatch(5, 7)).toBe(true);
  });

  it("U-212 different ranges return false", () => {
    expect(rangesMatch(1, 2)).toBe(false);
    expect(rangesMatch(5, 9)).toBe(false);
  });

  it("U-213 non-numeric values return false", () => {
    expect(rangesMatch(null, 2)).toBe(false);
    expect(rangesMatch(2, null)).toBe(false);
    expect(rangesMatch("2", 2)).toBe(false);
    expect(rangesMatch(NaN, 2)).toBe(false);
  });
});

describe("Q2 real count accuracy", () => {
  it("U-214 counts in_person_count events and % where app range matches", () => {
    const events: ExportEvent[] = [
      event("P01", "in_person_count", { courtId: "c1", playerCount: 3, appPlayerCount: 2 }),
      event("P01", "in_person_count", { courtId: "c1", playerCount: 5, appPlayerCount: 1 }),
      event("P02", "in_person_count", { courtId: "c1", playerCount: 7, appPlayerCount: 6 }),
    ];
    const rows = summarize(testers(2), events, {});
    expect(stat(rows, "In-person counts recorded")).toEqual({ value: 3, n: 3 });
    expect(stat(rows, "App range matches real range (%)")).toEqual({ value: 66.7, n: 3 });
  });

  it("U-215 events without appPlayerCount are excluded from Q2", () => {
    const events: ExportEvent[] = [
      event("P01", "in_person_count", { courtId: "c1", playerCount: 3, appPlayerCount: null }),
      event("P01", "in_person_count", { courtId: "c1", playerCount: 3 }),
    ];
    const rows = summarize(testers(1), events, {});
    expect(stat(rows, "In-person counts recorded")).toEqual({ value: 0, n: 0 });
    expect(stat(rows, "App range matches real range (%)")).toEqual({ value: null, n: 0 });
  });
});

describe("Q4 notification-driven joins", () => {
  it("U-216 counts joins and % with notification joinSource", () => {
    const events: ExportEvent[] = [
      event("P01", "match_joined", { matchId: "m1", courtId: "c1", minutesToJoin: 5, joinSource: "push" }),
      event("P01", "match_joined", { matchId: "m2", courtId: "c1", minutesToJoin: 10, joinSource: "browsing" }),
      event("P02", "match_joined", { matchId: "m3", courtId: "c1", minutesToJoin: 2, joinSource: "banner" }),
    ];
    const rows = summarize(testers(2), events, {});
    expect(stat(rows, "Games joined")).toEqual({ value: 3, n: 3 });
    expect(stat(rows, "Joined via notification (%)")).toEqual({ value: 66.7, n: 3 });
  });

  it("U-217 no joins gives null percentage", () => {
    const rows = summarize(testers(1), [], {});
    expect(stat(rows, "Games joined")).toEqual({ value: 0, n: 0 });
    expect(stat(rows, "Joined via notification (%)")).toEqual({ value: null, n: 0 });
  });

  it("U-218 counts notifications sent, opened and the open rate", () => {
    const events: ExportEvent[] = [
      event("P01", "notification_sent", { matchId: "m1", alertType: "new_game" }),
      event("P01", "notification_sent", { matchId: "m2", alertType: "game_reminder" }),
      event("P02", "notification_sent", { matchId: "m3", alertType: "new_message" }),
      event("P01", "notification_opened", { courtId: "c1", source: "push" }),
    ];
    const rows = summarize(testers(2), events, {});
    expect(stat(rows, "Notifications sent")).toEqual({ value: 3, n: 3 });
    expect(stat(rows, "Notifications opened")).toEqual({ value: 1, n: 3 });
    expect(stat(rows, "Open rate (%)")).toEqual({ value: 33.3, n: 3 });
  });

  it("U-219 measures notification joins among Home Screen players only", () => {
    const events: ExportEvent[] = [
      event("P01", "match_joined", { matchId: "m1", minutesToJoin: 5, joinSource: "push", homeScreen: true }),
      event("P01", "match_joined", { matchId: "m2", minutesToJoin: 8, joinSource: "browsing", homeScreen: true }),
      event("P02", "match_joined", { matchId: "m3", minutesToJoin: 2, joinSource: "banner", homeScreen: false }),
    ];
    const rows = summarize(testers(2), events, {});
    expect(
      stat(rows, "Joins from notifications among Home Screen players (%)"),
    ).toEqual({ value: 50, n: 2 });
  });

  it("U-220 empty notification data gives null rates without dividing by zero", () => {
    const rows = summarize(testers(1), [], {});
    expect(stat(rows, "Notifications sent")).toEqual({ value: 0, n: 0 });
    expect(stat(rows, "Open rate (%)")).toEqual({ value: null, n: 0 });
    expect(
      stat(rows, "Joins from notifications among Home Screen players (%)"),
    ).toEqual({ value: null, n: 0 });
  });
});

describe("Q3 wide join window", () => {
  it("U-221 counts games joined within 60 min alongside the 30-min metric", () => {
    const rows = summarize(
      testers(2),
      [
        event("P01", "match_posted", { matchId: "m1" }),
        event("P01", "match_posted", { matchId: "m2" }),
        event("P01", "match_posted", { matchId: "m3" }),
        event("P02", "match_joined", { matchId: "m1", minutesToJoin: 20 }),
        event("P02", "match_joined", { matchId: "m2", minutesToJoin: 45 }),
        event("P03", "match_joined", { matchId: "m3", minutesToJoin: 75 }),
      ],
      {},
    );
    expect(stat(rows, "Games joined within 30 min")).toEqual({ value: 1, n: 3 });
    expect(stat(rows, "Games joined within 60 min")).toEqual({ value: 2, n: 3 });
    expect(stat(rows, "Games joined within 60 min (%)")).toEqual({
      value: 66.7,
      n: 3,
    });
  });

  it("U-222 no posted games gives a null 60-min percentage", () => {
    const rows = summarize(testers(1), [], {});
    expect(stat(rows, "Games joined within 60 min")).toEqual({ value: 0, n: 0 });
    expect(stat(rows, "Games joined within 60 min (%)")).toEqual({
      value: null,
      n: 0,
    });
  });
});

describe("Q1 manual and automatic check-ins per A/B group", () => {
  const group: Participant[] = [
    { id: "P01", signedUpAt: start, method: "email", variant: "auto_on", locationEnabled: true, autoCheckin: true },
    { id: "P02", signedUpAt: start, method: "email", variant: "auto_off", locationEnabled: true, autoCheckin: false },
    { id: "P03", signedUpAt: start, method: "email", variant: "auto_off", locationEnabled: false, autoCheckin: false },
  ];

  it("U-223 splits check-ins by method within each compared group", () => {
    const rows = summarize(
      group,
      [
        event("P01", "check_in", { courtId: "a", method: "auto" }),
        event("P01", "check_in", { courtId: "a" }),
        event("P02", "check_in", { courtId: "a", method: "auto" }),
        event("P03", "check_in", { courtId: "a", method: "auto" }),
      ],
      {},
    );
    expect(stat(rows, "Default on: automatic check-ins")).toEqual({ value: 1, n: 2 });
    expect(stat(rows, "Default on: manual check-ins")).toEqual({ value: 1, n: 2 });
    expect(stat(rows, "Default off: automatic check-ins")).toEqual({ value: 1, n: 1 });
    expect(stat(rows, "Default off: manual check-ins")).toEqual({ value: 0, n: 1 });
  });

  it("U-224 no check-ins gives zero counts", () => {
    const rows = summarize(group, [], {});
    expect(stat(rows, "Default on: automatic check-ins")).toEqual({ value: 0, n: 0 });
    expect(stat(rows, "Default on: manual check-ins")).toEqual({ value: 0, n: 0 });
  });
});

describe("includeInExport (Q2 team handling)", () => {
  const team = new Set(["team-1"]);

  it("U-225 keeps non-team events", () => {
    expect(
      includeInExport({ uid: "tester-1", timestamp: start, eventName: "check_in" }, team),
    ).toBe(true);
  });

  it("U-226 keeps a team in_person_count but drops other team events", () => {
    expect(
      includeInExport({ uid: "team-1", timestamp: start, eventName: "in_person_count" }, team),
    ).toBe(true);
    expect(
      includeInExport({ uid: "team-1", timestamp: start, eventName: "court_viewed" }, team),
    ).toBe(false);
  });

  it("U-227 drops malformed events", () => {
    expect(includeInExport({ timestamp: start, eventName: "check_in" }, team)).toBe(false);
    expect(includeInExport({ uid: "tester-1", eventName: "check_in" }, team)).toBe(false);
  });
});

describe("checkInMethod (Q1 column)", () => {
  it("U-228 reads auto, defaults missing to manual, ignores other events", () => {
    expect(checkInMethod({ eventName: "check_in", method: "auto" })).toBe("auto");
    expect(checkInMethod({ eventName: "check_in", method: "manual" })).toBe("manual");
    expect(checkInMethod({ eventName: "check_in" })).toBe("manual");
    expect(checkInMethod({ eventName: "court_viewed" })).toBeNull();
  });
});
