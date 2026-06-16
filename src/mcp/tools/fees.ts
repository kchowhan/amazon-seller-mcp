// src/mcp/tools/fees.ts
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SpApiClient } from "../../client";
import type { SpApiConfig } from "../../config";
import { getMyFeesEstimateForASIN } from "../../operations/fees";
import { textResult, errorResult, type ToolResult } from "../toolResult";

export async function feesEstimateTool(
  client: SpApiClient,
  config: SpApiConfig,
  args: {
    asin: string;
    price: number;
    currencyCode?: string;
    isAmazonFulfilled?: boolean;
    marketplaceId?: string;
  },
): Promise<ToolResult> {
  try {
    const result = await getMyFeesEstimateForASIN(client, {
      Asin: args.asin,
      FeesEstimateRequest: {
        MarketplaceId: args.marketplaceId ?? config.marketplaceIds[0]!,
        IsAmazonFulfilled: args.isAmazonFulfilled ?? true,
        Identifier: args.asin,
        PriceToEstimateFees: {
          ListingPrice: {
            CurrencyCode: args.currencyCode ?? "USD",
            Amount: args.price,
          },
        },
      },
    });
    return textResult(result);
  } catch (err) {
    return errorResult(err);
  }
}

export function registerFeesTools(
  server: McpServer,
  client: SpApiClient,
  config: SpApiConfig,
): void {
  server.registerTool(
    "fees_estimate",
    {
      description:
        "Estimate Amazon selling fees for an ASIN at a given price. marketplaceId defaults to the first configured marketplace.",
      inputSchema: {
        asin: z.string().describe("The ASIN to estimate fees for"),
        price: z.number().describe("The listing price to estimate fees on"),
        currencyCode: z
          .string()
          .optional()
          .describe("ISO 4217 currency code (default USD)"),
        isAmazonFulfilled: z
          .boolean()
          .optional()
          .describe("Whether the item is fulfilled by Amazon (default true)"),
        marketplaceId: z
          .string()
          .optional()
          .describe("Marketplace ID (defaults to first configured marketplace)"),
      },
    },
    async (args) => feesEstimateTool(client, config, args),
  );
}
