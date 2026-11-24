import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const addDoc = vi.fn().mockResolvedValue({ id: "err-1" });
const collection = vi.fn().mockReturnValue({});

vi.mock("firebase/firestore", () => ({
  addDoc: (...args: unknown[]) => addDoc(...args),
  collection: (...args: unknown[]) => collection(...args),
  Timestamp: {
    now: () => ({ __type: "timestamp" }),
  },
}));

let currentUser: { uid: string } | null = null;

vi.mock("./firebase", () => ({
  db: { __db: true },
  auth: {
    authStateReady: () => Promise.resolve(),
    get currentUser() {
      return currentUser;
    },
  },
}));

function setupBrowser(ua = "Mozilla/5.0 (iPhone) Safari", pathname = "/courts") {
  vi.stubGlobal("navigator", { userAgent: ua });
  vi.stubGlobal("location", { pathname });
}

async function loadService() {
  vi.resetModules();
  return (await import("./ErrorService")).ErrorService;
}

function lastWrite() {
  return addDoc.mock.calls.at(-1)?.[1] as Record<string, unknown>;
}

beforeEach(() => {
  vi.clearAllMocks();
  currentUser = { uid: "alice" };
  setupBrowser();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ErrorService.logListener", () => {
  it("U-259 logs a listener_failed entry once per session per listener", async () => {
    const service = await loadService();
    await service.logListener("courtStatus", new Error("snapshot blew up"));
    await service.logListener("courtStatus", new Error("snapshot blew up again"));
    expect(addDoc).toHaveBeenCalledTimes(1);
    const entry = lastWrite();
    expect(entry.type).toBe("listener_failed");
    expect(entry.code).toBe("courtStatus");
    expect(entry.message).toBe("snapshot blew up");
  });

  it("U-260 logs each distinct listener separately", async () => {
    const service = await loadService();
    await service.logListener("courtStatus", new Error("a"));
    await service.logListener("chat", new Error("b"));
    expect(addDoc).toHaveBeenCalledTimes(2);
  });
});

describe("ErrorService field shape", () => {
  it("U-261 writes exactly the allowed fields", async () => {
    const service = await loadService();
    await service.logUnexpected(new Error("kaboom"));
    const entry = lastWrite();
    expect(Object.keys(entry).sort()).toEqual(
      [
        "appVersion",
        "browser",
        "code",
        "createdAt",
        "device",
        "message",
        "screen",
        "type",
        "uid",
      ].sort(),
    );
    expect(collection).toHaveBeenCalledWith(expect.anything(), "clientErrors");
  });

  it("U-268 derives device and browser from an iPhone Safari user agent", async () => {
    setupBrowser(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1",
    );
    const service = await loadService();
    await service.logUnexpected(new Error("kaboom"));
    const entry = lastWrite();
    expect(entry.device).toBe("iPhone");
    expect(entry.browser).toBe("Safari");
  });

  it("U-269 derives device and browser from an Android Chrome user agent", async () => {
    setupBrowser(
      "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
    );
    const service = await loadService();
    await service.logUnexpected(new Error("kaboom"));
    const entry = lastWrite();
    expect(entry.device).toBe("Android");
    expect(entry.browser).toBe("Chrome");
  });

  it("U-270 records the build app version and a timestamp", async () => {
    const service = await loadService();
    await service.logUnexpected(new Error("kaboom"));
    const entry = lastWrite();
    expect(entry.appVersion).toBe(__APP_VERSION__);
    expect(entry.appVersion).not.toBe("");
    expect(entry.createdAt).toEqual({ __type: "timestamp" });
  });

  it("U-262 captures the signed-in uid", async () => {
    const service = await loadService();
    await service.logUnexpected(new Error("kaboom"));
    expect(lastWrite().uid).toBe("alice");
  });

  it("U-263 writes a null uid when signed out", async () => {
    currentUser = null;
    const service = await loadService();
    await service.logSignInFailed({ code: "auth/wrong-password" });
    const entry = lastWrite();
    expect(entry.uid).toBeNull();
    expect(entry.type).toBe("sign_in_failed");
    expect(entry.code).toBe("auth/wrong-password");
  });

  it("U-264 records the current screen path", async () => {
    setupBrowser("Mozilla/5.0 (iPhone) Safari", "/game/abc");
    const service = await loadService();
    await service.logUnexpected(new Error("kaboom"));
    expect(lastWrite().screen).toBe("/game/abc");
  });
});

describe("ErrorService message handling", () => {
  it("U-265 truncates a very long message", async () => {
    const service = await loadService();
    await service.logUnexpected(new Error("y".repeat(5000)));
    const message = lastWrite().message as string;
    expect(message.length).toBeLessThanOrEqual(1000);
  });

  it("U-266 never logs location, chat or settings values passed as extra data", async () => {
    const service = await loadService();
    await service.logUnexpected(new Error("kaboom"));
    const entry = lastWrite();
    expect(entry).not.toHaveProperty("latitude");
    expect(entry).not.toHaveProperty("longitude");
    expect(entry).not.toHaveProperty("chatText");
  });
});

describe("ErrorService failure handling", () => {
  it("U-267 swallows a write failure so the screen is not broken", async () => {
    addDoc.mockRejectedValueOnce(new Error("permission denied"));
    const service = await loadService();
    await expect(service.logUnexpected(new Error("kaboom"))).resolves.toBeUndefined();
  });
});
