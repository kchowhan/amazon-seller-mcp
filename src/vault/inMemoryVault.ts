// src/vault/inMemoryVault.ts
import type { SellerConnection, TokenVault, Encryptor, ConsentRecord, ConsentStore } from "./types";

/** Stored shape: refreshToken is the encrypted blob; all other fields are plaintext. */
interface StoredConnection extends Omit<SellerConnection, "refreshToken"> {
  encryptedRefreshToken: string;
}

/**
 * In-memory token vault. The `refreshToken` field is encrypted at rest via the
 * injected Encryptor and never stored as plaintext in the internal Map.
 */
export class InMemoryTokenVault implements TokenVault {
  private readonly store = new Map<string, StoredConnection>();

  constructor(private readonly encryptor: Encryptor) {}

  async storeConnection(conn: SellerConnection): Promise<void> {
    const encryptedRefreshToken = await this.encryptor.encrypt(conn.refreshToken);
    const { refreshToken: _discarded, ...rest } = conn;
    this.store.set(conn.mcpUserId, { ...rest, encryptedRefreshToken });
  }

  async getConnection(mcpUserId: string): Promise<SellerConnection | undefined> {
    const stored = this.store.get(mcpUserId);
    if (!stored) return undefined;
    const { encryptedRefreshToken, ...rest } = stored;
    const refreshToken = await this.encryptor.decrypt(encryptedRefreshToken);
    return { ...rest, refreshToken };
  }

  async revokeConnection(mcpUserId: string): Promise<void> {
    this.store.delete(mcpUserId);
  }

  async listConnections(): Promise<SellerConnection[]> {
    const results: SellerConnection[] = [];
    for (const stored of this.store.values()) {
      const { encryptedRefreshToken, ...rest } = stored;
      const refreshToken = await this.encryptor.decrypt(encryptedRefreshToken);
      results.push({ ...rest, refreshToken });
    }
    return results;
  }

  /**
   * Exposed for tests only: access the raw internal map to verify the
   * stored value is not the plaintext token.
   * @internal
   */
  _rawStore(): ReadonlyMap<string, StoredConnection> {
    return this.store;
  }
}

/**
 * In-memory consent store. Key = `mcpUserId|clientId|redirectUri`.
 */
export class InMemoryConsentStore implements ConsentStore {
  private readonly store = new Map<string, ConsentRecord>();

  private key(mcpUserId: string, clientId: string, redirectUri: string): string {
    return `${mcpUserId}|${clientId}|${redirectUri}`;
  }

  async approve(record: ConsentRecord): Promise<void> {
    this.store.set(this.key(record.mcpUserId, record.clientId, record.redirectUri), record);
  }

  async isApproved(mcpUserId: string, clientId: string, redirectUri: string): Promise<boolean> {
    return this.store.has(this.key(mcpUserId, clientId, redirectUri));
  }
}
