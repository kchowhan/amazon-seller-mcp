// src/rateLimiter.test.ts
import { describe, it, expect } from "vitest";
import { TokenBucket } from "./rateLimiter";

function mutableClock(start = 0) {
  let t = start;
  return { now: () => t, advance: (ms: number) => (t += ms) };
}

describe("TokenBucket", () => {
  it("allows up to burst acquisitions immediately", async () => {
    const clock = mutableClock();
    const bucket = new TokenBucket(1, 3, clock, async () => {});
    await bucket.acquire();
    await bucket.acquire();
    await bucket.acquire();
    // No waiting should have happened; clock untouched by acquire itself.
    expect(clock.now()).toBe(0);
  });

  it("waits and refills when the bucket is empty", async () => {
    const clock = mutableClock();
    // sleep advances the clock so refill() can replenish a token.
    const sleepFn = async (ms: number) => {
      clock.advance(ms);
    };
    const bucket = new TokenBucket(1, 1, clock, sleepFn); // rate 1/s, burst 1
    await bucket.acquire(); // consumes the only token
    await bucket.acquire(); // must wait ~1000ms for one token to refill
    expect(clock.now()).toBeGreaterThanOrEqual(1000);
  });
});
