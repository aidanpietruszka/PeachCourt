import { describe, expect, it, vi } from "vitest";
import { health } from "./index";

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
