// src/mcp/tools/productTypes.ts
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SpApiClient } from "../../client";
import type { SpApiConfig } from "../../config";
import { getDefinitionsProductType } from "../../operations/productTypes";
import { textResult, errorResult, type ToolResult } from "../toolResult";

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

export function registerProductTypesTools(
  server: McpServer,
  client: SpApiClient,
  config: SpApiConfig,
): void {
  server.registerTool(
    "product_type_get_schema",
    {
      description:
        "Get the JSON schema for an Amazon product type (e.g. SHIRT, LUGGAGE). Used to understand what attributes are required/allowed when creating or updating listings. marketplaceIds defaults to configured marketplaces.",
      inputSchema: {
        productType: z
          .string()
          .describe("Amazon product type name (e.g. SHIRT, LUGGAGE, BACKPACK)"),
        marketplaceIds: z
          .array(z.string())
          .optional()
          .describe("Marketplace IDs (defaults to configured marketplaces)"),
        requirements: z
          .string()
          .optional()
          .describe(
            "Requirements type: LISTING, LISTING_PRODUCT_ONLY, or LISTING_OFFER_ONLY",
          ),
        locale: z.string().optional().describe("Locale for localized display labels (e.g. en_US)"),
      },
    },
    async (args) => productTypeGetSchemaTool(client, config, args),
  );
}
