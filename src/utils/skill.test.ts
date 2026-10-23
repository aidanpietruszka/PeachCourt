import { describe, expect, it } from "vitest";
import { formatSkill, isValidSkill, SKILL_LEVELS } from "./skill";

describe("SKILL_LEVELS", () => {
  it("U-11 uses NTRP 1.5 to 7.0 in half steps for tennis", () => {
    expect(SKILL_LEVELS.tennis[0]).toBe(1.5);
    expect(SKILL_LEVELS.tennis.at(-1)).toBe(7);
    expect(SKILL_LEVELS.tennis).toHaveLength(12);
  });

  it("U-12 uses 2.0 to 5.0+ in half steps for pickleball", () => {
    expect(SKILL_LEVELS.pickleball).toEqual([2, 2.5, 3, 3.5, 4, 4.5, 5]);
  });
});

describe("isValidSkill", () => {
  it("U-13 accepts any for both sports", () => {
    expect(isValidSkill("tennis", "any")).toBe(true);
    expect(isValidSkill("pickleball", "any")).toBe(true);
  });

  it("U-14 accepts numbers on the sport's scale", () => {
    expect(isValidSkill("tennis", 6.5)).toBe(true);
    expect(isValidSkill("pickleball", 3.5)).toBe(true);
  });

  it("U-15 rejects numbers off the sport's scale", () => {
    expect(isValidSkill("pickleball", 6.5)).toBe(false);
    expect(isValidSkill("tennis", 1)).toBe(false);
    expect(isValidSkill("tennis", 3.25)).toBe(false);
  });

  it("U-16 rejects old word levels and missing sport", () => {
    expect(isValidSkill("tennis", "beginner")).toBe(false);
    expect(isValidSkill(undefined, 3)).toBe(false);
    expect(isValidSkill("golf", 3)).toBe(false);
  });
});

describe("formatSkill", () => {
  it("U-17 labels any", () => {
    expect(formatSkill("tennis", "any")).toBe("Any level");
  });

  it("U-18 shows one decimal", () => {
    expect(formatSkill("tennis", 4)).toBe("4.0");
    expect(formatSkill("tennis", 3.5)).toBe("3.5");
  });

  it("U-19 adds a plus to pickleball 5.0 only", () => {
    expect(formatSkill("pickleball", 5)).toBe("5.0+");
    expect(formatSkill("tennis", 5)).toBe("5.0");
  });
});
