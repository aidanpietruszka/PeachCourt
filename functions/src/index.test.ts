import { describe, expect, it, vi, afterEach } from "vitest";
import {
  health,
  handleBudgetAlert,
  parseBudgetMessage,
  shouldCutoff,
} from "./index";

function mockResponse() {
  const response = {
    statusCode: 200,
    body: undefined as unknown,
    status: vi.fn(),
    json: vi.fn(),
    set: vi.fn(),
    setHeader: vi.fn(),
    end: vi.fn(),
    send: vi.fn(),
  };
  response.status.mockImplementation((code: number) => {
    response.statusCode = code;
    return response;
  });
  response.json.mockImplementation((body: unknown) => {
    response.body = body;
    return response;
  });
  response.set.mockReturnValue(response);
  response.send.mockReturnValue(response);
  return response;
}

function mockRequest(method: string) {
  return { method, headers: {}, url: "/", get: vi.fn() };
}

function encode(obj: unknown): string {
  return Buffer.from(JSON.stringify(obj)).toString("base64");
}

function budgetEvent(data: string) {
  return {
    data: { message: { data, messageId: "1", publishTime: "" } },
  } as never;
}

function mockFetch(responses: { ok: boolean; json?: unknown }[]) {
  let call = 0;
  return vi.fn().mockImplementation(() => {
    const r = responses[call++] ?? { ok: true, json: {} };
    return Promise.resolve({
      ok: r.ok,
      status: r.ok ? 200 : 500,
      statusText: r.ok ? "OK" : "Internal Server Error",
      json: () => Promise.resolve(r.json ?? {}),
    });
  });
}

describe("parseBudgetMessage", () => {
  it("F-04a returns null for empty string", () => {
    expect(parseBudgetMessage("")).toBeNull();
  });

  it("F-04b returns null when costAmount is missing", () => {
    expect(parseBudgetMessage(encode({ budgetAmount: 5 }))).toBeNull();
  });

  it("F-04c returns the parsed amounts for a valid message", () => {
    expect(
      parseBudgetMessage(encode({ costAmount: 3, budgetAmount: 5 })),
    ).toEqual({ costAmount: 3, budgetAmount: 5 });
  });
});

describe("shouldCutoff", () => {
  it("F-04d returns false when cost is below budget", () => {
    expect(shouldCutoff({ costAmount: 4.99, budgetAmount: 5 })).toBe(false);
  });

  it("F-04e returns true when cost equals budget", () => {
    expect(shouldCutoff({ costAmount: 5, budgetAmount: 5 })).toBe(true);
  });

  it("F-04f returns true when cost exceeds budget", () => {
    expect(shouldCutoff({ costAmount: 5.01, budgetAmount: 5 })).toBe(true);
  });
});

describe("billingCutoff handler", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("F-04 does not call billing API when cost is below budget", async () => {
    const fetch = mockFetch([]);
    vi.stubGlobal("fetch", fetch);
    await handleBudgetAlert(
      budgetEvent(encode({ costAmount: 3, budgetAmount: 5 })),
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  it("F-05 detaches billing when cost equals budget", async () => {
    const fetch = mockFetch([
      { ok: true, json: { access_token: "tok" } },
      { ok: true },
    ]);
    vi.stubGlobal("fetch", fetch);
    await handleBudgetAlert(
      budgetEvent(encode({ costAmount: 5, budgetAmount: 5 })),
    );
    expect(fetch).toHaveBeenCalledTimes(2);
    const [url, init] = fetch.mock.calls[1] as [string, RequestInit];
    expect(url).toContain("billingInfo");
    expect(JSON.parse(init.body as string)).toEqual({ billingAccountName: "" });
  });

  it("F-06 detaches billing when cost exceeds budget", async () => {
    const fetch = mockFetch([
      { ok: true, json: { access_token: "tok" } },
      { ok: true },
    ]);
    vi.stubGlobal("fetch", fetch);
    await handleBudgetAlert(
      budgetEvent(encode({ costAmount: 6, budgetAmount: 5 })),
    );
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("F-07 does not throw on malformed message data", async () => {
    const fetch = mockFetch([]);
    vi.stubGlobal("fetch", fetch);
    await expect(
      handleBudgetAlert(budgetEvent("not-valid-base64-json!!")),
    ).resolves.toBeUndefined();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("F-08 succeeds when billing is already detached (idempotent)", async () => {
    const fetch = mockFetch([
      { ok: true, json: { access_token: "tok" } },
      { ok: true },
    ]);
    vi.stubGlobal("fetch", fetch);
    await handleBudgetAlert(
      budgetEvent(encode({ costAmount: 5, budgetAmount: 5 })),
    );
    const fetch2 = mockFetch([
      { ok: true, json: { access_token: "tok2" } },
      { ok: true },
    ]);
    vi.stubGlobal("fetch", fetch2);
    await handleBudgetAlert(
      budgetEvent(encode({ costAmount: 5, budgetAmount: 5 })),
    );
    expect(fetch2).toHaveBeenCalledTimes(2);
  });
});

describe("health", () => {
  it("F-01 returns status ok", async () => {
    const response = mockResponse();
    await health(mockRequest("GET") as never, response as never);
    expect(response.json).toHaveBeenCalledTimes(1);
    expect(response.body).toEqual({ status: "ok" });
    expect(response.statusCode).toBe(200);
  });

  it("F-02 does not depend on the request method", async () => {
    for (const method of ["GET", "POST", "HEAD"]) {
      const response = mockResponse();
      await health(mockRequest(method) as never, response as never);
      expect(response.body).toEqual({ status: "ok" });
    }
  });

  it("F-03 is deployed to us-east1 and is public", () => {
    expect(health.__endpoint.region).toEqual(["us-east1"]);
    expect(health.__endpoint.httpsTrigger?.invoker).toEqual(["public"]);
  });
});
