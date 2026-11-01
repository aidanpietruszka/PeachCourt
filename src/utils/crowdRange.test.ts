import { describe, expect, it } from "vitest";
import {
  CROWD_RANGE_MINS,
  CROWD_RANGES,
  displayRange,
  rangeFromCount,
} from "./crowdRange";

describe("CROWD_RANGE_MINS", () => {
  it("contains exactly five range minimums", () => {
    expect(CROWD_RANGE_MINS).toEqual([1, 2, 5, 9, 16]);
  });
});

describe("CROWD_RANGES", () => {
  it("has one entry per range minimum", () => {
    expect(CROWD_RANGES.map((r) => r.min)).toEqual([...CROWD_RANGE_MINS]);
  });

  it("labels match the five crowd levels", () => {
    const labels = CROWD_RANGES.map((r) => r.label);
    expect(labels).toEqual([
      "Just me",
      "A few",
      "Busy",
      "Packed",
      "Very packed",
    ]);
  });
});

describe("rangeFromCount", () => {
  it("returns 1 for count of 1", () => {
    expect(rangeFromCount(1)).toBe(1);
  });

  it("returns 2 for counts 2 through 4", () => {
    expect(rangeFromCount(2)).toBe(2);
    expect(rangeFromCount(3)).toBe(2);
    expect(rangeFromCount(4)).toBe(2);
  });

  it("returns 5 for counts 5 through 8", () => {
    expect(rangeFromCount(5)).toBe(5);
    expect(rangeFromCount(8)).toBe(5);
  });

  it("returns 9 for counts 9 through 15", () => {
    expect(rangeFromCount(9)).toBe(9);
    expect(rangeFromCount(15)).toBe(9);
  });

  it("returns 16 for counts 16 and above", () => {
    expect(rangeFromCount(16)).toBe(16);
    expect(rangeFromCount(20)).toBe(16);
    expect(rangeFromCount(100)).toBe(16);
  });

  it("returns 1 for values below 1", () => {
    expect(rangeFromCount(0)).toBe(1);
    expect(rangeFromCount(-5)).toBe(1);
  });
});

describe("displayRange", () => {
  it("returns 'Just me' for playerCount 1", () => {
    expect(displayRange(1)).toBe("Just me");
  });

  it("returns count range string for range minimums", () => {
    expect(displayRange(2)).toBe("2–4 players");
    expect(displayRange(5)).toBe("5–8 players");
    expect(displayRange(9)).toBe("9–15 players");
    expect(displayRange(16)).toBe("16+ players");
  });

  it("maps non-minimum values to the correct range", () => {
    expect(displayRange(3)).toBe("2–4 players");
    expect(displayRange(4)).toBe("2–4 players");
    expect(displayRange(6)).toBe("5–8 players");
    expect(displayRange(10)).toBe("9–15 players");
    expect(displayRange(20)).toBe("16+ players");
  });
});
