// src/vault/inMemoryVault.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { randomBytes } from "node:crypto";
import { LocalEncryptor } from "./localEncryptor";
import { InMemoryTokenVault, InMemoryConsentStore } from "./inMemoryVault";
import type { SellerConnection, ConsentRecord } from "./types";

function makeEncryptor(): LocalEncryptor {
  return new LocalEncryptor(randomBytes(32).toString("base64"));
}

function makeConn(overrides: Partial<SellerConnection> = {}): SellerConnection {
  return {
    mcpUserId: "user-1",
    sellingPartnerId: "SP123",
    marketplaceIds: ["ATVPDKIKX0DER"],
    refreshToken: "Atzr|plaintext-refresh-token",
    createdAt: 1000,
    updatedAt: 1000,
    ...overrides,
  };
}

describe("InMemoryTokenVault", () => {
  let vault: InMemoryTokenVault;

  beforeEach(() => {
    vault = new InMemoryTokenVault(makeEncryptor());
  });

  it("round-trips a connection and returns plaintext refreshToken", async () => {
    const conn = makeConn();
    await vault.storeConnection(conn);
    const retrieved = await vault.getConnection(conn.mcpUserId);
    expect(retrieved).toBeDefined();
    expect(retrieved!.refreshToken).toBe(conn.refreshToken);
    expect(retrieved!.mcpUserId).toBe(conn.mcpUserId);
    expect(retrieved!.marketplaceIds).toEqual(conn.marketplaceIds);
  });

  it("stores the refreshToken encrypted (raw map value is not the plaintext)", async () => {
    const conn = makeConn();
    await vault.storeConnection(conn);
    const raw = vault._rawStore().get(conn.mcpUserId);
    expect(raw).toBeDefined();
    expect(raw!.encryptedRefreshToken).not.toBe(conn.refreshToken);
    // The raw stored record should NOT contain the plaintext refreshToken key
    expect((raw as unknown as Record<string, unknown>)["refreshToken"]).toBeUndefined();
  });

  it("returns undefined for an unknown user", async () => {
    const result = await vault.getConnection("unknown-user");
    expect(result).toBeUndefined();
  });

  it("revoke removes the connection", async () => {
    const conn = makeConn();
    await vault.storeConnection(conn);
    await vault.revokeConnection(conn.mcpUserId);
    const result = await vault.getConnection(conn.mcpUserId);
    expect(result).toBeUndefined();
  });

  it("listConnections returns all stored connections with plaintext tokens", async () => {
    const conn1 = makeConn({ mcpUserId: "user-1", refreshToken: "token-1" });
    const conn2 = makeConn({ mcpUserId: "user-2", refreshToken: "token-2" });
    await vault.storeConnection(conn1);
    await vault.storeConnection(conn2);
    const list = await vault.listConnections();
    expect(list).toHaveLength(2);
    const found1 = list.find((c) => c.mcpUserId === "user-1");
    const found2 = list.find((c) => c.mcpUserId === "user-2");
    expect(found1!.refreshToken).toBe("token-1");
    expect(found2!.refreshToken).toBe("token-2");
  });

  it("overwrites an existing connection on re-store", async () => {
    const conn = makeConn({ refreshToken: "old-token" });
    await vault.storeConnection(conn);
    await vault.storeConnection({ ...conn, refreshToken: "new-token", updatedAt: 2000 });
    const retrieved = await vault.getConnection(conn.mcpUserId);
    expect(retrieved!.refreshToken).toBe("new-token");
    expect(retrieved!.updatedAt).toBe(2000);
  });
});

describe("InMemoryConsentStore", () => {
  let store: InMemoryConsentStore;

  beforeEach(() => {
    store = new InMemoryConsentStore();
  });

  it("isApproved returns false before approve", async () => {
    const result = await store.isApproved("user-1", "client-abc", "https://example.com/cb");
    expect(result).toBe(false);
  });

  it("approve then isApproved returns true", async () => {
    const record: ConsentRecord = {
      mcpUserId: "user-1",
      clientId: "client-abc",
      redirectUri: "https://example.com/cb",
      scopes: ["read:orders"],
      grantedAt: Date.now(),
    };
    await store.approve(record);
    const result = await store.isApproved(
      record.mcpUserId,
      record.clientId,
      record.redirectUri,
    );
    expect(result).toBe(true);
  });

  it("does not approve a different redirectUri", async () => {
    const record: ConsentRecord = {
      mcpUserId: "user-1",
      clientId: "client-abc",
      redirectUri: "https://example.com/cb",
      scopes: [],
      grantedAt: Date.now(),
    };
    await store.approve(record);
    const result = await store.isApproved(
      record.mcpUserId,
      record.clientId,
      "https://evil.com/cb",
    );
    expect(result).toBe(false);
  });

  it("does not approve a different clientId", async () => {
    const record: ConsentRecord = {
      mcpUserId: "user-1",
      clientId: "client-abc",
      redirectUri: "https://example.com/cb",
      scopes: [],
      grantedAt: Date.now(),
    };
    await store.approve(record);
    const result = await store.isApproved(
      record.mcpUserId,
      "client-OTHER",
      record.redirectUri,
    );
    expect(result).toBe(false);
  });
});
