import { describe, expect, it } from "vitest";
import {
  distanceBetweenMeters,
  formatActivity,
  formatDistance,
  formatMinutesAgo,
} from "./geo";

describe("distanceBetweenMeters", () => {
  it("U-01 returns 0 for the same point", () => {
    expect(distanceBetweenMeters(33.7851, -84.3738, 33.7851, -84.3738)).toBe(0);
  });

  it("U-02 measures Georgia Tech to Piedmont Park at about 2.3 km", () => {
    const meters = distanceBetweenMeters(33.7756, -84.3963, 33.7851, -84.3738);
    expect(meters).toBeGreaterThan(2_300);
    expect(meters).toBeLessThan(2_400);
  });
});

describe("formatDistance", () => {
  it("U-03 uses feet under 0.1 mi", () => {
    expect(formatDistance(30)).toBe("98 ft");
  });

  it("U-04 never shows 0 ft", () => {
    expect(formatDistance(0)).toBe("1 ft");
  });

  it("U-05 uses miles with one decimal at 0.1 mi and above", () => {
    expect(formatDistance(1609.344)).toBe("1.0 mi");
    expect(formatDistance(4023.36)).toBe("2.5 mi");
  });
});

describe("formatActivity", () => {
  it("U-06 shows no reports and plural games", () => {
    expect(formatActivity(null, 0)).toBe("No reports · 0 open games");
  });

  it("U-07 shows reported count and singular game", () => {
    expect(formatActivity(2, 1)).toBe("2 reported · 1 open game");
  });
});

describe("formatMinutesAgo", () => {
  const now = Date.UTC(2026, 9, 24, 15, 0);

  it("U-08 says just now under a minute", () => {
    expect(formatMinutesAgo(new Date(now - 20_000), now)).toBe(
      "Updated just now",
    );
  });

  it("U-09 rounds to whole minutes", () => {
    expect(formatMinutesAgo(new Date(now - 7 * 60_000), now)).toBe(
      "Updated 7 min ago",
    );
  });

  it("U-10 never goes negative for future dates", () => {
    expect(formatMinutesAgo(new Date(now + 60_000), now)).toBe(
      "Updated just now",
    );
  });
});
