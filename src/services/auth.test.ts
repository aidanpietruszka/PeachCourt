import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { completeRedirectSignIn, signInWithGoogle } from "./auth";

const signInWithPopup = vi.fn().mockResolvedValue({ user: { uid: "u1" } });
const signInWithRedirect = vi.fn().mockResolvedValue(undefined);
const getRedirectResult = vi.fn().mockResolvedValue(null);

vi.mock("firebase/auth", () => ({
  GoogleAuthProvider: class {},
  createUserWithEmailAndPassword: vi.fn(),
  signInWithEmailAndPassword: vi.fn(),
  signInWithPopup: (...args: unknown[]) => signInWithPopup(...args),
  signInWithRedirect: (...args: unknown[]) => signInWithRedirect(...args),
  getRedirectResult: (...args: unknown[]) => getRedirectResult(...args),
  signOut: vi.fn(),
  updateProfile: vi.fn(),
}));

vi.mock("./firebase", () => ({
  auth: { __auth: true },
}));

const logSignInFailed = vi.fn().mockResolvedValue(undefined);

vi.mock("./ErrorService", () => ({
  ErrorService: {
    logSignInFailed: (...args: unknown[]) => logSignInFailed(...args),
  },
}));

function setEnv(options: { navigatorStandalone?: boolean; displayMode?: boolean }) {
  vi.stubGlobal("navigator", {
    standalone: options.navigatorStandalone ?? false,
  });
  vi.stubGlobal("window", {
    matchMedia: (query: string) => ({
      matches: query.includes("display-mode: standalone")
        ? Boolean(options.displayMode)
        : false,
    }),
  });
}

beforeEach(() => {
  signInWithPopup.mockClear();
  signInWithRedirect.mockClear();
  getRedirectResult.mockClear();
  getRedirectResult.mockResolvedValue(null);
  logSignInFailed.mockClear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("signInWithGoogle sign-in mode", () => {
  it("U-288 uses a popup in a normal browser tab", async () => {
    setEnv({ navigatorStandalone: false, displayMode: false });
    await signInWithGoogle();
    expect(signInWithPopup).toHaveBeenCalledTimes(1);
    expect(signInWithRedirect).not.toHaveBeenCalled();
  });

  it("U-289 uses a redirect when navigator.standalone is true", async () => {
    setEnv({ navigatorStandalone: true, displayMode: false });
    await signInWithGoogle();
    expect(signInWithRedirect).toHaveBeenCalledTimes(1);
    expect(signInWithPopup).not.toHaveBeenCalled();
  });

  it("U-290 uses a redirect when display-mode is standalone", async () => {
    setEnv({ navigatorStandalone: false, displayMode: true });
    await signInWithGoogle();
    expect(signInWithRedirect).toHaveBeenCalledTimes(1);
    expect(signInWithPopup).not.toHaveBeenCalled();
  });
});

describe("completeRedirectSignIn", () => {
  beforeEach(() => {
    setEnv({ navigatorStandalone: true });
  });

  it("U-291 logs one sign_in_failed and returns an error message when the redirect rejects", async () => {
    getRedirectResult.mockRejectedValueOnce({ code: "auth/network-request-failed" });
    const result = await completeRedirectSignIn();
    expect(logSignInFailed).toHaveBeenCalledTimes(1);
    expect(result.signedIn).toBe(false);
    expect(result.error).toBe("Network error. Check your connection and try again.");
  });

  it("U-292 returns no error and does not sign in when there is no pending redirect", async () => {
    getRedirectResult.mockResolvedValueOnce(null);
    const result = await completeRedirectSignIn();
    expect(logSignInFailed).not.toHaveBeenCalled();
    expect(result).toEqual({ signedIn: false, error: "" });
  });

  it("U-293 reports a signed-in result and logs nothing on a successful redirect", async () => {
    getRedirectResult.mockResolvedValueOnce({ user: { uid: "u1" } });
    const result = await completeRedirectSignIn();
    expect(logSignInFailed).not.toHaveBeenCalled();
    expect(result).toEqual({ signedIn: true, error: "" });
  });
});
