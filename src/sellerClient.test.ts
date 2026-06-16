// src/sellerClient.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { randomBytes } from "node:crypto";
import { LocalEncryptor } from "./vault/localEncryptor";
import { InMemoryTokenVault } from "./vault/inMemoryVault";
import { SellerClientFactory, SpApiClient } from "./sellerClient";
import type { SellerConnection } from "./vault/types";
import type { Endpoints } from "./endpoints";

const TEST_ENDPOINTS: Endpoints = {
  spApiBaseUrl: "https://sandbox.sellingpartnerapi-na.amazon.com",
  lwaTokenUrl: "https://api.amazon.com/auth/o2/token",
};

const TEST_APP_CREDS = { clientId: "amzn1.app.test", clientSecret: "test-secret" };

function makeVault(): InMemoryTokenVault {
  return new InMemoryTokenVault(new LocalEncryptor(randomBytes(32).toString("base64")));
}

function makeConnection(mcpUserId: string): SellerConnection {
  return {
    mcpUserId,
    sellingPartnerId: "SELLER123",
    marketplaceIds: ["ATVPDKIKX0DER"],
    refreshToken: "Atzr|test-refresh-token",
    createdAt: 1000,
    updatedAt: 1000,
  };
}

describe("SellerClientFactory", () => {
  let vault: InMemoryTokenVault;
  let factory: SellerClientFactory;

  beforeEach(() => {
    vault = makeVault();
    factory = new SellerClientFactory(vault, TEST_ENDPOINTS, TEST_APP_CREDS);
  });

  it("returns a SpApiClient and the connection for a seeded user", async () => {
    const conn = makeConnection("user-1");
    await vault.storeConnection(conn);

    const { client, connection } = await factory.forUser("user-1");
    expect(client).toBeInstanceOf(SpApiClient);
    expect(connection.mcpUserId).toBe("user-1");
    expect(connection.refreshToken).toBe(conn.refreshToken);
  });

  it("caches: second call returns the same SpApiClient instance", async () => {
    await vault.storeConnection(makeConnection("user-2"));

    const first = await factory.forUser("user-2");
    const second = await factory.forUser("user-2");
    expect(first.client).toBe(second.client);
  });

  it("throws a clear error when the user has no connection", async () => {
    await expect(factory.forUser("no-such-user")).rejects.toThrow(
      "seller not connected; complete /connect first",
    );
  });

  it("throws with the mcpUserId in the error message", async () => {
    await expect(factory.forUser("ghost-user")).rejects.toThrow("ghost-user");
  });

  it("returns independent clients for different users", async () => {
    await vault.storeConnection(makeConnection("user-a"));
    await vault.storeConnection(makeConnection("user-b"));

    const a = await factory.forUser("user-a");
    const b = await factory.forUser("user-b");
    expect(a.client).not.toBe(b.client);
  });
});
