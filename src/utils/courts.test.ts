import { describe, expect, it } from "vitest";
import {
  courtCountLabel,
  courtSports,
  formatCount,
  formatHours,
  formatSurfaces,
  formatText,
  formatTime,
  formatYesNo,
} from "./courts";

describe("courtSports", () => {
  it("U-47 tennis courts only gives tennis", () => {
    expect(
      courtSports({
        tennisCourts: 4,
        pickleballCourts: 0,
        pickleballLines: false,
      }),
    ).toEqual(["tennis"]);
  });

  it("U-48 pickleball courts only gives pickleball", () => {
    expect(
      courtSports({
        tennisCourts: 0,
        pickleballCourts: 6,
        pickleballLines: false,
      }),
    ).toEqual(["pickleball"]);
  });

  it("U-49 tennis and pickleball courts give both, tennis first", () => {
    expect(
      courtSports({
        tennisCourts: 25,
        pickleballCourts: 11,
        pickleballLines: null,
      }),
    ).toEqual(["tennis", "pickleball"]);
  });

  it("U-50 pickleball lines alone add pickleball", () => {
    expect(
      courtSports({
        tennisCourts: 3,
        pickleballCourts: 0,
        pickleballLines: true,
      }),
    ).toEqual(["tennis", "pickleball"]);
  });

  it("U-51 lines with null pickleball courts still add pickleball", () => {
    expect(
      courtSports({
        tennisCourts: 2,
        pickleballCourts: null,
        pickleballLines: true,
      }),
    ).toEqual(["tennis", "pickleball"]);
  });

  it("U-52 false or null lines add nothing", () => {
    expect(
      courtSports({
        tennisCourts: 2,
        pickleballCourts: 0,
        pickleballLines: false,
      }),
    ).toEqual(["tennis"]);
    expect(
      courtSports({
        tennisCourts: 2,
        pickleballCourts: null,
        pickleballLines: null,
      }),
    ).toEqual(["tennis"]);
  });

  it("U-53 null or zero counts with no lines give no sports", () => {
    expect(
      courtSports({
        tennisCourts: null,
        pickleballCourts: null,
        pickleballLines: null,
      }),
    ).toEqual([]);
    expect(
      courtSports({
        tennisCourts: 0,
        pickleballCourts: 0,
        pickleballLines: false,
      }),
    ).toEqual([]);
  });

  it("U-54 negative and missing values are handled", () => {
    expect(
      courtSports({
        tennisCourts: -1,
        pickleballCourts: -3,
        pickleballLines: false,
      }),
    ).toEqual([]);
    expect(courtSports({} as Parameters<typeof courtSports>[0])).toEqual([]);
  });
});

describe("formatCount", () => {
  it("U-55 shows a positive number", () => {
    expect(formatCount(25)).toBe("25");
    expect(formatCount(1)).toBe("1");
  });

  it("U-56 shows None for zero", () => {
    expect(formatCount(0)).toBe("None");
  });

  it("U-57 shows Unknown for null, undefined, NaN, infinity and negatives", () => {
    expect(formatCount(null)).toBe("Unknown");
    expect(formatCount(undefined)).toBe("Unknown");
    expect(formatCount(Number.NaN)).toBe("Unknown");
    expect(formatCount(Number.POSITIVE_INFINITY)).toBe("Unknown");
    expect(formatCount(-2)).toBe("Unknown");
  });
});

describe("formatText and formatYesNo", () => {
  it("U-58 text passes through", () => {
    expect(formatText("Members only")).toBe("Members only");
  });

  it("U-59 null, undefined, empty and blank text is Unknown", () => {
    expect(formatText(null)).toBe("Unknown");
    expect(formatText(undefined)).toBe("Unknown");
    expect(formatText("")).toBe("Unknown");
    expect(formatText("   ")).toBe("Unknown");
  });

  it("U-60 booleans become Yes and No, anything else is Unknown", () => {
    expect(formatYesNo(true)).toBe("Yes");
    expect(formatYesNo(false)).toBe("No");
    expect(formatYesNo(null)).toBe("Unknown");
    expect(formatYesNo(undefined)).toBe("Unknown");
  });
});

describe("formatSurfaces", () => {
  it("U-61 joins surfaces with a comma", () => {
    expect(formatSurfaces(["Clay", "Hard"])).toBe("Clay, Hard");
    expect(formatSurfaces(["Hard"])).toBe("Hard");
  });

  it("U-62 null, undefined and empty lists are Unknown", () => {
    expect(formatSurfaces(null)).toBe("Unknown");
    expect(formatSurfaces(undefined)).toBe("Unknown");
    expect(formatSurfaces([])).toBe("Unknown");
  });

  it("U-63 blank names are dropped", () => {
    expect(formatSurfaces(["", "  ", "Hard"])).toBe("Hard");
    expect(formatSurfaces(["", " "])).toBe("Unknown");
  });
});

describe("formatTime", () => {
  it("U-64 converts whole hours to 12-hour time", () => {
    expect(formatTime("05:00")).toBe("5 AM");
    expect(formatTime("17:00")).toBe("5 PM");
    expect(formatTime("22:00")).toBe("10 PM");
  });

  it("U-65 handles midnight and noon", () => {
    expect(formatTime("00:00")).toBe("12 AM");
    expect(formatTime("12:00")).toBe("12 PM");
    expect(formatTime("12:30")).toBe("12:30 PM");
    expect(formatTime("00:15")).toBe("12:15 AM");
    expect(formatTime("23:59")).toBe("11:59 PM");
  });

  it("U-66 keeps minutes when they are not zero", () => {
    expect(formatTime("09:30")).toBe("9:30 AM");
    expect(formatTime("17:15")).toBe("5:15 PM");
  });

  it("U-67 rejects malformed times", () => {
    expect(formatTime("")).toBeNull();
    expect(formatTime("9:00")).toBeNull();
    expect(formatTime("24:00")).toBeNull();
    expect(formatTime("12:60")).toBeNull();
    expect(formatTime("noon")).toBeNull();
    expect(formatTime("17:00:00")).toBeNull();
  });
});

describe("formatHours", () => {
  it("U-68 formats one day group", () => {
    expect(
      formatHours([{ days: "Daily", open: "06:00", close: "22:00" }]),
    ).toEqual(["Daily 6 AM–10 PM"]);
  });

  it("U-69 keeps each day group on its own line, in order", () => {
    expect(
      formatHours([
        { days: "Mon–Fri", open: "09:00", close: "21:00" },
        { days: "Sat–Sun", open: "09:00", close: "18:00" },
      ]),
    ).toEqual(["Mon–Fri 9 AM–9 PM", "Sat–Sun 9 AM–6 PM"]);
  });

  it("U-70 null, undefined and empty lists give no lines", () => {
    expect(formatHours(null)).toEqual([]);
    expect(formatHours(undefined)).toEqual([]);
    expect(formatHours([])).toEqual([]);
  });

  it("U-71 skips malformed entries and keeps valid ones", () => {
    expect(
      formatHours([
        { days: "", open: "09:00", close: "17:00" },
        { days: "Mon", open: "9am", close: "17:00" },
        { days: "Tue", open: "09:00", close: "later" },
        { days: "Wed", open: "09:00", close: "17:00" },
      ]),
    ).toEqual(["Wed 9 AM–5 PM"]);
  });

  it("U-72 all malformed entries give no lines", () => {
    expect(
      formatHours([
        { days: "Mon", open: "", close: "" },
        {} as { days: string; open: string; close: string },
      ]),
    ).toEqual([]);
  });

  it("U-73 non-array values give no lines", () => {
    expect(
      formatHours("Mon 9-5" as unknown as Parameters<typeof formatHours>[0]),
    ).toEqual([]);
  });
});

describe("courtCountLabel", () => {
  it("U-74 tennis label is plural, singular for one", () => {
    expect(
      courtCountLabel(
        { tennisCourts: 4, pickleballCourts: 0, pickleballLines: false },
        "tennis",
      ),
    ).toBe("4 tennis courts");
    expect(
      courtCountLabel(
        { tennisCourts: 1, pickleballCourts: 0, pickleballLines: false },
        "tennis",
      ),
    ).toBe("1 tennis court");
  });

  it("U-75 pickleball label is plural, singular for one", () => {
    expect(
      courtCountLabel(
        { tennisCourts: 0, pickleballCourts: 6, pickleballLines: false },
        "pickleball",
      ),
    ).toBe("6 pickleball courts");
    expect(
      courtCountLabel(
        { tennisCourts: 0, pickleballCourts: 1, pickleballLines: false },
        "pickleball",
      ),
    ).toBe("1 pickleball court");
  });

  it("U-76 lines on tennis courts when there are no pickleball courts", () => {
    expect(
      courtCountLabel(
        { tennisCourts: 3, pickleballCourts: 0, pickleballLines: true },
        "pickleball",
      ),
    ).toBe("Pickleball lines on tennis courts");
    expect(
      courtCountLabel(
        { tennisCourts: 3, pickleballCourts: null, pickleballLines: true },
        "pickleball",
      ),
    ).toBe("Pickleball lines on tennis courts");
  });

  it("U-77 dedicated pickleball courts win over lines", () => {
    expect(
      courtCountLabel(
        { tennisCourts: 3, pickleballCourts: 2, pickleballLines: true },
        "pickleball",
      ),
    ).toBe("2 pickleball courts");
  });

  it("U-78 falls back to Courts unknown", () => {
    expect(
      courtCountLabel(
        { tennisCourts: null, pickleballCourts: null, pickleballLines: null },
        "tennis",
      ),
    ).toBe("Courts unknown");
    expect(
      courtCountLabel(
        { tennisCourts: 2, pickleballCourts: null, pickleballLines: null },
        "pickleball",
      ),
    ).toBe("Courts unknown");
  });
});
