// src/mcp/tools/catalog.ts
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SpApiClient } from "../../client";
import type { SpApiConfig } from "../../config";
import { searchCatalogItems, getCatalogItem } from "../../operations/catalog";
import { textResult, errorResult, type ToolResult } from "../toolResult";

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

export function registerCatalogTools(
  server: McpServer,
  client: SpApiClient,
  config: SpApiConfig,
): void {
  server.registerTool(
    "catalog_search",
    {
      description:
        "Search the Amazon catalog for items by keyword or identifier. Returns item metadata. marketplaceIds defaults to the configured marketplaces.",
      inputSchema: {
        keywords: z.array(z.string()).optional().describe("Search keywords"),
        identifiers: z
          .array(z.string())
          .optional()
          .describe("Product identifiers (ASIN, UPC, EAN, etc.)"),
        identifiersType: z
          .string()
          .optional()
          .describe("Type of identifiers: ASIN, EAN, GTIN, ISBN, JAN, MINSAN, SKU, UPC"),
        marketplaceIds: z
          .array(z.string())
          .optional()
          .describe("Marketplace IDs (defaults to configured marketplaces)"),
        includedData: z
          .array(z.string())
          .optional()
          .describe("Data sets to include: summaries, images, attributes, etc."),
        brandNames: z.array(z.string()).optional().describe("Filter by brand names"),
        classificationIds: z
          .array(z.string())
          .optional()
          .describe("Filter by classification IDs"),
        pageSize: z.number().int().optional().describe("Number of results per page (max 20)"),
        pageToken: z.string().optional().describe("Token for pagination"),
      },
    },
    async (args) => catalogSearchTool(client, config, args),
  );

  server.registerTool(
    "catalog_get_item",
    {
      description:
        "Get detailed catalog information for a specific Amazon item by ASIN. marketplaceIds defaults to the configured marketplaces.",
      inputSchema: {
        asin: z.string().describe("The Amazon Standard Identification Number (ASIN)"),
        marketplaceIds: z
          .array(z.string())
          .optional()
          .describe("Marketplace IDs (defaults to configured marketplaces)"),
        includedData: z
          .array(z.string())
          .optional()
          .describe("Data sets to include: summaries, images, attributes, productTypes, etc."),
        locale: z.string().optional().describe("Locale for localized attributes (e.g. en_US)"),
      },
    },
    async (args) => catalogGetItemTool(client, config, args),
  );
}
