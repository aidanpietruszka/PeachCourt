import { describe, expect, it } from "vitest";
import {
  mean,
  median,
  participantRows,
  percent,
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
      },
    ]);
  });
});
