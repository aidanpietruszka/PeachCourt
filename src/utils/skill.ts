import type { SkillLevel, Sport } from "../types/types";

export const SKILL_LEVELS: Record<Sport, number[]> = {
  tennis: [1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6, 6.5, 7],
  pickleball: [2, 2.5, 3, 3.5, 4, 4.5, 5],
};

export const SPORT_LABEL: Record<Sport, string> = {
  tennis: "Tennis",
  pickleball: "Pickleball",
};

export function isValidSkill(sport: unknown, skillLevel: unknown): boolean {
  if (sport !== "tennis" && sport !== "pickleball") {
    return false;
  }
  return (
    skillLevel === "any" ||
    (typeof skillLevel === "number" && SKILL_LEVELS[sport].includes(skillLevel))
  );
}

export function formatSkill(sport: Sport, skillLevel: SkillLevel): string {
  if (skillLevel === "any") {
    return "Any level";
  }
  const label = skillLevel.toFixed(1);
  return sport === "pickleball" && skillLevel === 5 ? `${label}+` : label;
}
