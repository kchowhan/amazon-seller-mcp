// src/mcp/tools.ts
import type { SpApiClient } from "../client";
import type { SpApiConfig } from "../config";
import { getMarketplaceParticipations } from "../operations/sellers";
import { searchCatalogItems, getCatalogItem } from "../operations/catalog";
import {
  getListingsItem,
  putListingsItem,
  patchListingsItem,
  deleteListingsItem,
  type PutListingsItemBody,
  type PatchListingsItemBody,
} from "../operations/listings";
import { getDefinitionsProductType } from "../operations/productTypes";
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

const SELLER_ID_ERROR =
  "sellerId is required: set SPAPI_SELLER_ID or pass sellerId as a tool argument";

function resolveSellerOrError(
  argSellerId: string | undefined,
  configSellerId: string | undefined,
): { ok: true; sellerId: string } | { ok: false; result: ToolResult } {
  const sellerId = argSellerId ?? configSellerId;
  if (!sellerId) return { ok: false, result: errorResult(new Error(SELLER_ID_ERROR)) };
  return { ok: true, sellerId };
}

export async function listingGetTool(
  client: SpApiClient,
  config: SpApiConfig,
  args: {
    sku: string;
    sellerId?: string;
    marketplaceIds?: string[];
    includedData?: string[];
    issueLocale?: string;
  },
): Promise<ToolResult> {
  const resolved = resolveSellerOrError(args.sellerId, config.sellerId);
  if (!resolved.ok) return resolved.result;
  try {
    const result = await getListingsItem(client, {
      sellerId: resolved.sellerId,
      sku: args.sku,
      marketplaceIds: args.marketplaceIds ?? config.marketplaceIds,
      includedData: args.includedData,
      issueLocale: args.issueLocale,
    });
    return textResult(result);
  } catch (err) {
    return errorResult(err);
  }
}

export async function listingPutTool(
  client: SpApiClient,
  config: SpApiConfig,
  args: {
    sku: string;
    body: PutListingsItemBody;
    sellerId?: string;
    marketplaceIds?: string[];
    includedData?: string[];
    mode?: string;
    issueLocale?: string;
  },
): Promise<ToolResult> {
  const resolved = resolveSellerOrError(args.sellerId, config.sellerId);
  if (!resolved.ok) return resolved.result;
  try {
    const result = await putListingsItem(client, {
      sellerId: resolved.sellerId,
      sku: args.sku,
      marketplaceIds: args.marketplaceIds ?? config.marketplaceIds,
      body: args.body,
      includedData: args.includedData,
      mode: args.mode,
      issueLocale: args.issueLocale,
    });
    return textResult(result);
  } catch (err) {
    return errorResult(err);
  }
}

export async function listingPatchTool(
  client: SpApiClient,
  config: SpApiConfig,
  args: {
    sku: string;
    body: PatchListingsItemBody;
    sellerId?: string;
    marketplaceIds?: string[];
    includedData?: string[];
    mode?: string;
    issueLocale?: string;
  },
): Promise<ToolResult> {
  const resolved = resolveSellerOrError(args.sellerId, config.sellerId);
  if (!resolved.ok) return resolved.result;
  try {
    const result = await patchListingsItem(client, {
      sellerId: resolved.sellerId,
      sku: args.sku,
      marketplaceIds: args.marketplaceIds ?? config.marketplaceIds,
      body: args.body,
      includedData: args.includedData,
      mode: args.mode,
      issueLocale: args.issueLocale,
    });
    return textResult(result);
  } catch (err) {
    return errorResult(err);
  }
}

export async function listingDeleteTool(
  client: SpApiClient,
  config: SpApiConfig,
  args: {
    sku: string;
    sellerId?: string;
    marketplaceIds?: string[];
    issueLocale?: string;
  },
): Promise<ToolResult> {
  const resolved = resolveSellerOrError(args.sellerId, config.sellerId);
  if (!resolved.ok) return resolved.result;
  try {
    const result = await deleteListingsItem(client, {
      sellerId: resolved.sellerId,
      sku: args.sku,
      marketplaceIds: args.marketplaceIds ?? config.marketplaceIds,
      issueLocale: args.issueLocale,
    });
    return textResult(result);
  } catch (err) {
    return errorResult(err);
  }
}

export async function productTypeGetSchemaTool(
  client: SpApiClient,
  config: SpApiConfig,
  args: {
    productType: string;
    marketplaceIds?: string[];
    requirements?: string;
    locale?: string;
  },
): Promise<ToolResult> {
  try {
    const result = await getDefinitionsProductType(client, {
      productType: args.productType,
      marketplaceIds: args.marketplaceIds ?? config.marketplaceIds,
      requirements: args.requirements,
      locale: args.locale,
    });
    return textResult(result);
  } catch (err) {
    return errorResult(err);
  }
}
