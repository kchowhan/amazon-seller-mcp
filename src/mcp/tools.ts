// src/mcp/tools.ts
import type { SpApiClient } from "../client";
import type { SpApiConfig } from "../config";
import { getMarketplaceParticipations } from "../operations/sellers";
import { searchCatalogItems, getCatalogItem } from "../operations/catalog";
import { SpApiError } from "../errors";

export interface ToolResult {
  // The MCP SDK's CallToolResult requires an index signature; this keeps ToolResult
  // structurally assignable to it without widening the meaningful fields.
  [key: string]: unknown;
  content: { type: "text"; text: string }[];
  isError?: boolean;
}

function textResult(value: unknown): ToolResult {
  return { content: [{ type: "text", text: JSON.stringify(value, null, 2) }] };
}

function errorResult(err: unknown): ToolResult {
  const message =
    err instanceof SpApiError
      ? `${err.message}${err.code ? ` (${err.code})` : ""}`
      : err instanceof Error
        ? err.message
        : String(err);
  return { content: [{ type: "text", text: `Error: ${message}` }], isError: true };
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
  try {
    const participations = await getMarketplaceParticipations(client);
    return textResult(participations);
  } catch (err) {
    return errorResult(err);
  }
}

export async function catalogSearchTool(
  client: SpApiClient,
  config: SpApiConfig,
  args: {
    keywords?: string[];
    identifiers?: string[];
    identifiersType?: string;
    marketplaceIds?: string[];
    includedData?: string[];
    pageSize?: number;
    pageToken?: string;
    brandNames?: string[];
    classificationIds?: string[];
  },
): Promise<ToolResult> {
  try {
    const result = await searchCatalogItems(client, {
      ...args,
      marketplaceIds: args.marketplaceIds ?? config.marketplaceIds,
    });
    return textResult(result);
  } catch (err) {
    return errorResult(err);
  }
}

export async function catalogGetItemTool(
  client: SpApiClient,
  config: SpApiConfig,
  args: {
    asin: string;
    marketplaceIds?: string[];
    includedData?: string[];
    locale?: string;
  },
): Promise<ToolResult> {
  try {
    const result = await getCatalogItem(client, {
      ...args,
      marketplaceIds: args.marketplaceIds ?? config.marketplaceIds,
    });
    return textResult(result);
  } catch (err) {
    return errorResult(err);
  }
}
