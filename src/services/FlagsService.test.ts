import { describe, expect, it } from "vitest";
import { DEFAULT_FLAGS, parseFlags } from "./FlagsService";

describe("parseFlags", () => {
  it("U-218 all flags default to true when document is undefined", () => {
    const flags = parseFlags(undefined);
    expect(flags.autoCheckin).toBe(true);
    expect(flags.stillHere).toBe(true);
    expect(flags.pushAlerts).toBe(true);
    expect(flags.gameReminders).toBe(true);
    expect(flags.gameChat).toBe(true);
    expect(flags.teamTools).toBe(true);
  });

  it("U-219 all flags default to true when document is empty", () => {
    const flags = parseFlags({});
    expect(flags.autoCheckin).toBe(true);
    expect(flags.stillHere).toBe(true);
    expect(flags.pushAlerts).toBe(true);
    expect(flags.gameReminders).toBe(true);
    expect(flags.gameChat).toBe(true);
    expect(flags.teamTools).toBe(true);
  });

  it("U-220 false values disable individual flags", () => {
    const flags = parseFlags({ autoCheckin: false, gameChat: false });
    expect(flags.autoCheckin).toBe(false);
    expect(flags.gameChat).toBe(false);
    expect(flags.stillHere).toBe(true);
    expect(flags.pushAlerts).toBe(true);
    expect(flags.gameReminders).toBe(true);
    expect(flags.teamTools).toBe(true);
  });

  it("U-221 explicit true preserves enabled state", () => {
    const flags = parseFlags({
      autoCheckin: true,
      stillHere: true,
      pushAlerts: true,
      gameReminders: true,
      gameChat: true,
      teamTools: true,
    });
    expect(flags.autoCheckin).toBe(true);
    expect(flags.gameChat).toBe(true);
  });

  it("U-222 non-false values (null, 0, string) are treated as true", () => {
    const flags = parseFlags({ autoCheckin: null, stillHere: 0, gameChat: "off" });
    expect(flags.autoCheckin).toBe(true);
    expect(flags.stillHere).toBe(true);
    expect(flags.gameChat).toBe(true);
  });

  it("U-223 DEFAULT_FLAGS has all flags enabled", () => {
    expect(DEFAULT_FLAGS.autoCheckin).toBe(true);
    expect(DEFAULT_FLAGS.stillHere).toBe(true);
    expect(DEFAULT_FLAGS.pushAlerts).toBe(true);
    expect(DEFAULT_FLAGS.gameReminders).toBe(true);
    expect(DEFAULT_FLAGS.gameChat).toBe(true);
    expect(DEFAULT_FLAGS.teamTools).toBe(true);
  });
});
