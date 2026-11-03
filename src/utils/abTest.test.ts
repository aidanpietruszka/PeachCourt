import { describe, expect, it } from "vitest";
import {
  CHECKIN_VARIANTS,
  isCheckinVariant,
  pickCheckinVariant,
  variantDefaultsToOn,
} from "./abTest";

describe("check-in A/B test", () => {
  it("U-200 the two variants are auto_on and auto_off", () => {
    expect(CHECKIN_VARIANTS).toEqual(["auto_on", "auto_off"]);
  });

  it("U-201 isCheckinVariant accepts only the two variants", () => {
    expect(isCheckinVariant("auto_on")).toBe(true);
    expect(isCheckinVariant("auto_off")).toBe(true);
    expect(isCheckinVariant("auto")).toBe(false);
    expect(isCheckinVariant(undefined)).toBe(false);
    expect(isCheckinVariant(true)).toBe(false);
  });

  it("U-202 pickCheckinVariant splits at 0.5", () => {
    expect(pickCheckinVariant(() => 0)).toBe("auto_on");
    expect(pickCheckinVariant(() => 0.499)).toBe("auto_on");
    expect(pickCheckinVariant(() => 0.5)).toBe("auto_off");
    expect(pickCheckinVariant(() => 0.999)).toBe("auto_off");
  });

  it("U-203 pickCheckinVariant gives roughly 50/50 over many players", () => {
    let seed = 12345;
    const random = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };
    let on = 0;
    const total = 10_000;
    for (let i = 0; i < total; i++) {
      if (pickCheckinVariant(random) === "auto_on") {
        on += 1;
      }
    }
    expect(on / total).toBeGreaterThan(0.47);
    expect(on / total).toBeLessThan(0.53);
  });

  it("U-204 only auto_on defaults the toggle to on", () => {
    expect(variantDefaultsToOn("auto_on")).toBe(true);
    expect(variantDefaultsToOn("auto_off")).toBe(false);
    expect(variantDefaultsToOn(undefined)).toBe(false);
  });
});
