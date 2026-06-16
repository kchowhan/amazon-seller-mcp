# Phase 0 Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the testable foundation of the Amazon SP-API MCP server: a Node/TypeScript project with a resilient SP-API transport core (LWA auth, rate limiting, typed errors) exposed through a local stdio MCP server with a first working end-to-end tool.

**Architecture:** A thin, dependency-injected transport layer (`SpApiClient`) composes an LWA token client and a token-bucket rate limiter, sends signing-free requests with the `x-amz-access-token` header, and maps failures to typed errors. Operation wrappers call the transport and return typed data. An stdio MCP server registers tools that call the operation wrappers. Everything is unit-tested with injected `fetch`/clock/sleep, plus optional live contract tests against the SP-API sandbox.

**Tech Stack:** Node 20+, TypeScript (ESM), `@modelcontextprotocol/sdk`, `zod`, Vitest (tests), `tsx` (run), `tsup` (build), Prettier.

**Scope note:** This plan is Phase 0, part 1. It proves the full vertical (env credentials, to LWA token, to SP-API call, to typed result, to MCP tool) with the simplest authed operation (`getMarketplaceParticipations`). The remaining cheap-lane tools (catalog, listings read/write, product-type schema, FBA inventory, feeds, pricing, fees, the async report request/poll/download pattern, finance, sales, notifications) follow the same operation-wrapper + tool pattern and are deferred to the next plan. They are a sequence within Phase 0, not a scope cut.

---

## Prerequisites (manual, external; do not block coding)

These are needed for live validation only. All unit tests in this plan run without them (they use mocked `fetch`). Obtain them in parallel:

1. Register an SP-API developer account in the Solution Provider Portal.
2. Create a **draft** application; record the LWA `client_id` and `client_secret`.
3. **Self-authorize** the draft app against Portar's own seller account to obtain a 1-year refresh token.
4. Note the North America marketplace ID(s) (e.g. US is `ATVPDKIKX0DER`).
5. Confirm sandbox base host: `https://sandbox.sellingpartnerapi-na.amazon.com`.

When available, place these in a local `.env` (see Task 1). Until then, run `npm test` (mocked) freely; skip the live contract test.

---

## File structure

| File | Responsibility |
|---|---|
| `package.json`, `tsconfig.json`, `vitest.config.ts`, `.prettierrc`, `.env.example` | Project scaffold and tooling |
| `src/config.ts` | Load and validate environment into a typed `SpApiConfig` |
| `src/endpoints.ts` | Resolve region + sandbox flag to SP-API base URL and LWA token URL |
| `src/errors.ts` | `SpApiError` type and retryable classification |
| `src/auth/lwaTokenClient.ts` | Exchange refresh token for cached LWA access tokens; grantless tokens |
| `src/rateLimiter.ts` | `TokenBucket` rate limiter with injectable clock/sleep |
| `src/client.ts` | `SpApiClient` transport: compose auth + rate limit + fetch + retries + error mapping; `buildUrl` |
| `src/operations/sellers.ts` | `getMarketplaceParticipations` operation wrapper |
| `src/mcp/tools.ts` | Pure, testable tool handler functions |
| `src/mcp/server.ts` | Build the `McpServer` and register tools |
| `src/index.ts` | Entry point: load config, wire dependencies, connect stdio transport |
| `README.md` | Setup, run, and manual validation checklist |

Shared types and signatures (defined once, reused across tasks):
- `Region = "na" | "eu" | "fe"`
- `SpApiConfig { lwaClientId, lwaClientSecret, refreshToken, region, marketplaceIds, sandbox }`
- `Endpoints { spApiBaseUrl, lwaTokenUrl }`
- `FetchLike = (url: string, init: RequestInit) => Promise<Response>`
- `Clock { now(): number }`, `SleepLike = (ms: number) => Promise<void>`
- `SpApiError(message, status, code?, retryable?)`
- `LwaTokenClient.getAccessToken(): Promise<string>`
- `TokenBucket.acquire(): Promise<void>`
- `SpApiClient.request<T>(options: RequestOptions): Promise<T>`

---

## Task 1: Project scaffold and tooling

**Files:**
- Create: `package.json`, `tsconfig.json`, `vitest.config.ts`, `.prettierrc`, `.env.example`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "amazon-seller-mcp",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "engines": { "node": ">=20" },
  "bin": { "amazon-seller-mcp": "dist/index.js" },
  "scripts": {
    "dev": "tsx src/index.ts",
    "build": "tsup src/index.ts --format esm --clean",
    "typecheck": "tsc --noEmit",
    "test": "vitest run --passWithNoTests",
    "test:watch": "vitest",
    "format": "prettier --write ."
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "@types/node": "^20.14.0",
    "prettier": "^3.3.0",
    "tsup": "^8.0.0",
    "tsx": "^4.16.0",
    "typescript": "^5.5.0",
    "vitest": "^2.0.0"
  }
}
```

Note: keep `zod` on `^3` to match the MCP SDK's peer expectation. If `npm install` warns of a peer mismatch, align `zod` to the version the installed `@modelcontextprotocol/sdk` requires.

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022"],
    "types": ["node"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "noEmit": true
  },
  "include": ["src", "vitest.config.ts"]
}
```

Imports are extensionless (e.g. `from "./config"`); `tsx`, `vitest`, and `tsup` all resolve TS directly, and `tsup` bundles the build.

- [ ] **Step 3: Create `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
```

- [ ] **Step 4: Create `.prettierrc`**

```json
{ "printWidth": 100, "singleQuote": false, "trailingComma": "all" }
```

- [ ] **Step 5: Create `.env.example`**

```bash
# Login with Amazon (LWA) application credentials
LWA_CLIENT_ID=amzn1.application-oa2-client.xxxxxxxx
LWA_CLIENT_SECRET=amzn1.oa2-cs.v1.xxxxxxxx
# Refresh token from self-authorizing the draft app against your seller account
SPAPI_REFRESH_TOKEN=Atzr|xxxxxxxx
# Region: na | eu | fe  (Phase 0 targets na)
SPAPI_REGION=na
# Comma-separated marketplace IDs (US = ATVPDKIKX0DER)
SPAPI_MARKETPLACE_IDS=ATVPDKIKX0DER
# Use the sandbox endpoint (true) or production (false)
SPAPI_SANDBOX=true
```

- [ ] **Step 6: Install dependencies**

Run: `npm install`
Expected: dependencies install with no errors (peer-dep warnings about `zod` are acceptable; resolve only if install fails).

- [ ] **Step 7: Verify the test harness runs**

Run: `npm test`
Expected: PASS with "No test files found, exiting with code 0" (the `--passWithNoTests` flag).

- [ ] **Step 8: Verify typecheck runs**

Run: `npm run typecheck`
Expected: exits 0 (no `src` files yet, nothing to check).

- [ ] **Step 9: Commit**

```bash
git add package.json tsconfig.json vitest.config.ts .prettierrc .env.example package-lock.json
git commit -m "chore: scaffold Node/TS project with Vitest and tsup"
```

---

## Task 2: Config loader

**Files:**
- Create: `src/config.ts`
- Test: `src/config.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/config.test.ts
import { describe, it, expect } from "vitest";
import { loadConfig } from "./config";

const base = {
  LWA_CLIENT_ID: "id",
  LWA_CLIENT_SECRET: "secret",
  SPAPI_REFRESH_TOKEN: "Atzr|token",
  SPAPI_MARKETPLACE_IDS: "ATVPDKIKX0DER,A2EUQ1WTGCTBG2",
};

describe("loadConfig", () => {
  it("parses a valid environment and defaults region to na and sandbox to false", () => {
    const cfg = loadConfig(base);
    expect(cfg.lwaClientId).toBe("id");
    expect(cfg.lwaClientSecret).toBe("secret");
    expect(cfg.refreshToken).toBe("Atzr|token");
    expect(cfg.region).toBe("na");
    expect(cfg.sandbox).toBe(false);
    expect(cfg.marketplaceIds).toEqual(["ATVPDKIKX0DER", "A2EUQ1WTGCTBG2"]);
  });

  it("reads sandbox=true and an explicit region", () => {
    const cfg = loadConfig({ ...base, SPAPI_SANDBOX: "true", SPAPI_REGION: "eu" });
    expect(cfg.sandbox).toBe(true);
    expect(cfg.region).toBe("eu");
  });

  it("throws when a required variable is missing", () => {
    const { LWA_CLIENT_ID, ...withoutId } = base;
    expect(() => loadConfig(withoutId)).toThrow(/LWA_CLIENT_ID/);
  });

  it("throws on an invalid region", () => {
    expect(() => loadConfig({ ...base, SPAPI_REGION: "mars" })).toThrow(/region/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/config.test.ts`
Expected: FAIL with "Cannot find module './config'".

- [ ] **Step 3: Write minimal implementation**

```ts
// src/config.ts
export type Region = "na" | "eu" | "fe";

export interface SpApiConfig {
  lwaClientId: string;
  lwaClientSecret: string;
  refreshToken: string;
  region: Region;
  marketplaceIds: string[];
  sandbox: boolean;
}

const REGIONS: Region[] = ["na", "eu", "fe"];

function required(env: Record<string, string | undefined>, key: string): string {
  const value = env[key];
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
  return value;
}

export function loadConfig(env: Record<string, string | undefined> = process.env): SpApiConfig {
  const region = (env.SPAPI_REGION ?? "na") as Region;
  if (!REGIONS.includes(region)) {
    throw new Error(`Invalid SPAPI_REGION "${region}"; expected one of ${REGIONS.join(", ")}`);
  }
  const marketplaceIds = required(env, "SPAPI_MARKETPLACE_IDS")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);

  return {
    lwaClientId: required(env, "LWA_CLIENT_ID"),
    lwaClientSecret: required(env, "LWA_CLIENT_SECRET"),
    refreshToken: required(env, "SPAPI_REFRESH_TOKEN"),
    region,
    marketplaceIds,
    sandbox: (env.SPAPI_SANDBOX ?? "false").toLowerCase() === "true",
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/config.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/config.ts src/config.test.ts
git commit -m "feat: typed config loader from environment"
```

---

## Task 3: Endpoint resolver

**Files:**
- Create: `src/endpoints.ts`
- Test: `src/endpoints.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/endpoints.test.ts
import { describe, it, expect } from "vitest";
import { resolveEndpoints } from "./endpoints";

describe("resolveEndpoints", () => {
  it("returns the NA production base URL when sandbox is false", () => {
    const e = resolveEndpoints("na", false);
    expect(e.spApiBaseUrl).toBe("https://sellingpartnerapi-na.amazon.com");
    expect(e.lwaTokenUrl).toBe("https://api.amazon.com/auth/o2/token");
  });

  it("returns the NA sandbox base URL when sandbox is true", () => {
    const e = resolveEndpoints("na", true);
    expect(e.spApiBaseUrl).toBe("https://sandbox.sellingpartnerapi-na.amazon.com");
  });

  it("returns the EU and FE production hosts", () => {
    expect(resolveEndpoints("eu", false).spApiBaseUrl).toBe(
      "https://sellingpartnerapi-eu.amazon.com",
    );
    expect(resolveEndpoints("fe", false).spApiBaseUrl).toBe(
      "https://sellingpartnerapi-fe.amazon.com",
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/endpoints.test.ts`
Expected: FAIL with "Cannot find module './endpoints'".

- [ ] **Step 3: Write minimal implementation**

```ts
// src/endpoints.ts
import type { Region } from "./config";

export interface Endpoints {
  spApiBaseUrl: string;
  lwaTokenUrl: string;
}

const HOSTS: Record<Region, { prod: string; sandbox: string }> = {
  na: {
    prod: "https://sellingpartnerapi-na.amazon.com",
    sandbox: "https://sandbox.sellingpartnerapi-na.amazon.com",
  },
  eu: {
    prod: "https://sellingpartnerapi-eu.amazon.com",
    sandbox: "https://sandbox.sellingpartnerapi-eu.amazon.com",
  },
  fe: {
    prod: "https://sellingpartnerapi-fe.amazon.com",
    sandbox: "https://sandbox.sellingpartnerapi-fe.amazon.com",
  },
};

// LWA token endpoint is global, not per-region.
const LWA_TOKEN_URL = "https://api.amazon.com/auth/o2/token";

export function resolveEndpoints(region: Region, sandbox: boolean): Endpoints {
  const host = HOSTS[region];
  return {
    spApiBaseUrl: sandbox ? host.sandbox : host.prod,
    lwaTokenUrl: LWA_TOKEN_URL,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/endpoints.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/endpoints.ts src/endpoints.test.ts
git commit -m "feat: region and sandbox endpoint resolver"
```

---

## Task 4: Typed errors

**Files:**
- Create: `src/errors.ts`
- Test: `src/errors.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/errors.test.ts`
Expected: FAIL with "Cannot find module './errors'".

- [ ] **Step 3: Write minimal implementation**

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/errors.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/errors.ts src/errors.test.ts
git commit -m "feat: typed SpApiError with retryable classification"
```

---

## Task 5: LWA token client

**Files:**
- Create: `src/auth/lwaTokenClient.ts`
- Test: `src/auth/lwaTokenClient.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/auth/lwaTokenClient.test.ts`
Expected: FAIL with "Cannot find module './lwaTokenClient'".

- [ ] **Step 3: Write minimal implementation**

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/auth/lwaTokenClient.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/auth/lwaTokenClient.ts src/auth/lwaTokenClient.test.ts
git commit -m "feat: LWA token client with caching and grantless support"
```

---

## Task 6: Token-bucket rate limiter

**Files:**
- Create: `src/rateLimiter.ts`
- Test: `src/rateLimiter.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/rateLimiter.test.ts`
Expected: FAIL with "Cannot find module './rateLimiter'".

- [ ] **Step 3: Write minimal implementation**

```ts
// src/rateLimiter.ts
import type { Clock } from "./auth/lwaTokenClient";
import { systemClock } from "./auth/lwaTokenClient";

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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/rateLimiter.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/rateLimiter.ts src/rateLimiter.test.ts
git commit -m "feat: token-bucket rate limiter with injectable clock"
```

---

## Task 7: SP-API transport client

**Files:**
- Create: `src/client.ts`
- Test: `src/client.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/client.test.ts
import { describe, it, expect, vi } from "vitest";
import { SpApiClient, buildUrl } from "./client";
import type { LwaTokenClient } from "./auth/lwaTokenClient";

const endpoints = {
  spApiBaseUrl: "https://sandbox.sellingpartnerapi-na.amazon.com",
  lwaTokenUrl: "https://api.amazon.com/auth/o2/token",
};

function fakeTokenClient(token = "AT1"): LwaTokenClient {
  return { getAccessToken: vi.fn().mockResolvedValue(token) } as unknown as LwaTokenClient;
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
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/client.test.ts`
Expected: FAIL with "Cannot find module './client'".

- [ ] **Step 3: Write minimal implementation**

```ts
// src/client.ts
import type { Endpoints } from "./endpoints";
import type { LwaTokenClient, FetchLike, Clock } from "./auth/lwaTokenClient";
import { SpApiError } from "./errors";
import { TokenBucket, sleep, type SleepLike } from "./rateLimiter";

export interface RequestOptions {
  operation: string; // logical name, used for the per-operation rate-limit bucket
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  query?: Record<string, string | number | string[] | undefined>;
  body?: unknown;
  rateLimit?: { rate: number; burst: number };
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
      url.searchParams.set(key, Array.isArray(value) ? value.join(",") : String(value));
    }
  }
  return url.toString();
}

const DEFAULT_RATE_LIMIT = { rate: 1, burst: 5 };
const USER_AGENT = "amazon-seller-mcp/0.1 (Language=TypeScript)";

export class SpApiClient {
  private readonly buckets = new Map<string, TokenBucket>();

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

    let attempt = 0;
    for (;;) {
      await bucket.acquire();
      const token = await this.tokenClient.getAccessToken();
      const res = await this.fetchFn(url, {
        method: options.method,
        headers: {
          "x-amz-access-token": token,
          "content-type": "application/json",
          "user-agent": USER_AGENT,
        },
        body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      });

      if (res.status === 429 && attempt < maxRetries) {
        attempt += 1;
        await sleepFn(2 ** attempt * 100);
        continue;
      }
      if (!res.ok) {
        const text = await res.text();
        throw new SpApiError(
          `SP-API ${options.operation} failed: ${text}`,
          res.status,
          undefined,
          SpApiError.isRetryable(res.status),
        );
      }
      return (await res.json()) as T;
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/client.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/client.ts src/client.test.ts
git commit -m "feat: SP-API transport client with auth, rate limiting, and 429 retry"
```

---

## Task 8: Sellers operation wrapper

**Files:**
- Create: `src/operations/sellers.ts`
- Test: `src/operations/sellers.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/operations/sellers.test.ts
import { describe, it, expect, vi } from "vitest";
import { getMarketplaceParticipations } from "./sellers";
import type { SpApiClient } from "../client";

describe("getMarketplaceParticipations", () => {
  it("calls the marketplaceParticipations operation and returns the payload array", async () => {
    const request = vi.fn().mockResolvedValue({
      payload: [
        {
          marketplace: { id: "ATVPDKIKX0DER", name: "Amazon.com", countryCode: "US" },
          participation: { isParticipating: true, hasSuspendedListings: false },
        },
      ],
    });
    const client = { request } as unknown as SpApiClient;

    const result = await getMarketplaceParticipations(client);

    expect(result).toHaveLength(1);
    expect(result[0]!.marketplace.id).toBe("ATVPDKIKX0DER");
    const callArg = request.mock.calls[0]![0];
    expect(callArg.operation).toBe("getMarketplaceParticipations");
    expect(callArg.method).toBe("GET");
    expect(callArg.path).toBe("/sellers/v1/marketplaceParticipations");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/operations/sellers.test.ts`
Expected: FAIL with "Cannot find module './sellers'".

- [ ] **Step 3: Write minimal implementation**

```ts
// src/operations/sellers.ts
import type { SpApiClient } from "../client";

export interface MarketplaceParticipation {
  marketplace: {
    id: string;
    name: string;
    countryCode: string;
    defaultCurrencyCode?: string;
    defaultLanguageCode?: string;
    domainName?: string;
  };
  participation: {
    isParticipating: boolean;
    hasSuspendedListings: boolean;
  };
}

// Rate limits per SP-API docs for this operation: rate 0.016/s, burst 15.
const RATE_LIMIT = { rate: 0.016, burst: 15 };

export async function getMarketplaceParticipations(
  client: SpApiClient,
): Promise<MarketplaceParticipation[]> {
  const res = await client.request<{ payload: MarketplaceParticipation[] }>({
    operation: "getMarketplaceParticipations",
    method: "GET",
    path: "/sellers/v1/marketplaceParticipations",
    rateLimit: RATE_LIMIT,
  });
  return res.payload;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/operations/sellers.test.ts`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add src/operations/sellers.ts src/operations/sellers.test.ts
git commit -m "feat: getMarketplaceParticipations operation wrapper"
```

---

## Task 9: MCP tools and server wiring

**Files:**
- Create: `src/mcp/tools.ts`, `src/mcp/server.ts`, `src/index.ts`
- Test: `src/mcp/tools.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/mcp/tools.test.ts
import { describe, it, expect, vi } from "vitest";
import { connectionStatusTool, sellersGetMarketplacesTool } from "./tools";
import type { SpApiClient } from "../client";
import type { SpApiConfig } from "../config";

const config: SpApiConfig = {
  lwaClientId: "id",
  lwaClientSecret: "secret",
  refreshToken: "rt",
  region: "na",
  marketplaceIds: ["ATVPDKIKX0DER"],
  sandbox: true,
};

describe("connectionStatusTool", () => {
  it("returns the configured region, sandbox flag, and marketplaces as text", async () => {
    const result = await connectionStatusTool(config);
    const text = result.content[0]!.text;
    expect(text).toContain("\"region\": \"na\"");
    expect(text).toContain("\"sandbox\": true");
    expect(text).toContain("ATVPDKIKX0DER");
  });
});

describe("sellersGetMarketplacesTool", () => {
  it("serializes the marketplace participations from the client", async () => {
    const request = vi.fn().mockResolvedValue({
      payload: [
        {
          marketplace: { id: "ATVPDKIKX0DER", name: "Amazon.com", countryCode: "US" },
          participation: { isParticipating: true, hasSuspendedListings: false },
        },
      ],
    });
    const client = { request } as unknown as SpApiClient;

    const result = await sellersGetMarketplacesTool(client);
    expect(result.content[0]!.text).toContain("Amazon.com");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/mcp/tools.test.ts`
Expected: FAIL with "Cannot find module './tools'".

- [ ] **Step 3: Write the tool handlers**

```ts
// src/mcp/tools.ts
import type { SpApiClient } from "../client";
import type { SpApiConfig } from "../config";
import { getMarketplaceParticipations } from "../operations/sellers";

export interface ToolResult {
  content: { type: "text"; text: string }[];
}

function textResult(value: unknown): ToolResult {
  return { content: [{ type: "text", text: JSON.stringify(value, null, 2) }] };
}

export async function connectionStatusTool(config: SpApiConfig): Promise<ToolResult> {
  return textResult({
    region: config.region,
    sandbox: config.sandbox,
    marketplaceIds: config.marketplaceIds,
    note: "Credentials loaded from environment (Phase 0 single-tenant).",
  });
}

export async function sellersGetMarketplacesTool(client: SpApiClient): Promise<ToolResult> {
  const participations = await getMarketplaceParticipations(client);
  return textResult(participations);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/mcp/tools.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Write the server wiring (no test; covered by manual validation in Task 10)**

```ts
// src/mcp/server.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SpApiClient } from "../client";
import type { SpApiConfig } from "../config";
import { connectionStatusTool, sellersGetMarketplacesTool } from "./tools";

export function buildServer(client: SpApiClient, config: SpApiConfig): McpServer {
  const server = new McpServer({ name: "amazon-seller-mcp", version: "0.1.0" });

  server.tool(
    "connection_status",
    "Show which Amazon seller account context is configured (region, sandbox, marketplaces).",
    {},
    async () => connectionStatusTool(config),
  );

  server.tool(
    "sellers_get_marketplaces",
    "List the Amazon marketplaces this seller participates in.",
    {},
    async () => sellersGetMarketplacesTool(client),
  );

  return server;
}
```

```ts
// src/index.ts
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfig } from "./config";
import { resolveEndpoints } from "./endpoints";
import { LwaTokenClient } from "./auth/lwaTokenClient";
import { SpApiClient } from "./client";
import { buildServer } from "./mcp/server";

async function main(): Promise<void> {
  const config = loadConfig();
  const endpoints = resolveEndpoints(config.region, config.sandbox);
  const tokenClient = new LwaTokenClient(
    {
      lwaClientId: config.lwaClientId,
      lwaClientSecret: config.lwaClientSecret,
      refreshToken: config.refreshToken,
    },
    endpoints.lwaTokenUrl,
  );
  const client = new SpApiClient(endpoints, tokenClient);
  const server = buildServer(client, config);
  await server.connect(new StdioServerTransport());
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
```

Note: the `McpServer.tool(name, description, paramsShape, handler)` signature targets `@modelcontextprotocol/sdk` v1.x. If the installed SDK exposes a different registration API (for example `registerTool`), adapt the calls in `server.ts` and check the SDK's current docs; the tool handler functions in `tools.ts` stay unchanged.

- [ ] **Step 6: Typecheck the whole project**

Run: `npm run typecheck`
Expected: exits 0 with no type errors.

- [ ] **Step 7: Commit**

```bash
git add src/mcp/tools.ts src/mcp/tools.test.ts src/mcp/server.ts src/index.ts
git commit -m "feat: stdio MCP server with connection_status and sellers_get_marketplaces tools"
```

---

## Task 10: README and manual validation

**Files:**
- Create: `README.md`

- [ ] **Step 1: Write `README.md`**

````markdown
# amazon-seller-mcp

A Model Context Protocol (MCP) server over the Amazon Selling Partner API (SP-API).
Phase 0 is a local, single-tenant stdio server for one seller account, used to
prove the SP-API integration before the hosted multi-tenant work.

See the design spec: `docs/superpowers/specs/2026-06-16-amazon-spapi-mcp-server-design.md`

## Setup

1. `npm install`
2. Copy `.env.example` to `.env` and fill in your LWA credentials and refresh token
   (from self-authorizing a draft SP-API app against your seller account).
3. Keep `SPAPI_SANDBOX=true` until you have verified behavior against the sandbox.

## Commands

- `npm test` runs the unit test suite (no credentials needed; uses mocked fetch).
- `npm run typecheck` type-checks the project.
- `npm run dev` runs the stdio MCP server from source.
- `npm run build` bundles to `dist/`.

## Manual validation checklist

1. With `.env` populated and `SPAPI_SANDBOX=true`, run `npm run dev`.
2. Connect an MCP client to the stdio command `npm run dev` (or `node dist/index.js`
   after `npm run build`). For Claude Desktop, add an entry under `mcpServers`
   pointing `command` to `node` and `args` to the built `dist/index.js`, with the
   `.env` values supplied as `env`.
3. Call the `connection_status` tool. Expected: JSON echoing your region, sandbox
   flag, and marketplace IDs.
4. Call the `sellers_get_marketplaces` tool. Expected: a JSON array of marketplace
   participations from the sandbox.
5. Switch `SPAPI_SANDBOX=false` and repeat step 4 against your real seller account.
   Expected: your actual marketplace participation(s).
````

- [ ] **Step 2: Run the full test suite**

Run: `npm test`
Expected: PASS, all suites green (config, endpoints, errors, lwaTokenClient, rateLimiter, client, sellers, tools).

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: add README with setup and manual validation checklist"
```

---

## Self-review (completed by plan author)

- **Spec coverage (Phase 0 scope):** project scaffold (Task 1), config from env (Task 2), NA endpoint routing incl. sandbox (Task 3), typed errors (Task 4), LWA auth with refresh + caching + grantless (Task 5), token-bucket rate limiting (Task 6), signing-free transport with `x-amz-access-token` + 429 retry (Task 7), a non-PII operation wrapper (Task 8), the stdio MCP server with first tools (Task 9), and run/validation docs (Task 10). RDT minting and the remaining cheap-lane tools are intentionally deferred (PII is Phase 2; the other non-PII tools are the next plan, same pattern as Tasks 8 to 9).
- **Placeholder scan:** none. Every code step contains complete, runnable code and every command lists expected output.
- **Type consistency:** `SpApiConfig`, `Region`, `Endpoints`, `FetchLike`, `Clock`, `SleepLike`, `SpApiError`, `LwaTokenClient.getAccessToken`, `TokenBucket.acquire`, `SpApiClient.request<T>`, and `RequestOptions` are defined once and used with matching signatures across Tasks 2 to 9. `Clock`/`systemClock` are defined in `lwaTokenClient.ts` and imported by `rateLimiter.ts` and `client.ts` to avoid duplication.

## Known follow-ups (next plan, still Phase 0 / Phase 1 cheap lane)

- Generate TypeScript types from Amazon's OpenAPI models (`amzn/selling-partner-api-models`) for the remaining APIs.
- Add operation wrappers + tools for: Catalog Items, Listings Items (get/put/patch/delete), Product Type Definitions, FBA Inventory, Feeds (submit/poll/result), Product Pricing, Product Fees, Reports (the async request/poll/download pattern), Finances, Sales, and Notifications (subscribe/list/delete + `recent_alerts`).
- The async report pattern (request, poll status, download document) is the trickiest remaining shape and should be the first task of the next plan.
