import type { Court, OpeningHours, Sport } from "../types/types";

const UNKNOWN = "Unknown";
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

type SportFields = Pick<
  Court,
  "tennisCourts" | "pickleballCourts" | "pickleballLines"
>;

function isPositiveCount(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

export function courtSports(court: SportFields): Sport[] {
  const sports: Sport[] = [];
  if (isPositiveCount(court.tennisCourts)) {
    sports.push("tennis");
  }
  if (
    isPositiveCount(court.pickleballCourts) ||
    court.pickleballLines === true
  ) {
    sports.push("pickleball");
  }
  return sports;
}

export function formatCount(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return UNKNOWN;
  }
  return String(value);
}

export function formatText(value: string | null | undefined): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    return UNKNOWN;
  }
  return value;
}

export function formatYesNo(value: boolean | null | undefined): string {
  if (typeof value !== "boolean") {
    return UNKNOWN;
  }
  return value ? "Yes" : "No";
}

export function formatSurfaces(surfaces: string[] | null | undefined): string {
  if (!Array.isArray(surfaces)) {
    return UNKNOWN;
  }
  const names = surfaces.filter(
    (name) => typeof name === "string" && name.trim().length > 0,
  );
  return names.length === 0 ? UNKNOWN : names.join(", ");
}

export function formatTime(value: string): string | null {
  const match = TIME_PATTERN.exec(value);
  if (!match) {
    return null;
  }
  const hours = Number(match[1]);
  const minutes = match[2];
  const suffix = hours < 12 ? "AM" : "PM";
  const hour = hours % 12 === 0 ? 12 : hours % 12;
  return minutes === "00"
    ? `${hour} ${suffix}`
    : `${hour}:${minutes} ${suffix}`;
}

export function formatHours(
  openingHours: OpeningHours[] | null | undefined,
): string[] {
  if (!Array.isArray(openingHours)) {
    return [];
  }
  const lines: string[] = [];
  for (const entry of openingHours) {
    if (!entry || typeof entry.days !== "string" || entry.days.trim() === "") {
      continue;
    }
    const open = typeof entry.open === "string" ? formatTime(entry.open) : null;
    const close =
      typeof entry.close === "string" ? formatTime(entry.close) : null;
    if (open === null || close === null) {
      continue;
    }
    lines.push(`${entry.days} ${open}–${close}`);
  }
  return lines;
}

export function courtCountLabel(court: SportFields, sport: Sport): string {
  if (sport === "tennis") {
    return isPositiveCount(court.tennisCourts)
      ? `${court.tennisCourts} tennis ${court.tennisCourts === 1 ? "court" : "courts"}`
      : "Courts unknown";
  }
  if (isPositiveCount(court.pickleballCourts)) {
    return `${court.pickleballCourts} pickleball ${court.pickleballCourts === 1 ? "court" : "courts"}`;
  }
  return court.pickleballLines === true
    ? "Pickleball lines on tennis courts"
    : "Courts unknown";
}

export function timeToMinutes(value: string): number | null {
  const match = typeof value === "string" ? TIME_PATTERN.exec(value) : null;
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

export function courtSummary(
  court: SportFields & { hasLights?: boolean | null },
): string {
  const parts: string[] = [];
  if (isPositiveCount(court.tennisCourts)) {
    parts.push(`${court.tennisCourts} tennis`);
  }
  if (isPositiveCount(court.pickleballCourts)) {
    parts.push(`${court.pickleballCourts} pickleball`);
  } else if (court.pickleballLines === true) {
    parts.push("pickleball lines");
  }
  if (parts.length === 0) {
    parts.push("Courts unknown");
  }
  if (court.hasLights === true) {
    parts.push("Lights");
  }
  return parts.join(" · ");
}
