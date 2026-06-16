// src/errors.ts
export class SpApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
    readonly retryable: boolean = false,
  ) {
    super(message);
    this.name = "SpApiError";
  }

  static isRetryable(status: number): boolean {
    return status === 429 || status >= 500;
  }
}
