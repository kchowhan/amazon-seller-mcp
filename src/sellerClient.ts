// src/sellerClient.ts
import type { TokenVault, SellerConnection } from "./vault/types";
import type { Endpoints } from "./endpoints";
import { LwaTokenClient } from "./auth/lwaTokenClient";
import { SpApiClient } from "./client";

export { SpApiClient };

/**
 * Builds and caches one SpApiClient per mcpUserId.
 * The refreshToken is sourced from the vault; the LWA app credentials come from
 * the server config (not the per-user connection).
 */
export class SellerClientFactory {
  private readonly cache = new Map<string, { client: SpApiClient; connection: SellerConnection }>();

  constructor(
    private readonly vault: TokenVault,
    private readonly endpoints: Endpoints,
    private readonly appCreds: { clientId: string; clientSecret: string },
  ) {}

  /**
   * Removes the cached client entry for `mcpUserId` so the next `forUser` call
   * re-reads the vault (picks up a new refresh token after re-authorization).
   */
  invalidate(mcpUserId: string): void {
    this.cache.delete(mcpUserId);
  }

  async forUser(mcpUserId: string): Promise<{ client: SpApiClient; connection: SellerConnection }> {
    const cached = this.cache.get(mcpUserId);
    if (cached) return cached;

    const connection = await this.vault.getConnection(mcpUserId);
    if (!connection) {
      throw new Error(
        `seller not connected; complete /connect first (mcpUserId=${mcpUserId})`,
      );
    }

    const tokenClient = new LwaTokenClient(
      {
        lwaClientId: this.appCreds.clientId,
        lwaClientSecret: this.appCreds.clientSecret,
        refreshToken: connection.refreshToken,
      },
      this.endpoints.lwaTokenUrl,
    );

    const client = new SpApiClient(this.endpoints, tokenClient);
    const entry = { client, connection };
    this.cache.set(mcpUserId, entry);
    return entry;
  }
}
