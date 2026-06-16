// src/vault/types.ts

export interface SellerConnection {
  mcpUserId: string;          // stable identity from Leg 1 (the OAuth `sub`)
  sellingPartnerId?: string;
  marketplaceIds: string[];
  refreshToken: string;       // plaintext in memory; encrypted at rest by the vault impl
  grantedRoles?: string[];
  createdAt: number;
  updatedAt: number;
}

export interface TokenVault {
  getConnection(mcpUserId: string): Promise<SellerConnection | undefined>;
  storeConnection(conn: SellerConnection): Promise<void>;
  revokeConnection(mcpUserId: string): Promise<void>;
  listConnections(): Promise<SellerConnection[]>;
}

export interface Encryptor {
  encrypt(plaintext: string): Promise<string>;  // opaque base64 blob
  decrypt(ciphertext: string): Promise<string>;
}

export interface ConsentRecord {
  mcpUserId: string;
  clientId: string;
  redirectUri: string;
  scopes: string[];
  grantedAt: number;
}

export interface ConsentStore {
  isApproved(mcpUserId: string, clientId: string, redirectUri: string): Promise<boolean>;
  approve(record: ConsentRecord): Promise<void>;
}
