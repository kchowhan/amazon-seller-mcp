// src/client.test.ts
import { describe, it, expect, vi } from "vitest";
import { SpApiClient, buildUrl } from "./client";
import type { LwaTokenClient } from "./auth/lwaTokenClient";
import { SpApiError } from "./errors";

const endpoints = {
  spApiBaseUrl: "https://sandbox.sellingpartnerapi-na.amazon.com",
  lwaTokenUrl: "https://api.amazon.com/auth/o2/token",
};

function fakeTokenClient(token = "AT1"): LwaTokenClient {
  return {
    getAccessToken: vi.fn().mockResolvedValue(token),
    getGrantlessToken: vi.fn().mockResolvedValue("GT1"),
  } as unknown as LwaTokenClient;
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

  it("omits empty array params entirely", () => {
    const url = buildUrl("https://h.example.com", "/a", { marketplaceIds: [] });
    expect(url).toBe("https://h.example.com/a");
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

  it("throws after exhausting retries on repeated 429", async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response("throttled", { status: 429 }));
    const client = new SpApiClient(endpoints, fakeTokenClient(), fetchFn, {
      sleepFn: async () => {},
    });

    await expect(
      client.request({ operation: "ping", method: "GET", path: "/x" }),
    ).rejects.toSatisfy(
      (e: unknown) => e instanceof SpApiError && e.status === 429,
    );
    expect(fetchFn).toHaveBeenCalledTimes(4); // 1 initial + 3 retries
  });

  it("uses getGrantlessToken and NOT getAccessToken when grantless option is set", async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse({ ok: true }));
    const tokenClient = fakeTokenClient();
    const client = new SpApiClient(endpoints, tokenClient, fetchFn);

    await client.request({
      operation: "getDestinations",
      method: "GET",
      path: "/notifications/v1/destinations",
      grantless: { scope: "sellingpartnerapi::notifications" },
    });

    expect(tokenClient.getGrantlessToken).toHaveBeenCalledWith("sellingpartnerapi::notifications");
    expect(tokenClient.getAccessToken).not.toHaveBeenCalled();
    const [, init] = fetchFn.mock.calls[0]!;
    expect((init.headers as Record<string, string>)["x-amz-access-token"]).toBe("GT1");
  });

  it("retries on 5xx then succeeds", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(new Response("server error", { status: 503 }))
      .mockResolvedValueOnce(jsonResponse({ payload: 99 }));
    const client = new SpApiClient(endpoints, fakeTokenClient(), fetchFn, {
      sleepFn: async () => {},
    });

    const result = await client.request<{ payload: number }>({
      operation: "ping",
      method: "GET",
      path: "/x",
    });

    expect(result.payload).toBe(99);
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });
});
