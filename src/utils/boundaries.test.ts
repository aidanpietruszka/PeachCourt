import { Timestamp } from "firebase/firestore";
import { describe, expect, it } from "vitest";
import { summarizeActivity } from "./activity";
import { summarize, type ExportEvent, type StatRow } from "./exportStats";
import { distanceBetweenMeters, formatDistance, formatMinutesAgo } from "./geo";

const now = Date.UTC(2026, 9, 24, 15, 0);
const at = (minutes: number) => Timestamp.fromMillis(now + minutes * 60_000);

describe("distance accuracy", () => {
  it("U-94 Atlanta to New York is about 1,200 km", () => {
    const meters = distanceBetweenMeters(33.749, -84.388, 40.7128, -74.006);
    expect(meters).toBeGreaterThan(1_195_000);
    expect(meters).toBeLessThan(1_207_000);
  });

  it("U-95 opposite sides of the equator span half the circumference", () => {
    const meters = distanceBetweenMeters(0, 0, 0, 180);
    expect(Math.abs(meters - Math.PI * 6_371_000)).toBeLessThan(1);
  });

  it("U-96 distance is symmetric", () => {
    const forward = distanceBetweenMeters(33.7756, -84.3963, 33.7851, -84.3738);
    const backward = distanceBetweenMeters(
      33.7851,
      -84.3738,
      33.7756,
      -84.3963,
    );
    expect(forward).toBeCloseTo(backward, 6);
  });
});

describe("formatDistance boundaries", () => {
  it("U-97 exactly 0.1 mi switches to miles", () => {
    expect(formatDistance(160.9344)).toBe("0.1 mi");
  });

  it("U-98 just under 0.1 mi stays in feet", () => {
    expect(formatDistance(160.9)).toBe("528 ft");
  });
});

describe("formatMinutesAgo boundaries", () => {
  it("U-99 29 seconds is just now", () => {
    expect(formatMinutesAgo(new Date(now - 29_000), now)).toBe(
      "Updated just now",
    );
  });

  it("U-100 30 seconds rounds up to 1 min", () => {
    expect(formatMinutesAgo(new Date(now - 30_000), now)).toBe(
      "Updated 1 min ago",
    );
  });

  it("U-101 exactly 60 seconds is 1 min", () => {
    expect(formatMinutesAgo(new Date(now - 60_000), now)).toBe(
      "Updated 1 min ago",
    );
  });

  it("U-102 a time in the future is just now", () => {
    expect(formatMinutesAgo(new Date(now + 120_000), now)).toBe(
      "Updated just now",
    );
  });
});

describe("summarizeActivity boundaries", () => {
  const checkin = (overrides: Record<string, unknown> = {}) => ({
    courtId: "a",
    playerCount: 2,
    scheduledArrivalAt: at(-10),
    expiresAt: at(30),
    active: true,
    ...overrides,
  });
  const game = (overrides: Record<string, unknown> = {}) => ({
    courtId: "a",
    sport: "tennis",
    skillLevel: 3.5,
    startAt: at(30),
    spotsTotal: 3,
    playerUids: [],
    ...overrides,
  });

  it("U-103 a check-in expiring exactly now is not counted", () => {
    const result = summarizeActivity(
      [checkin({ expiresAt: at(0) })],
      [],
      [],
      now,
    );
    expect(result.a).toBeUndefined();
  });

  it("U-104 a check-in expiring one millisecond from now is counted", () => {
    const result = summarizeActivity(
      [checkin({ expiresAt: Timestamp.fromMillis(now + 1) })],
      [],
      [],
      now,
    );
    expect(result.a.checkedIn).toBe(1);
  });

  it("U-105 a check-in without a string court is ignored", () => {
    const result = summarizeActivity(
      [checkin({ courtId: 5 }), checkin({ courtId: null })],
      [],
      [],
      now,
    );
    expect(Object.keys(result)).toEqual([]);
  });

  it("U-106 a check-in with a non-timestamp expiry is ignored", () => {
    const result = summarizeActivity(
      [checkin({ expiresAt: now + 60_000 }), checkin({ expiresAt: null })],
      [],
      [],
      now,
    );
    expect(Object.keys(result)).toEqual([]);
  });

  it("U-107 a report exactly 120 minutes old still counts", () => {
    const result = summarizeActivity(
      [],
      [{ courtId: "a", playerCount: 4, reportedAt: at(-120) }],
      [],
      now,
    );
    expect(result.a.reported).toBe(4);
  });

  it("U-108 a report 121 minutes old is dropped", () => {
    const result = summarizeActivity(
      [],
      [{ courtId: "a", playerCount: 4, reportedAt: at(-121) }],
      [],
      now,
    );
    expect(result.a).toBeUndefined();
  });

  it("U-109 a game starting exactly now is not open", () => {
    const result = summarizeActivity([], [], [game({ startAt: at(0) })], now);
    expect(result.a).toBeUndefined();
  });

  it("U-110 a game one millisecond in the future is open", () => {
    const result = summarizeActivity(
      [],
      [],
      [game({ startAt: Timestamp.fromMillis(now + 1) })],
      now,
    );
    expect(result.a.openGames).toBe(1);
  });

  it("U-111 a full game is not open, one short of full is", () => {
    const full = game({ playerUids: ["x", "y", "z"] });
    const almost = game({ playerUids: ["x", "y"] });
    expect(summarizeActivity([], [], [full], now).a).toBeUndefined();
    expect(summarizeActivity([], [], [almost], now).a.openGames).toBe(1);
  });

  it("U-112 a game with bad fields is ignored", () => {
    const bad = [
      game({ courtId: 5 }),
      game({ startAt: now + 60_000 }),
      game({ playerUids: "none" }),
      game({ skillLevel: 9 }),
    ];
    expect(Object.keys(summarizeActivity([], [], bad, now))).toEqual([]);
  });
});

describe("summarize edge cases", () => {
  const start = Date.UTC(2026, 9, 24, 14, 0);
  const people = [{ id: "P01", signedUpAt: start, method: "email" }];
  const checkIn = (fields: Record<string, unknown>): ExportEvent => ({
    participant: "P01",
    eventName: "check_in",
    timestamp: start,
    ...fields,
  });
  const find = (rows: StatRow[], metric: string) =>
    rows.find((row) => row.metric === metric);

  it("U-113 non-finite numbers are ignored in medians and means", () => {
    const rows = summarize(
      people,
      [
        checkIn({ courtId: "a", playerCount: 2, timeToCheckIn: 4000 }),
        checkIn({
          courtId: "a",
          playerCount: Number.NaN,
          timeToCheckIn: Number.NaN,
        }),
        checkIn({
          courtId: "a",
          playerCount: Number.POSITIVE_INFINITY,
          timeToCheckIn: Number.POSITIVE_INFINITY,
        }),
        checkIn({ courtId: "a", playerCount: "9", timeToCheckIn: "9" }),
      ],
      { a: "Alpha" },
    );
    expect(find(rows, "Median time to check in (s)")).toMatchObject({
      value: 4,
      n: 1,
    });
    expect(find(rows, "Average head count reported")).toMatchObject({
      value: 2,
      n: 1,
    });
  });

  it("U-114 busiest courts rank by count even when the smaller court came first", () => {
    const rows = summarize(
      people,
      [
        checkIn({ courtId: "small" }),
        checkIn({ courtId: "big" }),
        checkIn({ courtId: "big" }),
        checkIn({ courtId: "big" }),
        checkIn({ courtId: "mid" }),
        checkIn({ courtId: "mid" }),
      ],
      { small: "Small", big: "Big", mid: "Mid" },
    );
    const busiest = rows
      .filter((row) => row.metric.startsWith("Busiest court"))
      .map((row) => row.metric);
    expect(busiest).toEqual([
      "Busiest court 1: Big",
      "Busiest court 2: Mid",
      "Busiest court 3: Small",
    ]);
  });

  it("U-115 equal counts are ordered by court name", () => {
    const rows = summarize(
      people,
      [
        checkIn({ courtId: "z" }),
        checkIn({ courtId: "m" }),
        checkIn({ courtId: "a" }),
      ],
      { z: "Zulu", m: "Mike", a: "Alpha" },
    );
    const busiest = rows
      .filter((row) => row.metric.startsWith("Busiest court"))
      .map((row) => row.metric);
    expect(busiest).toEqual([
      "Busiest court 1: Alpha",
      "Busiest court 2: Mike",
      "Busiest court 3: Zulu",
    ]);
  });

  it("U-116 an unnamed court shows as Unknown", () => {
    const rows = summarize(people, [checkIn({ courtId: "ghost" })], {});
    expect(find(rows, "Busiest court 1: Unknown")).toBeDefined();
  });

  it("U-117 no events yields zeros and nulls without throwing", () => {
    const rows = summarize(people, [], {});
    expect(find(rows, "Testers")).toMatchObject({ value: 1 });
    expect(find(rows, "Check-ins")).toMatchObject({ value: 0, n: 0 });
    expect(find(rows, "Median time to check in (s)")).toMatchObject({
      value: null,
    });
  });
});
