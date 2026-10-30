import type { Court, Sport } from "../types/types";
import type { CourtActivity } from "./activity";
import { timeToMinutes } from "./courts";
import { distanceBetweenMeters } from "./geo";

export type CourtSort = "nearest" | "players" | "games";

export const SURFACES = [
  "Hard",
  "Asphalt",
  "Paved",
  "Concrete",
  "Clay",
  "Acrylic",
] as const;

export const DISTANCE_OPTIONS = [1, 3, 5] as const;

export const FILTER_STORAGE_KEY = "peachcourt-court-filters";

const FIRST_COME = "first come, first served";
const METERS_PER_MILE = 1609.344;
const ATLANTA_TIME_ZONE = "America/New_York";
const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export interface CourtFilters {
  sort: CourtSort;
  playersNow: boolean;
  openGames: boolean;
  openNow: boolean;
  lights: boolean;
  pickleballLines: boolean;
  firstCome: boolean;
  surfaces: string[];
  distanceMiles: number | null;
}

export const DEFAULT_FILTERS: CourtFilters = {
  sort: "nearest",
  playersNow: false,
  openGames: false,
  openNow: false,
  lights: false,
  pickleballLines: false,
  firstCome: false,
  surfaces: [],
  distanceMiles: null,
};

export interface CourtRow {
  court: Court;
  reported: number | null;
  openGames: number;
  players: number;
  distance: number | null;
}

export interface FilterChip {
  key: string;
  label: string;
}

export function parseFilters(value: unknown): CourtFilters {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return { ...DEFAULT_FILTERS, surfaces: [] };
  }
  const raw = value as Record<string, unknown>;
  const flag = (key: keyof CourtFilters) => raw[key] === true;
  const sort: CourtSort =
    raw.sort === "players" || raw.sort === "games" ? raw.sort : "nearest";
  const surfaces = Array.isArray(raw.surfaces)
    ? SURFACES.filter((surface) =>
        (raw.surfaces as unknown[]).includes(surface),
      )
    : [];
  const distanceMiles = (DISTANCE_OPTIONS as readonly unknown[]).includes(
    raw.distanceMiles,
  )
    ? (raw.distanceMiles as number)
    : null;
  return {
    sort,
    playersNow: flag("playersNow"),
    openGames: flag("openGames"),
    openNow: flag("openNow"),
    lights: flag("lights"),
    pickleballLines: flag("pickleballLines"),
    firstCome: flag("firstCome"),
    surfaces: [...surfaces],
    distanceMiles,
  };
}

export function loadFilters(
  storage: Pick<Storage, "getItem"> | null | undefined,
): CourtFilters {
  try {
    const stored = storage?.getItem(FILTER_STORAGE_KEY);
    return parseFilters(stored ? JSON.parse(stored) : null);
  } catch {
    return parseFilters(null);
  }
}

export function saveFilters(
  storage: Pick<Storage, "setItem"> | null | undefined,
  filters: CourtFilters,
): void {
  try {
    storage?.setItem(FILTER_STORAGE_KEY, JSON.stringify(filters));
  } catch {
    return;
  }
}

function parseDayGroup(text: string): Set<number> | null {
  const value = text.trim();
  if (value === "Daily") {
    return new Set(DAY_NAMES.map((_, index) => index));
  }
  const parts = value.split(/[–-]/);
  if (parts.length === 1) {
    const day = DAY_NAMES.indexOf(parts[0]);
    return day === -1 ? null : new Set([day]);
  }
  if (parts.length === 2) {
    const start = DAY_NAMES.indexOf(parts[0]);
    const end = DAY_NAMES.indexOf(parts[1]);
    if (start === -1 || end === -1) {
      return null;
    }
    const days = new Set<number>();
    for (let day = start; ; day = (day + 1) % 7) {
      days.add(day);
      if (day === end) {
        break;
      }
    }
    return days;
  }
  return null;
}

export function atlantaClock(now: number): { day: number; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: ATLANTA_TIME_ZONE,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(now));
  const read = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return {
    day: DAY_NAMES.indexOf(read("weekday")),
    minutes: (Number(read("hour")) % 24) * 60 + Number(read("minute")),
  };
}

export function isOpenNow(
  openingHours: Court["openingHours"] | undefined,
  now: number,
): boolean | null {
  if (!Array.isArray(openingHours)) {
    return null;
  }
  const { day, minutes } = atlantaClock(now);
  let known = false;
  let open = false;
  for (const entry of openingHours) {
    if (!entry || typeof entry.days !== "string") {
      continue;
    }
    const days = parseDayGroup(entry.days);
    const start = timeToMinutes(entry.open);
    const end = timeToMinutes(entry.close);
    if (days === null || start === null || end === null || end <= start) {
      continue;
    }
    known = true;
    if (days.has(day) && minutes >= start && minutes < end) {
      open = true;
    }
  }
  return known ? open : null;
}

export function activeFilterChips(
  filters: CourtFilters,
  hasLocation: boolean,
): FilterChip[] {
  const chips: FilterChip[] = [];
  if (filters.playersNow)
    chips.push({ key: "playersNow", label: "Players now" });
  if (filters.openGames)
    chips.push({ key: "openGames", label: "Has open games" });
  if (filters.openNow) chips.push({ key: "openNow", label: "Open now" });
  if (filters.lights) chips.push({ key: "lights", label: "Lights" });
  if (filters.pickleballLines) {
    chips.push({ key: "pickleballLines", label: "Pickleball lines" });
  }
  if (filters.firstCome) {
    chips.push({ key: "firstCome", label: "First come, first served" });
  }
  for (const surface of filters.surfaces) {
    chips.push({ key: `surface:${surface}`, label: surface });
  }
  if (hasLocation && filters.distanceMiles !== null) {
    chips.push({ key: "distance", label: `${filters.distanceMiles} mi` });
  }
  return chips;
}

export function removeFilter(filters: CourtFilters, key: string): CourtFilters {
  if (key.startsWith("surface:")) {
    const surface = key.slice("surface:".length);
    return {
      ...filters,
      surfaces: filters.surfaces.filter((item) => item !== surface),
    };
  }
  if (key === "distance") {
    return { ...filters, distanceMiles: null };
  }
  if (
    key === "playersNow" ||
    key === "openGames" ||
    key === "openNow" ||
    key === "lights" ||
    key === "pickleballLines" ||
    key === "firstCome"
  ) {
    return { ...filters, [key]: false };
  }
  return filters;
}

export function clearFilters(filters: CourtFilters): CourtFilters {
  return { ...DEFAULT_FILTERS, sort: filters.sort, surfaces: [] };
}

export function toggleSurface(
  filters: CourtFilters,
  surface: string,
): CourtFilters {
  return {
    ...filters,
    surfaces: filters.surfaces.includes(surface)
      ? filters.surfaces.filter((item) => item !== surface)
      : SURFACES.filter(
          (item) => item === surface || filters.surfaces.includes(item),
        ),
  };
}

function matchesSurface(court: Court, surfaces: string[]): boolean {
  if (!Array.isArray(court.surfaces)) {
    return false;
  }
  const wanted = surfaces.map((surface) => surface.toLowerCase());
  return court.surfaces.some(
    (surface) =>
      typeof surface === "string" && wanted.includes(surface.toLowerCase()),
  );
}

function isFirstCome(court: Court): boolean {
  return (
    typeof court.walkOnRules === "string" &&
    court.walkOnRules.trim().toLowerCase() === FIRST_COME
  );
}

export function sportMatches(court: Court, sport: Sport): boolean {
  const tennis =
    typeof court.tennisCourts === "number" && court.tennisCourts > 0;
  const pickleball =
    (typeof court.pickleballCourts === "number" &&
      court.pickleballCourts > 0) ||
    court.pickleballLines === true;
  return sport === "tennis" ? tennis : pickleball;
}

export function buildRows(
  courts: Court[],
  sport: Sport,
  filters: CourtFilters,
  activity: Record<string, CourtActivity>,
  location: [number, number] | null,
  now: number,
): CourtRow[] {
  const maxMeters =
    location && filters.distanceMiles !== null
      ? filters.distanceMiles * METERS_PER_MILE
      : null;

  const rows: CourtRow[] = [];
  for (const court of courts) {
    if (!sportMatches(court, sport)) {
      continue;
    }
    const live = activity[court.id];
    const reported = live?.reported ?? null;
    const checkedIn = live?.checkedIn ?? 0;
    const openGames = live?.openGames ?? 0;
    const distance = location
      ? distanceBetweenMeters(
          location[0],
          location[1],
          court.latitude,
          court.longitude,
        )
      : null;

    if (filters.playersNow && reported === null && checkedIn === 0) continue;
    if (filters.openGames && openGames === 0) continue;
    if (filters.openNow && isOpenNow(court.openingHours, now) !== true)
      continue;
    if (filters.lights && court.hasLights !== true) continue;
    if (filters.pickleballLines && court.pickleballLines !== true) continue;
    if (filters.firstCome && !isFirstCome(court)) continue;
    if (
      filters.surfaces.length > 0 &&
      !matchesSurface(court, filters.surfaces)
    ) {
      continue;
    }
    if (maxMeters !== null && (distance === null || distance > maxMeters)) {
      continue;
    }

    rows.push({
      court,
      reported,
      openGames,
      players: Math.max(reported ?? 0, checkedIn),
      distance,
    });
  }

  const byName = (a: CourtRow, b: CourtRow) =>
    a.court.name.localeCompare(b.court.name);

  return rows.sort((a, b) => {
    if (filters.sort === "players") {
      return b.players - a.players || b.openGames - a.openGames || byName(a, b);
    }
    if (filters.sort === "games") {
      return b.openGames - a.openGames || b.players - a.players || byName(a, b);
    }
    if (a.distance !== null && b.distance !== null) {
      return a.distance - b.distance || byName(a, b);
    }
    return (
      (b.reported ?? 0) + b.openGames - ((a.reported ?? 0) + a.openGames) ||
      byName(a, b)
    );
  });
}

export function sortLabel(sort: CourtSort, hasLocation: boolean): string {
  if (sort === "players") return "Most players";
  if (sort === "games") return "Most open games";
  return hasLocation ? "Nearest first" : "Most active";
}
