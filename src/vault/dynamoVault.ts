// src/vault/dynamoVault.ts
//
// DynamoDB-backed token vault.
//
// Table schema:
//   PK (String, partition key): mcpUserId
//   Attributes:
//     encryptedRefreshToken (String)          — refreshToken encrypted via injected Encryptor
//     sellingPartnerId      (String, optional)
//     marketplaceIds        (L — List of String) — stored as DynamoDB List, NOT StringSet (SS).
//                                                  List is used deliberately: StringSet cannot
//                                                  be empty, but a freshly-connected seller may
//                                                  have zero marketplace IDs until populated.
//     grantedRoles          (L — List of String, optional) — same reason as marketplaceIds.
//     createdAt             (Number)
//     updatedAt             (Number)
//
// Required IAM on the caller role:
//   dynamodb:GetItem       — getConnection
//   dynamodb:PutItem       — storeConnection
//   dynamodb:DeleteItem    — revokeConnection
//   dynamodb:Scan          — listConnections  (consider using GSI + Query in production)
//
import {
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
  DeleteItemCommand,
  ScanCommand,
} from "@aws-sdk/client-dynamodb";
import type { TokenVault, SellerConnection, Encryptor } from "./types";

function ssListAttr(values: string[]): { L: { S: string }[] } {
  return { L: values.map((v) => ({ S: v })) };
}

function fromSsListAttr(attr: { L?: { S?: string }[] } | undefined): string[] {
  return attr?.L?.map((v) => v.S ?? "") ?? [];
}

/**
 * DynamoDB-backed TokenVault. Encrypts the refreshToken at rest via
 * an injected Encryptor before writing to the table.
 */
export class DynamoTokenVault implements TokenVault {
  private readonly dynamo: DynamoDBClient;

  constructor(
    private readonly tableName: string,
    private readonly encryptor: Encryptor,
    dynamoClient?: DynamoDBClient,
  ) {
    this.dynamo = dynamoClient ?? new DynamoDBClient({});
  }

  async storeConnection(conn: SellerConnection): Promise<void> {
    const encryptedRefreshToken = await this.encryptor.encrypt(conn.refreshToken);
    // Build a DynamoDB AttributeValue item map.
    // Using Record<string, AttributeValue> from @aws-sdk/client-dynamodb types.
    // We satisfy the PutItemCommand input type via a cast through unknown.
    const item: Record<string, { S?: string; N?: string; L?: { S?: string }[] }> = {
      mcpUserId: { S: conn.mcpUserId },
      encryptedRefreshToken: { S: encryptedRefreshToken },
      marketplaceIds: ssListAttr(conn.marketplaceIds),
      createdAt: { N: String(conn.createdAt) },
      updatedAt: { N: String(conn.updatedAt) },
    };
    if (conn.sellingPartnerId !== undefined) {
      item["sellingPartnerId"] = { S: conn.sellingPartnerId };
    }
    if (conn.grantedRoles !== undefined) {
      item["grantedRoles"] = ssListAttr(conn.grantedRoles);
    }
    await this.dynamo.send(
      new PutItemCommand({
        TableName: this.tableName,
        Item: item as unknown as Record<string, import("@aws-sdk/client-dynamodb").AttributeValue>,
      }),
    );
  }

  async getConnection(mcpUserId: string): Promise<SellerConnection | undefined> {
    const result = await this.dynamo.send(
      new GetItemCommand({
        TableName: this.tableName,
        Key: { mcpUserId: { S: mcpUserId } },
      }),
    );
    const item = result.Item;
    if (!item) return undefined;

    const encryptedRefreshToken = item["encryptedRefreshToken"]?.S;
    if (!encryptedRefreshToken) {
      throw new Error(`DynamoTokenVault: missing encryptedRefreshToken for ${mcpUserId}`);
    }
    const refreshToken = await this.encryptor.decrypt(encryptedRefreshToken);

    return {
      mcpUserId,
      refreshToken,
      sellingPartnerId: item["sellingPartnerId"]?.S,
      marketplaceIds: fromSsListAttr(
        item["marketplaceIds"] as { L?: { S?: string }[] } | undefined,
      ),
      grantedRoles: item["grantedRoles"]
        ? fromSsListAttr(item["grantedRoles"] as { L?: { S?: string }[] } | undefined)
        : undefined,
      createdAt: Number(item["createdAt"]?.N ?? 0),
      updatedAt: Number(item["updatedAt"]?.N ?? 0),
    };
  }

  async revokeConnection(mcpUserId: string): Promise<void> {
    await this.dynamo.send(
      new DeleteItemCommand({
        TableName: this.tableName,
        Key: { mcpUserId: { S: mcpUserId } },
      }),
    );
  }

  async listConnections(): Promise<SellerConnection[]> {
    // Production note: Scan reads the full table; use a GSI + Query for large datasets.
    const result = await this.dynamo.send(
      new ScanCommand({ TableName: this.tableName }),
    );
    const items = result.Items ?? [];
    const connections: SellerConnection[] = [];
    for (const item of items) {
      const mcpUserId = item["mcpUserId"]?.S;
      const encryptedRefreshToken = item["encryptedRefreshToken"]?.S;
      if (!mcpUserId || !encryptedRefreshToken) continue;
      const refreshToken = await this.encryptor.decrypt(encryptedRefreshToken);
      connections.push({
        mcpUserId,
        refreshToken,
        sellingPartnerId: item["sellingPartnerId"]?.S,
        marketplaceIds: fromSsListAttr(
          item["marketplaceIds"] as { L?: { S?: string }[] } | undefined,
        ),
        grantedRoles: item["grantedRoles"]
          ? fromSsListAttr(item["grantedRoles"] as { L?: { S?: string }[] } | undefined)
          : undefined,
        createdAt: Number(item["createdAt"]?.N ?? 0),
        updatedAt: Number(item["updatedAt"]?.N ?? 0),
      });
    }
    return connections;
  }
}
