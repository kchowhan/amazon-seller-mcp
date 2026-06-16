// src/errors.test.ts
import { describe, it, expect } from "vitest";
import { SpApiError } from "./errors";

describe("SpApiError", () => {
  it("carries status, code, and retryable flag", () => {
    const err = new SpApiError("boom", 429, "QuotaExceeded", true);
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("SpApiError");
    expect(err.status).toBe(429);
    expect(err.code).toBe("QuotaExceeded");
    expect(err.retryable).toBe(true);
  });

  it("classifies 429 and 5xx as retryable, 4xx as not", () => {
    expect(SpApiError.isRetryable(429)).toBe(true);
    expect(SpApiError.isRetryable(503)).toBe(true);
    expect(SpApiError.isRetryable(400)).toBe(false);
    expect(SpApiError.isRetryable(403)).toBe(false);
  });
});
