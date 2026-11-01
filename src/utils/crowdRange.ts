export const CROWD_RANGE_MINS = [1, 2, 5, 9, 16] as const;

export type RangeMin = (typeof CROWD_RANGE_MINS)[number];

export interface CrowdRange {
  min: RangeMin;
  label: string;
  countText: string;
}

export const CROWD_RANGES: readonly CrowdRange[] = [
  { min: 1, label: "Just me", countText: "1" },
  { min: 2, label: "A few", countText: "2–4" },
  { min: 5, label: "Busy", countText: "5–8" },
  { min: 9, label: "Packed", countText: "9–15" },
  { min: 16, label: "Very packed", countText: "16+" },
];

export function rangeFromCount(n: number): RangeMin {
  for (let i = CROWD_RANGES.length - 1; i >= 0; i--) {
    if (n >= CROWD_RANGES[i].min) {
      return CROWD_RANGES[i].min;
    }
  }
  return 1;
}

export function displayRange(playerCount: number): string {
  const rangeMin = CROWD_RANGE_MINS.includes(playerCount as RangeMin)
    ? (playerCount as RangeMin)
    : rangeFromCount(playerCount);
  const range = CROWD_RANGES.find((r) => r.min === rangeMin)!;
  if (rangeMin === 1) return range.label;
  return `${range.countText} players`;
}
