import { describe, expect, it } from "vitest";
import courtsJson from "../../scripts/courts.json";
import { courtSports, formatHours } from "./courts";

interface CourtRecord {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  tennisCourts: number | null;
  pickleballCourts: number | null;
  pickleballLines: boolean | null;
  surfaces: string[] | null;
  hasLights: boolean | null;
  openingHours: { days: string; open: string; close: string }[] | null;
  walkOnRules: string | null;
  reservationInfo: string | null;
  sports: string[];
  numberOfCourts: number;
  surface: string;
  hours: string;
}

const COURTS = courtsJson as unknown as CourtRecord[];
const REMOVED_IDS = ["georgia-tech", "georgia-tech-courts", "piedmont-park"];
const NEW_FIELDS = [
  "tennisCourts",
  "pickleballCourts",
  "pickleballLines",
  "surfaces",
  "hasLights",
  "openingHours",
  "walkOnRules",
  "reservationInfo",
] as const;
const LEGACY_FIELDS = ["sports", "numberOfCourts", "surface", "hours"] as const;

describe("courts.json", () => {
  it("U-79 has 58 records with unique ids", () => {
    expect(COURTS).toHaveLength(58);
    expect(new Set(COURTS.map((court) => court.id)).size).toBe(58);
  });

  it("U-80 has none of the removed ids", () => {
    for (const id of REMOVED_IDS) {
      expect(COURTS.some((court) => court.id === id)).toBe(false);
    }
  });

  it("U-81 renamed courts are present", () => {
    for (const id of [
      "ken-byers-tennis-complex",
      "peters-parking-deck",
      "piedmont-driving-club",
    ]) {
      expect(COURTS.some((court) => court.id === id)).toBe(true);
    }
  });

  it("U-82 every record has every new and legacy field", () => {
    for (const court of COURTS) {
      for (const field of [...NEW_FIELDS, ...LEGACY_FIELDS]) {
        expect(court, `${court.id} ${field}`).toHaveProperty(field);
      }
    }
  });

  it("U-83 ids, names and addresses are non-empty strings", () => {
    for (const court of COURTS) {
      expect(court.id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(court.name.trim()).not.toBe("");
      expect(court.address.trim()).not.toBe("");
    }
  });

  it("U-84 coordinates fall in the Atlanta area", () => {
    for (const court of COURTS) {
      expect(court.latitude, court.id).toBeGreaterThan(33.5);
      expect(court.latitude, court.id).toBeLessThan(34.1);
      expect(court.longitude, court.id).toBeGreaterThan(-84.7);
      expect(court.longitude, court.id).toBeLessThan(-84.1);
    }
  });

  it("U-85 counts are null or non-negative integers", () => {
    for (const court of COURTS) {
      for (const value of [court.tennisCourts, court.pickleballCourts]) {
        expect(
          value === null || (Number.isInteger(value) && value >= 0),
          court.id,
        ).toBe(true);
      }
    }
  });

  it("U-86 lines and lights are boolean or null", () => {
    for (const court of COURTS) {
      for (const value of [court.pickleballLines, court.hasLights]) {
        expect(value === null || typeof value === "boolean", court.id).toBe(
          true,
        );
      }
    }
  });

  it("U-87 surfaces are null or a non-empty list of names", () => {
    for (const court of COURTS) {
      if (court.surfaces === null) {
        continue;
      }
      expect(Array.isArray(court.surfaces), court.id).toBe(true);
      expect(court.surfaces.length, court.id).toBeGreaterThan(0);
      for (const name of court.surfaces) {
        expect(name.trim(), court.id).not.toBe("");
      }
    }
  });

  it("U-88 text fields are null or non-empty and never the word Unknown", () => {
    for (const court of COURTS) {
      for (const value of [court.walkOnRules, court.reservationInfo]) {
        if (value === null) {
          continue;
        }
        expect(value.trim(), court.id).not.toBe("");
        expect(value, court.id).not.toBe("Unknown");
      }
    }
  });

  it("U-89 opening hours are null or fully well-formed", () => {
    for (const court of COURTS) {
      if (court.openingHours === null) {
        continue;
      }
      expect(court.openingHours.length, court.id).toBeGreaterThan(0);
      expect(formatHours(court.openingHours), court.id).toHaveLength(
        court.openingHours.length,
      );
      for (const entry of court.openingHours) {
        expect(entry.open < entry.close, `${court.id} ${entry.days}`).toBe(
          true,
        );
      }
    }
  });

  it("U-90 walk-on rules use the approved values", () => {
    const allowed = [
      "First come, first served",
      "Members only",
      "Reservation required",
      null,
    ];
    for (const court of COURTS) {
      expect(allowed, court.id).toContain(court.walkOnRules);
    }
  });

  it("U-91 every court is listed under at least one sport", () => {
    for (const court of COURTS) {
      expect(courtSports(court).length, court.id).toBeGreaterThan(0);
    }
  });

  it("U-92 the legacy sports field matches the derived sports", () => {
    for (const court of COURTS) {
      expect([...court.sports].sort(), court.id).toEqual(
        [...courtSports(court)].sort(),
      );
    }
  });

  it("U-93 the legacy court count is the larger of the two counts", () => {
    for (const court of COURTS) {
      const total = Math.max(
        court.tennisCourts ?? 0,
        court.pickleballCourts ?? 0,
      );
      expect(court.numberOfCourts, court.id).toBeGreaterThanOrEqual(total);
    }
  });
});
