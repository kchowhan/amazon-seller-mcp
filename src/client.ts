// src/client.ts
import type { Endpoints } from "./endpoints";
import type { LwaTokenClient, FetchLike } from "./auth/lwaTokenClient";
import type { Clock } from "./clock";
import { systemClock } from "./clock";
import { SpApiError } from "./errors";
import { TokenBucket, sleep, type SleepLike } from "./rateLimiter";

export interface RequestOptions {
  operation: string; // logical name, used for the per-operation rate-limit bucket
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  query?: Record<string, string | number | string[] | undefined>;
  body?: unknown;
  rateLimit?: { rate: number; burst: number };
  /** When set, use a grantless LWA token (client_credentials) instead of getAccessToken(). */
  grantless?: { scope: string };
  /**
   * When set, mint a Restricted Data Token (RDT) via the Tokens API and send it as
   * x-amz-access-token. Required for restricted operations that return PII.
   * The path in each entry must exactly match the request path (with path-param substitution applied).
   */
  restrictedResources?: { method: string; path: string; dataElements?: string[] }[];
}

export function buildUrl(
  base: string,
  path: string,
  query?: RequestOptions["query"],
): string {
  const url = new URL(path, base);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined) continue;
      if (Array.isArray(value)) {
        if (value.length === 0) continue;
        url.searchParams.set(key, value.join(","));
      } else {
        url.searchParams.set(key, String(value));
      }
    }
  }
  return url.toString();
}

const DEFAULT_RATE_LIMIT = { rate: 1, burst: 5 };
const TOKEN_RATE = { rate: 1, burst: 10 };
const USER_AGENT = "amazon-seller-mcp/0.1 (Language=TypeScript)";

export class SpApiClient {
  private readonly buckets = new Map<string, TokenBucket>();
  private readonly rdtCache = new Map<string, { token: string; expiresAt: number }>();

  constructor(
    private readonly endpoints: Endpoints,
    private readonly tokenClient: LwaTokenClient,
    private readonly fetchFn: FetchLike = fetch,
    private readonly opts: { maxRetries?: number; sleepFn?: SleepLike; clock?: Clock } = {},
  ) {}

  private bucketFor(options: RequestOptions): TokenBucket {
    let bucket = this.buckets.get(options.operation);
    if (!bucket) {
      const limit = options.rateLimit ?? DEFAULT_RATE_LIMIT;
      bucket = new TokenBucket(limit.rate, limit.burst, this.opts.clock, this.opts.sleepFn);
      this.buckets.set(options.operation, bucket);
    }
    return bucket;
  }

  async request<T>(options: RequestOptions): Promise<T> {
    const bucket = this.bucketFor(options);
    const maxRetries = this.opts.maxRetries ?? 3;
    const sleepFn = this.opts.sleepFn ?? sleep;
    const url = buildUrl(this.endpoints.spApiBaseUrl, options.path, options.query);

    // Resolve the access token once before the retry loop.
    // Priority: restrictedResources (RDT) -> grantless -> normal.
    let token: string;
    if (options.restrictedResources) {
      token = await this.mintRdt(options.restrictedResources);
    } else if (options.grantless) {
      token = await this.tokenClient.getGrantlessToken(options.grantless.scope);
    } else {
      token = await this.tokenClient.getAccessToken();
    }

    let attempt = 0;
    for (;;) {
      await bucket.acquire();
      const res = await this.fetchFn(url, {
        method: options.method,
        headers: {
          "x-amz-access-token": token,
          "content-type": "application/json",
          "user-agent": USER_AGENT,
        },
        body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      });

      const isTransient = res.status === 429 || res.status >= 500;
      if (isTransient && attempt < maxRetries) {
        attempt += 1;
        await sleepFn(2 ** attempt * 100);
        continue;
      }
      if (!res.ok) {
        const text = await res.text();
        throw new SpApiError(
          `SP-API ${options.operation} failed with status ${res.status}`,
          res.status,
          undefined,
          SpApiError.isRetryable(res.status),
          text,
        );
      }
      return (await res.json()) as T;
    }
  }

  private async mintRdt(
    restrictedResources: NonNullable<RequestOptions["restrictedResources"]>,
  ): Promise<string> {
    const key = JSON.stringify(restrictedResources);
    const now = (this.opts.clock ?? systemClock).now();
    const cached = this.rdtCache.get(key);
    if (cached && now < cached.expiresAt - 60_000) {
      return cached.token;
    }
    const res = await this.request<{ restrictedDataToken: string; expiresIn: number }>({
      operation: "createRestrictedDataToken",
      method: "POST",
      path: "/tokens/2021-03-01/restrictedDataToken",
      body: { restrictedResources },
      rateLimit: TOKEN_RATE,
    });
    const token = res.restrictedDataToken;
    this.rdtCache.set(key, { token, expiresAt: now + res.expiresIn * 1000 });
    return token;
  }
}
