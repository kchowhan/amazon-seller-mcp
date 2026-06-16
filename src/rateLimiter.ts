// src/rateLimiter.ts
import { systemClock, type Clock } from "./clock";

export type SleepLike = (ms: number) => Promise<void>;
export const sleep: SleepLike = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export class TokenBucket {
  private tokens: number;
  private lastRefill: number;

  constructor(
    private readonly rate: number, // tokens per second
    private readonly burst: number, // bucket capacity
    private readonly clock: Clock = systemClock,
    private readonly sleepFn: SleepLike = sleep,
  ) {
    this.tokens = burst;
    this.lastRefill = clock.now();
  }

  async acquire(): Promise<void> {
    this.refill();
    while (this.tokens < 1) {
      const deficit = 1 - this.tokens;
      const waitMs = Math.ceil((deficit / this.rate) * 1000);
      await this.sleepFn(waitMs);
      this.refill();
    }
    this.tokens -= 1;
  }

  private refill(): void {
    const now = this.clock.now();
    const elapsedSec = (now - this.lastRefill) / 1000;
    if (elapsedSec > 0) {
      this.tokens = Math.min(this.burst, this.tokens + elapsedSec * this.rate);
      this.lastRefill = now;
    }
  }
}
