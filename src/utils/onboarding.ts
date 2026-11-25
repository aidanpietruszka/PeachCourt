import type { UserProfile } from "../types/types";

export function onboardingComplete(profile: UserProfile | null): boolean {
  return profile?.onboardingDone === true;
}

export function resumeStep(profile: UserProfile | null): 1 | 2 | 3 {
  if (!profile || profile.sports.length === 0) {
    return 1;
  }
  if (profile.locationEnabled === undefined) {
    return 2;
  }
  return 3;
}
