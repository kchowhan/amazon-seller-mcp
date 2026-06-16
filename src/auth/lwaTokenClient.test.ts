// src/auth/lwaTokenClient.test.ts
import { describe, it, expect, vi } from "vitest";
import { LwaTokenClient } from "./lwaTokenClient";

const creds = { lwaClientId: "id", lwaClientSecret: "secret", refreshToken: "Atzr|rt" };
const tokenUrl = "https://api.amazon.com/auth/o2/token";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function mutableClock(start = 0) {
  let t = start;
  return { now: () => t, advance: (ms: number) => (t += ms) };
}

describe("LwaTokenClient", () => {
  it("exchanges the refresh token and returns the access token", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      jsonResponse({ access_token: "AT1", token_type: "bearer", expires_in: 3600 }),
    );
    const client = new LwaTokenClient(creds, tokenUrl, fetchFn);

    const token = await client.getAccessToken();

    expect(token).toBe("AT1");
    expect(fetchFn).toHaveBeenCalledTimes(1);
    const [url, init] = fetchFn.mock.calls[0]!;
    expect(url).toBe(tokenUrl);
    expect(init.method).toBe("POST");
    expect(String(init.body)).toContain("grant_type=refresh_token");
    expect(String(init.body)).toContain("refresh_token=Atzr%7Crt");
  });

  it("caches the token until shortly before expiry, then refetches", async () => {
    const clock = mutableClock(0);
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ access_token: "AT1", token_type: "bearer", expires_in: 3600 }))
      .mockResolvedValueOnce(jsonResponse({ access_token: "AT2", token_type: "bearer", expires_in: 3600 }));
    const client = new LwaTokenClient(creds, tokenUrl, fetchFn, clock);

    expect(await client.getAccessToken()).toBe("AT1");
    clock.advance(1000 * 1000); // well before the 3600s - 60s safety window
    expect(await client.getAccessToken()).toBe("AT1");
    expect(fetchFn).toHaveBeenCalledTimes(1);

    clock.advance(3600 * 1000); // now past expiry
    expect(await client.getAccessToken()).toBe("AT2");
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it("throws SpApiError when the token endpoint returns an error", async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response("invalid_grant", { status: 400 }));
    const client = new LwaTokenClient(creds, tokenUrl, fetchFn);
    await expect(client.getAccessToken()).rejects.toThrow(/LWA token request failed/);
  });
});
