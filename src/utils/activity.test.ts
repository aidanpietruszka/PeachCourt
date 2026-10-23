import { Timestamp } from "firebase/firestore";
import { describe, expect, it } from "vitest";
import {
  EMPTY_ACTIVITY,
  summarizeActivity,
  type CourtReport,
} from "./activity";

const now = Date.UTC(2026, 9, 24, 15, 0);
const minutes = (value: number) => Timestamp.fromMillis(now + value * 60_000);

function checkin(courtId: string, startMinutes: number, endMinutes: number) {
  return {
    courtId,
    playerCount: 4,
    scheduledArrivalAt: minutes(startMinutes),
    expiresAt: minutes(endMinutes),
    active: true,
  };
}

function report(
  courtId: string,
  playerCount: number,
  atMinutes: number,
): CourtReport {
  return { courtId, playerCount, reportedAt: minutes(atMinutes) };
}

function match(courtId: string, overrides: Record<string, unknown> = {}) {
  return {
    courtId,
    sport: "tennis",
    skillLevel: 3.5,
    startAt: minutes(60),
    spotsTotal: 3,
    playerUids: [],
    ...overrides,
  };
}

describe("summarizeActivity", () => {
  it("U-27 returns nothing when there is no data", () => {
    expect(summarizeActivity([], [], [], now)).toEqual({});
  });

  it("U-28 counts each active check-in once, not its head count", () => {
    const result = summarizeActivity(
      [checkin("a", -10, 110), checkin("a", -5, 115)],
      [],
      [],
      now,
    );
    expect(result.a.checkedIn).toBe(2);
  });

  it("U-29 counts a check-in made just now and ignores expired ones", () => {
    const result = summarizeActivity(
      [checkin("a", 1, 121), checkin("a", -130, -10)],
      [],
      [],
      now,
    );
    expect(result.a.checkedIn).toBe(1);
  });

  it("U-30 counts older check-ins that have no arrival time", () => {
    const result = summarizeActivity(
      [{ courtId: "a", checkedInAt: minutes(-5), expiresAt: minutes(115) }],
      [],
      [],
      now,
    );
    expect(result.a.checkedIn).toBe(1);
  });

  it("U-31 shows the latest report and its time", () => {
    const result = summarizeActivity([], [report("a", 2, -3)], [], now);
    expect(result.a.reported).toBe(2);
    expect(result.a.reportedAt?.getTime()).toBe(now - 3 * 60_000);
  });

  it("U-32 keeps the report after everyone checks out", () => {
    const result = summarizeActivity([], [report("a", 2, -30)], [], now);
    expect(result.a).toEqual({
      ...EMPTY_ACTIVITY,
      reported: 2,
      reportedAt: result.a.reportedAt,
    });
  });

  it("U-33 drops reports older than 2 hours", () => {
    const result = summarizeActivity([], [report("a", 2, -121)], [], now);
    expect(result.a).toBeUndefined();
  });

  it("U-34 counts open future games only", () => {
    const result = summarizeActivity(
      [],
      [],
      [
        match("a"),
        match("a", { playerUids: ["x", "y", "z"] }),
        match("a", { startAt: minutes(-1) }),
      ],
      now,
    );
    expect(result.a.openGames).toBe(1);
  });

  it("U-35 ignores games with invalid skill levels", () => {
    const result = summarizeActivity(
      [],
      [],
      [
        match("a", { skillLevel: "beginner" }),
        match("a", { sport: undefined }),
      ],
      now,
    );
    expect(result.a).toBeUndefined();
  });

  it("U-36 keeps courts separate", () => {
    const result = summarizeActivity(
      [checkin("a", -1, 119)],
      [report("b", 5, -1)],
      [match("c")],
      now,
    );
    expect(result.a.checkedIn).toBe(1);
    expect(result.b.reported).toBe(5);
    expect(result.c.openGames).toBe(1);
  });
});
