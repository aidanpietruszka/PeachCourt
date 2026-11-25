import { describe, expect, it } from "vitest";
import type { UserProfile } from "../types/types";
import { onboardingComplete, resumeStep } from "./onboarding";

function profile(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    firstName: "Ada",
    lastName: "Lovelace",
    sports: ["tennis"],
    skillLevels: { tennis: 3.5 },
    ...overrides,
  };
}

describe("resumeStep", () => {
  it("U-271 returns step 1 when there is no profile", () => {
    expect(resumeStep(null)).toBe(1);
  });

  it("U-272 returns step 1 when the profile has no sports", () => {
    expect(resumeStep(profile({ sports: [], skillLevels: {} }))).toBe(1);
  });

  it("U-273 returns step 2 when sports are set but no location choice was saved", () => {
    expect(resumeStep(profile({ locationEnabled: undefined }))).toBe(2);
  });

  it("U-274 returns step 3 once a location choice was saved (off)", () => {
    expect(resumeStep(profile({ locationEnabled: false }))).toBe(3);
  });

  it("U-275 returns step 3 once a location choice was saved (on)", () => {
    expect(resumeStep(profile({ locationEnabled: true }))).toBe(3);
  });
});

describe("onboardingComplete", () => {
  it("U-276 is false when there is no profile", () => {
    expect(onboardingComplete(null)).toBe(false);
  });

  it("U-277 is false when onboardingDone is missing", () => {
    expect(onboardingComplete(profile())).toBe(false);
  });

  it("U-278 is false when onboardingDone is false", () => {
    expect(onboardingComplete(profile({ onboardingDone: false }))).toBe(false);
  });

  it("U-279 is true only when onboardingDone is true", () => {
    expect(onboardingComplete(profile({ onboardingDone: true }))).toBe(true);
  });
});
