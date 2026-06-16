// src/mcp/tools/pricing.ts
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SpApiClient } from "../../client";
import type { SpApiConfig } from "../../config";
import { getCompetitivePricing, getItemOffers } from "../../operations/pricing";
import { textResult, errorResult, type ToolResult } from "../toolResult";

export async function pricingGetCompetitiveTool(
  client: SpApiClient,
  config: SpApiConfig,
  args: {
    asins?: string[];
    skus?: string[];
    marketplaceId?: string;
  },
): Promise<ToolResult> {
  if (args.asins?.length && args.skus?.length) {
    return errorResult(new Error("provide either asins or skus, not both"));
  }
  if (!args.asins?.length && !args.skus?.length) {
    return errorResult(new Error("provide asins or skus"));
  }
  try {
    const result = await getCompetitivePricing(client, {
      MarketplaceId: args.marketplaceId ?? config.marketplaceIds[0]!,
      Asins: args.asins,
      Skus: args.skus,
      ItemType: args.skus && args.skus.length > 0 ? "Sku" : "Asin",
    });
    return textResult(result);
  } catch (err) {
    return errorResult(err);
  }
}

export async function pricingGetItemOffersTool(
  client: SpApiClient,
  config: SpApiConfig,
  args: {
    asin: string;
    itemCondition?: string;
    marketplaceId?: string;
    customerType?: string;
  },
): Promise<ToolResult> {
  try {
    const result = await getItemOffers(client, {
      Asin: args.asin,
      MarketplaceId: args.marketplaceId ?? config.marketplaceIds[0]!,
      ItemCondition: args.itemCondition ?? "New",
      CustomerType: args.customerType,
    });
    return textResult(result);
  } catch (err) {
    return errorResult(err);
  }
}

export function registerPricingTools(
  server: McpServer,
  client: SpApiClient,
  config: SpApiConfig,
): void {
  server.registerTool(
    "pricing_get_competitive",
    {
      description:
        "Get competitive pricing for items by ASIN or SKU. Provide either asins or skus (not both). marketplaceId defaults to the first configured marketplace.",
      inputSchema: {
        asins: z
          .array(z.string())
          .optional()
          .describe("List of ASINs to get competitive pricing for (up to 20)"),
        skus: z
          .array(z.string())
          .optional()
          .describe("List of seller SKUs to get competitive pricing for (up to 20)"),
        marketplaceId: z
          .string()
          .optional()
          .describe("Marketplace ID (defaults to first configured marketplace)"),
      },
    },
    async (args) => pricingGetCompetitiveTool(client, config, args),
  );

  server.registerTool(
    "pricing_get_item_offers",
    {
      description:
        "Get the lowest priced offers for an item by ASIN. marketplaceId defaults to the first configured marketplace.",
      inputSchema: {
        asin: z.string().describe("The ASIN to get offers for"),
        itemCondition: z
          .string()
          .optional()
          .describe("Item condition: New, Used, Collectible, Refurbished, Club (default New)"),
        marketplaceId: z
          .string()
          .optional()
          .describe("Marketplace ID (defaults to first configured marketplace)"),
        customerType: z
          .string()
          .optional()
          .describe("Customer type for pricing: Consumer or Business"),
      },
    },
    async (args) => pricingGetItemOffersTool(client, config, args),
  );
}
