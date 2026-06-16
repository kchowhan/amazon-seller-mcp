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

  it("mints an RDT via Tokens API then sends it as x-amz-access-token on the restricted call", async () => {
    const tokenApiPath = "/tokens/2021-03-01/restrictedDataToken";
    const restrictedPath = "/orders/v0/orders";

    // URL-branching fetch mock: first call is the Tokens POST, second is the actual restricted GET
    const fetchFn = vi.fn().mockImplementation((url: string) => {
      if (url.includes(tokenApiPath)) {
        return Promise.resolve(
          jsonResponse({ restrictedDataToken: "RDT1", expiresIn: 3600 }),
        );
      }
      return Promise.resolve(jsonResponse({ orders: [] }));
    });

    const tokenClient = fakeTokenClient("NORMAL_TOKEN");
    const client = new SpApiClient(endpoints, tokenClient, fetchFn);

    const result = await client.request<{ orders: unknown[] }>({
      operation: "getOrders",
      method: "GET",
      path: restrictedPath,
      restrictedResources: [
        { method: "GET", path: restrictedPath, dataElements: ["buyerInfo"] },
      ],
    });

    // Should have made exactly 2 fetch calls: Tokens POST then the restricted GET
    expect(fetchFn).toHaveBeenCalledTimes(2);

    // First call: POST to the Tokens API with the correct body
    const [tokUrl, tokInit] = fetchFn.mock.calls[0]!;
    expect(tokUrl).toContain(tokenApiPath);
    expect(tokInit.method).toBe("POST");
    const tokBody = JSON.parse(tokInit.body as string) as {
      restrictedResources: { method: string; path: string; dataElements: string[] }[];
    };
    expect(tokBody.restrictedResources).toEqual([
      { method: "GET", path: restrictedPath, dataElements: ["buyerInfo"] },
    ]);
    // The Tokens POST itself uses the normal access token
    expect((tokInit.headers as Record<string, string>)["x-amz-access-token"]).toBe("NORMAL_TOKEN");

    // Second call: actual restricted GET uses the RDT
    const [ordUrl, ordInit] = fetchFn.mock.calls[1]!;
    expect(ordUrl).toContain(restrictedPath);
    expect((ordInit.headers as Record<string, string>)["x-amz-access-token"]).toBe("RDT1");

    expect(result.orders).toEqual([]);
  });

  it("getAccessToken is called exactly once, by mintRdt's inner Tokens request, not by the outer restricted call", async () => {
    const fetchFn = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/tokens/2021-03-01/restrictedDataToken")) {
        return Promise.resolve(jsonResponse({ restrictedDataToken: "RDT2", expiresIn: 3600 }));
      }
      return Promise.resolve(jsonResponse({ ok: true }));
    });

    const tokenClient = fakeTokenClient();
    const client = new SpApiClient(endpoints, tokenClient, fetchFn);

    await client.request({
      operation: "getOrder",
      method: "GET",
      path: "/orders/v0/orders/111-2222222-3333333",
      restrictedResources: [
        { method: "GET", path: "/orders/v0/orders/111-2222222-3333333", dataElements: ["buyerInfo", "shippingAddress"] },
      ],
    });

    // getAccessToken is called once (by mintRdt's inner request), NOT by the outer restricted call
    expect(tokenClient.getAccessToken).toHaveBeenCalledTimes(1);
    expect(tokenClient.getGrantlessToken).not.toHaveBeenCalled();
  });

  it("RDT cache: same restrictedResources hits Tokens API only once; both calls use the same RDT", async () => {
    const tokenApiPath = "/tokens/2021-03-01/restrictedDataToken";
    const restrictedPath = "/orders/v0/orders";
    let tokenCallCount = 0;

    const fetchFn = vi.fn().mockImplementation((url: string) => {
      if (url.includes(tokenApiPath)) {
        tokenCallCount += 1;
        return Promise.resolve(jsonResponse({ restrictedDataToken: "RDT-CACHED", expiresIn: 3600 }));
      }
      return Promise.resolve(jsonResponse({ orders: [] }));
    });

    const fakeClock = { now: vi.fn().mockReturnValue(1_000_000) };
    const client = new SpApiClient(endpoints, fakeTokenClient("AT"), fetchFn, { clock: fakeClock });

    const resources = [{ method: "GET", path: restrictedPath, dataElements: ["buyerInfo"] }];

    // First restricted request: should mint RDT (1 Tokens API call)
    await client.request({ operation: "getOrders", method: "GET", path: restrictedPath, restrictedResources: resources });
    // Second restricted request with the SAME scope: should reuse cache (no new Tokens call)
    await client.request({ operation: "getOrders", method: "GET", path: restrictedPath, restrictedResources: resources });

    expect(tokenCallCount).toBe(1);

    // Both real calls (fetch calls 2 and 3) used the cached RDT
    const realCalls = fetchFn.mock.calls.filter((args) => (args[0] as string).includes(restrictedPath));
    for (const [, init] of realCalls) {
      expect((init.headers as Record<string, string>)["x-amz-access-token"]).toBe("RDT-CACHED");
    }
  });

  it("RDT cache: after expiry window, a third request re-mints (Tokens API called a second time)", async () => {
    const tokenApiPath = "/tokens/2021-03-01/restrictedDataToken";
    const restrictedPath = "/orders/v0/orders";
    let tokenCallCount = 0;

    // Clock starts at t=0; RDT expiresIn=3600s -> expiresAt=3_600_000ms; stale after t=3_540_000ms
    let currentTime = 0;
    const fakeClock = { now: vi.fn().mockImplementation(() => currentTime) };

    const fetchFn = vi.fn().mockImplementation((url: string) => {
      if (url.includes(tokenApiPath)) {
        tokenCallCount += 1;
        return Promise.resolve(jsonResponse({ restrictedDataToken: `RDT-${tokenCallCount}`, expiresIn: 3600 }));
      }
      return Promise.resolve(jsonResponse({ orders: [] }));
    });

    const client = new SpApiClient(endpoints, fakeTokenClient("AT"), fetchFn, { clock: fakeClock });
    const resources = [{ method: "GET", path: restrictedPath, dataElements: ["buyerInfo"] }];

    // First request at t=0: mints RDT-1
    await client.request({ operation: "getOrders", method: "GET", path: restrictedPath, restrictedResources: resources });
    expect(tokenCallCount).toBe(1);

    // Second request within cache window: reuses RDT-1
    currentTime = 3_539_999; // just before the 60s safety margin
    await client.request({ operation: "getOrders", method: "GET", path: restrictedPath, restrictedResources: resources });
    expect(tokenCallCount).toBe(1);

    // Advance clock past expiresAt - 60_000 (3_600_000 - 60_000 = 3_540_000)
    currentTime = 3_540_001;
    // Third request: cache is stale, should re-mint -> RDT-2
    await client.request({ operation: "getOrders", method: "GET", path: restrictedPath, restrictedResources: resources });
    expect(tokenCallCount).toBe(2);
  });

  it("RDT cache: different restrictedResources scopes mint separate RDTs", async () => {
    const tokenApiPath = "/tokens/2021-03-01/restrictedDataToken";
    let tokenCallCount = 0;

    const fetchFn = vi.fn().mockImplementation((url: string) => {
      if (url.includes(tokenApiPath)) {
        tokenCallCount += 1;
        return Promise.resolve(jsonResponse({ restrictedDataToken: `RDT-SCOPE-${tokenCallCount}`, expiresIn: 3600 }));
      }
      return Promise.resolve(jsonResponse({ ok: true }));
    });

    const fakeClock = { now: vi.fn().mockReturnValue(1_000_000) };
    const client = new SpApiClient(endpoints, fakeTokenClient("AT"), fetchFn, { clock: fakeClock });

    const resourcesA = [{ method: "GET", path: "/orders/v0/orders", dataElements: ["buyerInfo"] }];
    const resourcesB = [{ method: "GET", path: "/orders/v0/orders/123", dataElements: ["buyerInfo", "shippingAddress"] }];

    await client.request({ operation: "getOrders", method: "GET", path: "/orders/v0/orders", restrictedResources: resourcesA });
    await client.request({ operation: "getOrder", method: "GET", path: "/orders/v0/orders/123", restrictedResources: resourcesB });

    // Different scopes -> two separate Tokens API calls
    expect(tokenCallCount).toBe(2);

    // Each real call used its respective RDT
    const ordersCall = fetchFn.mock.calls.find((args) => (args[0] as string).endsWith("/orders/v0/orders"))!;
    const orderCall = fetchFn.mock.calls.find((args) => (args[0] as string).endsWith("/orders/v0/orders/123"))!;
    expect((ordersCall[1].headers as Record<string, string>)["x-amz-access-token"]).toBe("RDT-SCOPE-1");
    expect((orderCall[1].headers as Record<string, string>)["x-amz-access-token"]).toBe("RDT-SCOPE-2");
  });
});
