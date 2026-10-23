import { describe, expect, it } from "vitest";
import { buildStart, formatStart } from "./time";

describe("buildStart", () => {
  const now = new Date(2026, 9, 24, 15, 30);

  it("U-20 builds today at the chosen time", () => {
    const start = buildStart("today", "18:45", now);
    expect(start?.getDate()).toBe(24);
    expect(start?.getHours()).toBe(18);
    expect(start?.getMinutes()).toBe(45);
    expect(start?.getSeconds()).toBe(0);
  });

  it("U-21 builds tomorrow at the chosen time", () => {
    const start = buildStart("tomorrow", "07:00", now);
    expect(start?.getDate()).toBe(25);
    expect(start?.getHours()).toBe(7);
  });

  it("U-22 rolls over the end of the month", () => {
    const start = buildStart("tomorrow", "09:00", new Date(2026, 9, 31, 20, 0));
    expect(start?.getMonth()).toBe(10);
    expect(start?.getDate()).toBe(1);
  });

  it("U-23 returns null without a time", () => {
    expect(buildStart("today", "", now)).toBeNull();
    expect(buildStart("today", "abc", now)).toBeNull();
  });
});

describe("formatStart", () => {
  const now = new Date(2026, 9, 24, 15, 30).getTime();

  it("U-24 labels today", () => {
    expect(formatStart(new Date(2026, 9, 24, 18, 0), now)).toMatch(/^Today /);
  });

  it("U-25 labels tomorrow", () => {
    expect(formatStart(new Date(2026, 9, 25, 8, 0), now)).toMatch(/^Tomorrow /);
  });

  it("U-26 uses the date for later days", () => {
    expect(formatStart(new Date(2026, 9, 27, 8, 0), now)).not.toMatch(
      /^(Today|Tomorrow) /,
    );
  });
});
