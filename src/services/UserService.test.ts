import { describe, expect, it } from "vitest";
import { TENNIS_SKILL_LEVELS, PICKLEBALL_SKILL_LEVELS } from "./UserService";

describe("UserService skill level constants", () => {
  it("U-198 tennis skill levels match NTRP scale 1.5 to 7 in half steps", () => {
    expect(TENNIS_SKILL_LEVELS[0]).toBe(1.5);
    expect(TENNIS_SKILL_LEVELS.at(-1)).toBe(7);
    expect(TENNIS_SKILL_LEVELS).toHaveLength(12);
    for (let i = 1; i < TENNIS_SKILL_LEVELS.length; i++) {
      expect(TENNIS_SKILL_LEVELS[i] - TENNIS_SKILL_LEVELS[i - 1]).toBeCloseTo(0.5);
    }
  });

  it("U-199 pickleball skill levels are 2.0 to 5.0 in half steps", () => {
    expect(PICKLEBALL_SKILL_LEVELS[0]).toBe(2);
    expect(PICKLEBALL_SKILL_LEVELS.at(-1)).toBe(5);
    expect(PICKLEBALL_SKILL_LEVELS).toHaveLength(7);
    for (let i = 1; i < PICKLEBALL_SKILL_LEVELS.length; i++) {
      expect(PICKLEBALL_SKILL_LEVELS[i] - PICKLEBALL_SKILL_LEVELS[i - 1]).toBeCloseTo(0.5);
    }
  });
});
