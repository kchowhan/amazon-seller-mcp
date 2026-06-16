// src/errors.ts
export class SpApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
    readonly retryable: boolean = false,
    readonly responseBody?: string,
  ) {
    super(message);
    this.name = "SpApiError";
  }

  // `retryable` marks a transient error CLASS (HTTP 429 or 5xx). The transport
  // (SpApiClient) already exhausts its bounded internal retry budget before throwing,
  // so any further retry is the caller's responsibility and must itself be bounded.
  static isRetryable(status: number): boolean {
    return status === 429 || status >= 500;
  }
}
