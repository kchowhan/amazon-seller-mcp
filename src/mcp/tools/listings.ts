// src/mcp/tools/listings.ts
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SpApiClient } from "../../client";
import type { SpApiConfig } from "../../config";
import {
  getListingsItem,
  putListingsItem,
  patchListingsItem,
  deleteListingsItem,
  type PutListingsItemBody,
  type PatchListingsItemBody,
} from "../../operations/listings";
import { textResult, errorResult, resolveSellerOrError, type ToolResult } from "../toolResult";

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

export function registerListingsTools(
  server: McpServer,
  client: SpApiClient,
  config: SpApiConfig,
): void {
  const listingCommonInputs = {
    sku: z.string().describe("Seller SKU for the listing"),
    sellerId: z
      .string()
      .optional()
      .describe("Seller ID (defaults to SPAPI_SELLER_ID; required if not configured)"),
    marketplaceIds: z
      .array(z.string())
      .optional()
      .describe("Marketplace IDs (defaults to configured marketplaces)"),
    issueLocale: z.string().optional().describe("Locale for issue messages (e.g. en_US)"),
  };

  server.registerTool(
    "listing_get",
    {
      description:
        "Get a listings item for a seller by SKU. sellerId defaults to SPAPI_SELLER_ID.",
      inputSchema: {
        ...listingCommonInputs,
        includedData: z
          .array(z.string())
          .optional()
          .describe("Data sets to include: summaries, attributes, issues, offers, etc."),
      },
    },
    async (args) => listingGetTool(client, config, args),
  );

  server.registerTool(
    "listing_put",
    {
      description:
        "Create or fully replace a listings item for a seller by SKU. sellerId defaults to SPAPI_SELLER_ID.",
      inputSchema: {
        ...listingCommonInputs,
        body: z
          .object({
            productType: z.string().describe("Amazon product type (e.g. SHIRT)"),
            requirements: z.string().optional().describe("Requirements type (e.g. LISTING)"),
            attributes: z.record(z.unknown()).describe("Product attributes per product type schema"),
          })
          .describe("Listing item body"),
        includedData: z.array(z.string()).optional().describe("Data sets to include in response"),
        mode: z.string().optional().describe("Validation mode (e.g. VALIDATION_PREVIEW)"),
      },
    },
    async (args) => listingPutTool(client, config, args),
  );

  server.registerTool(
    "listing_patch",
    {
      description:
        "Partially update a listings item for a seller by SKU. sellerId defaults to SPAPI_SELLER_ID.",
      inputSchema: {
        ...listingCommonInputs,
        body: z
          .object({
            productType: z.string().describe("Amazon product type (e.g. SHIRT)"),
            patches: z
              .array(
                z.object({
                  op: z.string().describe("JSON Patch operation: add, replace, or delete"),
                  path: z.string().describe("JSON Pointer path to the attribute"),
                  value: z.unknown().optional().describe("Value for add/replace operations"),
                }),
              )
              .describe("Array of JSON Patch operations"),
          })
          .describe("Patch body"),
        includedData: z.array(z.string()).optional().describe("Data sets to include in response"),
        mode: z.string().optional().describe("Validation mode (e.g. VALIDATION_PREVIEW)"),
      },
    },
    async (args) => listingPatchTool(client, config, args),
  );

  server.registerTool(
    "listing_delete",
    {
      description:
        "Delete a listings item for a seller by SKU. sellerId defaults to SPAPI_SELLER_ID.",
      inputSchema: listingCommonInputs,
    },
    async (args) => listingDeleteTool(client, config, args),
  );
}
