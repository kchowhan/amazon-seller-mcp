// src/auth/lwaTokenClient.ts
import { SpApiError } from "../errors";

export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

export type FetchLike = (url: string, init: RequestInit) => Promise<Response>;
export interface Clock {
  now(): number;
}
export const systemClock: Clock = { now: () => Date.now() };

type LwaCreds = { lwaClientId: string; lwaClientSecret: string; refreshToken: string };

const SAFETY_MS = 60_000;

export class LwaTokenClient {
  private cached?: { token: string; expiresAt: number };

  constructor(
    private readonly creds: LwaCreds,
    private readonly tokenUrl: string,
    private readonly fetchFn: FetchLike = fetch,
    private readonly clock: Clock = systemClock,
  ) {}

  async getAccessToken(): Promise<string> {
    if (this.cached && this.clock.now() < this.cached.expiresAt - SAFETY_MS) {
      return this.cached.token;
    }
    const body = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: this.creds.refreshToken,
      client_id: this.creds.lwaClientId,
      client_secret: this.creds.lwaClientSecret,
    });
    return this.requestToken(body);
  }

  async getGrantlessToken(scope: string): Promise<string> {
    const body = new URLSearchParams({
      grant_type: "client_credentials",
      scope,
      client_id: this.creds.lwaClientId,
      client_secret: this.creds.lwaClientSecret,
    });
    // Grantless tokens are not cached here; callers use them immediately.
    return this.requestToken(body, false);
  }

  private async requestToken(body: URLSearchParams, cache = true): Promise<string> {
    const res = await this.fetchFn(this.tokenUrl, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new SpApiError(
        `LWA token request failed: ${text}`,
        res.status,
        "LWA_TOKEN_ERROR",
        SpApiError.isRetryable(res.status),
      );
    }
    const json = (await res.json()) as TokenResponse;
    if (cache) {
      this.cached = { token: json.access_token, expiresAt: this.clock.now() + json.expires_in * 1000 };
    }
    return json.access_token;
  }
}
