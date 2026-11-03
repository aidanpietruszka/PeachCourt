import type { CheckinVariant } from "../types/types";

export const CHECKIN_VARIANTS: readonly CheckinVariant[] = [
  "auto_on",
  "auto_off",
];

export function isCheckinVariant(value: unknown): value is CheckinVariant {
  return value === "auto_on" || value === "auto_off";
}

export function pickCheckinVariant(
  random: () => number = Math.random,
): CheckinVariant {
  return random() < 0.5 ? "auto_on" : "auto_off";
}

export function variantDefaultsToOn(variant: CheckinVariant | undefined) {
  return variant === "auto_on";
}
