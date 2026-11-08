import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.stubEnv("VITE_FIREBASE_VAPID_KEY", "vapid-key");

const getToken = vi.fn();
const deleteToken = vi.fn().mockResolvedValue(true);
const isSupported = vi.fn().mockResolvedValue(true);
const getMessaging = vi.fn().mockReturnValue({});

vi.mock("firebase/messaging", () => ({
  getToken: (...args: unknown[]) => getToken(...args),
  deleteToken: (...args: unknown[]) => deleteToken(...args),
  isSupported: (...args: unknown[]) => isSupported(...args),
  getMessaging: (...args: unknown[]) => getMessaging(...args),
}));

vi.mock("./firebase", () => ({
  app: {
    options: {
      apiKey: "k",
      authDomain: "d",
      projectId: "p",
      messagingSenderId: "s",
      appId: "a",
    },
  },
}));

const saveFcmToken = vi.fn().mockResolvedValue(undefined);
const removeFcmToken = vi.fn().mockResolvedValue(undefined);

vi.mock("./UserService", () => ({
  UserService: {
    saveFcmToken: (...args: unknown[]) => saveFcmToken(...args),
    removeFcmToken: (...args: unknown[]) => removeFcmToken(...args),
  },
}));

type BrowserOptions = {
  permission?: "default" | "granted" | "denied";
  standalone?: boolean;
  ua?: string;
  hasServiceWorker?: boolean;
};

function setupBrowser(opts: BrowserOptions = {}) {
  const register = vi.fn().mockResolvedValue({ scope: "/" });
  const notification = { permission: opts.permission ?? "granted" };
  vi.stubGlobal("Notification", notification);
  vi.stubGlobal("window", {
    Notification: notification,
    matchMedia: () => ({ matches: !!opts.standalone }),
  });
  vi.stubGlobal("navigator", {
    ...(opts.hasServiceWorker === false ? {} : { serviceWorker: { register } }),
    userAgent: opts.ua ?? "Mozilla/5.0",
    standalone: opts.standalone,
  });
  return { register };
}

async function loadService() {
  return (await import("./messaging")).MessagingService;
}

beforeEach(() => {
  vi.clearAllMocks();
  isSupported.mockResolvedValue(true);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("MessagingService.enable", () => {
  it("U-250 saves the token when notifications are available", async () => {
    setupBrowser({ permission: "granted" });
    getToken.mockResolvedValue("tok-1");
    const service = await loadService();
    const result = await service.enable("alice");
    expect(result).toBe("tok-1");
    expect(saveFcmToken).toHaveBeenCalledWith("alice", "tok-1");
  });

  it("U-251 does nothing when permission is denied", async () => {
    setupBrowser({ permission: "denied" });
    const service = await loadService();
    const result = await service.enable("alice");
    expect(result).toBeNull();
    expect(getToken).not.toHaveBeenCalled();
    expect(saveFcmToken).not.toHaveBeenCalled();
  });

  it("U-252 does nothing on iOS Safari that is not on the Home Screen", async () => {
    setupBrowser({ permission: "granted", ua: "iPhone Safari", standalone: false });
    const service = await loadService();
    const result = await service.enable("alice");
    expect(result).toBeNull();
    expect(getToken).not.toHaveBeenCalled();
    expect(saveFcmToken).not.toHaveBeenCalled();
  });

  it("U-253 enables an iPhone added to the Home Screen", async () => {
    setupBrowser({ permission: "granted", ua: "iPhone Safari", standalone: true });
    getToken.mockResolvedValue("tok-ios");
    const service = await loadService();
    const result = await service.enable("alice");
    expect(result).toBe("tok-ios");
    expect(saveFcmToken).toHaveBeenCalledWith("alice", "tok-ios");
  });

  it("U-254 saves nothing when no token is issued", async () => {
    setupBrowser({ permission: "granted" });
    getToken.mockResolvedValue("");
    const service = await loadService();
    const result = await service.enable("alice");
    expect(result).toBeNull();
    expect(saveFcmToken).not.toHaveBeenCalled();
  });

  it("U-255 does nothing when messaging is unsupported", async () => {
    setupBrowser({ permission: "granted" });
    isSupported.mockResolvedValue(false);
    const service = await loadService();
    const result = await service.enable("alice");
    expect(result).toBeNull();
    expect(getToken).not.toHaveBeenCalled();
  });
});

describe("MessagingService.disable", () => {
  it("U-256 removes the token and deletes it from messaging", async () => {
    setupBrowser({ permission: "granted" });
    getToken.mockResolvedValue("tok-1");
    const service = await loadService();
    await service.disable("alice");
    expect(removeFcmToken).toHaveBeenCalledWith("alice", "tok-1");
    expect(deleteToken).toHaveBeenCalled();
  });

  it("U-257 does nothing when there is no token to remove", async () => {
    setupBrowser({ permission: "granted" });
    getToken.mockResolvedValue("");
    const service = await loadService();
    await service.disable("alice");
    expect(removeFcmToken).not.toHaveBeenCalled();
    expect(deleteToken).not.toHaveBeenCalled();
  });

  it("U-258 swallows token lookup failures", async () => {
    setupBrowser({ permission: "granted" });
    getToken.mockRejectedValue(new Error("no permission"));
    const service = await loadService();
    await expect(service.disable("alice")).resolves.toBeUndefined();
    expect(removeFcmToken).not.toHaveBeenCalled();
  });
});
