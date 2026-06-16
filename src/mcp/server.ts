// src/mcp/server.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { SpApiClient } from "../client";
import type { SpApiConfig } from "../config";
import {
  connectionStatusTool,
  sellersGetMarketplacesTool,
  catalogSearchTool,
  catalogGetItemTool,
} from "./tools";

export function buildServer(client: SpApiClient, config: SpApiConfig): McpServer {
  const server = new McpServer({ name: "amazon-seller-mcp", version: "0.1.0" });

  server.registerTool(
    "connection_status",
    {
      description:
        "Show which Amazon seller account context is configured (region, sandbox, marketplaces).",
    },
    async () => connectionStatusTool(config),
  );

  server.registerTool(
    "sellers_get_marketplaces",
    {
      description: "List the Amazon marketplaces this seller participates in.",
    },
    async () => sellersGetMarketplacesTool(client),
  );

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

  return server;
}
