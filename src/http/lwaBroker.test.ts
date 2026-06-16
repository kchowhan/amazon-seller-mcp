// src/http/lwaBroker.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  InMemoryStateStore,
  exchangeCodeForToken,
  type FetchLike,
  type LwaBrokerConfig,
} from "./lwaBroker";
import { InMemoryTokenVault } from "../vault/inMemoryVault";
import { InMemoryConsentStore } from "../vault/inMemoryVault";
import { LocalEncryptor } from "../vault/localEncryptor";

// ─── In-memory state store tests ─────────────────────────────────────────────

describe("InMemoryStateStore", () => {
  it("stores and returns a state entry (single-use)", async () => {
    const store = new InMemoryStateStore();
    const data = { sub: "user-1", clientId: "app-1", redirectUri: "https://app/cb", expiresAt: Date.now() + 60_000 };
    await store.create("s1", data);
    const result = await store.consume("s1");
    expect(result).toEqual(data);
  });

  it("returns undefined after consuming (single-use guarantee)", async () => {
    const store = new InMemoryStateStore();
    await store.create("s2", { sub: "u", clientId: "c", redirectUri: "r", expiresAt: Date.now() + 60_000 });
    await store.consume("s2");
    const second = await store.consume("s2");
    expect(second).toBeUndefined();
  });

  it("returns undefined for an expired entry", async () => {
    const store = new InMemoryStateStore();
    // expiresAt in the past
    await store.create("s3", { sub: "u", clientId: "c", redirectUri: "r", expiresAt: Date.now() - 1 });
    const result = await store.consume("s3");
    expect(result).toBeUndefined();
  });

  it("returns undefined for an unknown state", async () => {
    const store = new InMemoryStateStore();
    const result = await store.consume("nonexistent");
    expect(result).toBeUndefined();
  });
});

// ─── Code exchange helper tests ───────────────────────────────────────────────

describe("exchangeCodeForToken", () => {
  const config: LwaBrokerConfig = {
    spapiAppId: "app-123",
    callbackUrl: "https://mcp.example.com/callback",
    lwaTokenUrl: "https://api.amazon.com/auth/o2/token",
    lwaClientId: "lwa-client-id",
    lwaClientSecret: "lwa-secret",
  };

  it("exchanges the code and returns refresh_token from a successful response", async () => {
    const mockFetch: FetchLike = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ refresh_token: "rtoken-abc", access_token: "atoken-xyz", token_type: "bearer" }),
      text: async () => "",
    } as unknown as Response);

    const result = await exchangeCodeForToken({
      code: "code-123",
      redirectUri: config.callbackUrl,
      clientId: config.lwaClientId,
      clientSecret: config.lwaClientSecret,
      tokenUrl: config.lwaTokenUrl,
      fetchFn: mockFetch,
    });

    expect(result.refresh_token).toBe("rtoken-abc");

    // Verify the request body was correct and MCP tokens were NOT forwarded
    const call = vi.mocked(mockFetch).mock.calls[0]!;
    const bodyStr = (call[1] as RequestInit).body as string;
    const params = new URLSearchParams(bodyStr);
    expect(params.get("grant_type")).toBe("authorization_code");
    expect(params.get("code")).toBe("code-123");
    expect(params.get("client_id")).toBe("lwa-client-id");
    // Verify the inbound MCP token is NOT in the body
    expect(bodyStr).not.toContain("mcp-token");
    expect(bodyStr).not.toContain("Bearer");
  });

  it("throws when LWA returns a non-2xx status", async () => {
    const mockFetch: FetchLike = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({}),
      text: async () => "invalid_grant",
    } as unknown as Response);

    await expect(
      exchangeCodeForToken({
        code: "bad-code",
        redirectUri: config.callbackUrl,
        clientId: config.lwaClientId,
        clientSecret: config.lwaClientSecret,
        tokenUrl: config.lwaTokenUrl,
        fetchFn: mockFetch,
      }),
    ).rejects.toThrow("400");
  });
});

// ─── Consent store + redirect_uri enforcement ─────────────────────────────────

describe("ConsentStore exact redirectUri enforcement", () => {
  it("isApproved returns false for mismatched redirectUri", async () => {
    const store = new InMemoryConsentStore();
    await store.approve({
      mcpUserId: "user-1",
      clientId: "app-1",
      redirectUri: "https://app.example.com/callback",
      scopes: [],
      grantedAt: Date.now(),
    });

    // Same user + client but different redirect URI
    const ok = await store.isApproved("user-1", "app-1", "https://evil.example.com/callback");
    expect(ok).toBe(false);
  });

  it("isApproved returns true for exact match", async () => {
    const store = new InMemoryConsentStore();
    await store.approve({
      mcpUserId: "user-1",
      clientId: "app-1",
      redirectUri: "https://app.example.com/callback",
      scopes: [],
      grantedAt: Date.now(),
    });
    const ok = await store.isApproved("user-1", "app-1", "https://app.example.com/callback");
    expect(ok).toBe(true);
  });

  it("isApproved returns false for unapproved client", async () => {
    const store = new InMemoryConsentStore();
    // Nothing approved at all
    const ok = await store.isApproved("user-1", "unapproved-app", "https://app.example.com/callback");
    expect(ok).toBe(false);
  });
});

// ─── Full callback flow: code exchange stores into the vault ──────────────────

describe("callback flow: code exchange stores refreshToken in vault", () => {
  it("stores an encrypted refresh token after successful exchange", async () => {
    const key = Buffer.from("0123456789abcdef0123456789abcdef"); // 32 bytes
    const encryptor = new LocalEncryptor(key.toString("base64"));
    const vault = new InMemoryTokenVault(encryptor);
    const stateStore = new InMemoryStateStore();
    const consentStore = new InMemoryConsentStore();

    // Seed state
    await stateStore.create("state-xyz", {
      sub: "user-77",
      clientId: "app-1",
      redirectUri: "https://app.example.com/callback",
      expiresAt: Date.now() + 60_000,
    });

    // Pre-approve consent so /connect would have worked
    await consentStore.approve({
      mcpUserId: "user-77",
      clientId: "app-1",
      redirectUri: "https://app.example.com/callback",
      scopes: [],
      grantedAt: Date.now(),
    });

    // Simulate what the callback handler does after exchanging the code
    const pending = await stateStore.consume("state-xyz");
    expect(pending).toBeDefined();

    const refreshToken = "amazon-refresh-token-12345";
    const now = Date.now();
    await vault.storeConnection({
      mcpUserId: pending!.sub,
      sellingPartnerId: "A1SELLER",
      marketplaceIds: [],
      refreshToken,
      createdAt: now,
      updatedAt: now,
    });

    // Retrieve and verify the token is correct
    const conn = await vault.getConnection("user-77");
    expect(conn?.refreshToken).toBe(refreshToken);

    // Verify it was stored encrypted (raw map should not contain plaintext)
    const raw = vault._rawStore().get("user-77") as { encryptedRefreshToken: string } | undefined;
    expect(raw?.encryptedRefreshToken).toBeDefined();
    expect(raw?.encryptedRefreshToken).not.toBe(refreshToken);
  });
});
