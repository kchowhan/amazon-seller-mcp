// src/client.test.ts
import { describe, it, expect, vi } from "vitest";
import { SpApiClient, buildUrl } from "./client";
import type { LwaTokenClient } from "./auth/lwaTokenClient";

const endpoints = {
  spApiBaseUrl: "https://sandbox.sellingpartnerapi-na.amazon.com",
  lwaTokenUrl: "https://api.amazon.com/auth/o2/token",
};

function fakeTokenClient(token = "AT1"): LwaTokenClient {
  return { getAccessToken: vi.fn().mockResolvedValue(token) } as unknown as LwaTokenClient;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("buildUrl", () => {
  it("appends query parameters, joining arrays with commas and dropping undefined", () => {
    const url = buildUrl("https://h.example.com", "/a/b", {
      marketplaceIds: ["M1", "M2"],
      n: 5,
      skip: undefined,
    });
    expect(url).toBe("https://h.example.com/a/b?marketplaceIds=M1%2CM2&n=5");
  });
});

describe("SpApiClient.request", () => {
  it("sends the access token in x-amz-access-token and returns parsed JSON", async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse({ payload: { ok: true } }));
    const client = new SpApiClient(endpoints, fakeTokenClient("TOKEN123"), fetchFn);

    const result = await client.request<{ payload: { ok: boolean } }>({
      operation: "ping",
      method: "GET",
      path: "/sellers/v1/marketplaceParticipations",
    });

    expect(result.payload.ok).toBe(true);
    const [url, init] = fetchFn.mock.calls[0]!;
    expect(url).toBe(`${endpoints.spApiBaseUrl}/sellers/v1/marketplaceParticipations`);
    expect((init.headers as Record<string, string>)["x-amz-access-token"]).toBe("TOKEN123");
  });

  it("throws SpApiError on a 4xx response", async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response("Forbidden", { status: 403 }));
    const client = new SpApiClient(endpoints, fakeTokenClient(), fetchFn);
    await expect(
      client.request({ operation: "ping", method: "GET", path: "/x" }),
    ).rejects.toThrow(/SP-API ping failed/);
  });

  it("retries once on 429 then succeeds", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(new Response("throttled", { status: 429 }))
      .mockResolvedValueOnce(jsonResponse({ payload: 42 }));
    const client = new SpApiClient(endpoints, fakeTokenClient(), fetchFn, {
      sleepFn: async () => {},
    });

    const result = await client.request<{ payload: number }>({
      operation: "ping",
      method: "GET",
      path: "/x",
    });

    expect(result.payload).toBe(42);
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });
});
