// src/mcp/tools/sales.ts
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SpApiClient } from "../../client";
import type { SpApiConfig } from "../../config";
import { getOrderMetrics, type Granularity } from "../../operations/sales";
import { textResult, errorResult, type ToolResult } from "../toolResult";

export async function salesGetMetricsTool(
  client: SpApiClient,
  config: SpApiConfig,
  args: {
    interval: string;
    granularity?: string;
    marketplaceIds?: string[];
    granularityTimeZone?: string;
    buyerType?: string;
    fulfillmentNetwork?: string;
    asin?: string;
    sku?: string;
  },
): Promise<ToolResult> {
  try {
    const result = await getOrderMetrics(client, {
      marketplaceIds: args.marketplaceIds ?? config.marketplaceIds,
      interval: args.interval,
      granularity: (args.granularity ?? "Day") as Granularity,
      granularityTimeZone: args.granularityTimeZone,
      buyerType: args.buyerType,
      fulfillmentNetwork: args.fulfillmentNetwork,
      asin: args.asin,
      sku: args.sku,
    });
    return textResult(result);
  } catch (err) {
    return errorResult(err);
  }
}

export function registerSalesTools(
  server: McpServer,
  client: SpApiClient,
  config: SpApiConfig,
): void {
  server.registerTool(
    "sales_get_metrics",
    {
      description:
        "Get Amazon order metrics (unit count, order count, total sales, etc.) for a given time interval and granularity. interval must be an ISO 8601 time interval (e.g. 2024-01-01T00:00:00Z--2024-01-31T23:59:59Z). marketplaceIds defaults to the configured marketplaces.",
      inputSchema: {
        interval: z
          .string()
          .describe(
            "ISO 8601 time interval (e.g. 2024-01-01T00:00:00Z--2024-01-31T23:59:59Z)",
          ),
        granularity: z
          .enum(["Hour", "Day", "Week", "Month", "Year", "Total"])
          .optional()
          .describe("Time granularity for aggregation (default: Day)"),
        marketplaceIds: z
          .array(z.string())
          .optional()
          .describe("Marketplace IDs (defaults to configured marketplaces)"),
        granularityTimeZone: z
          .string()
          .optional()
          .describe("IANA timezone for granularity (e.g. America/Los_Angeles)"),
        buyerType: z
          .string()
          .optional()
          .describe("Filter by buyer type (e.g. B2C, B2B)"),
        fulfillmentNetwork: z
          .string()
          .optional()
          .describe("Filter by fulfillment network (e.g. AFN, MFN)"),
        asin: z.string().optional().describe("Filter by ASIN"),
        sku: z.string().optional().describe("Filter by seller SKU"),
      },
    },
    async (args) => salesGetMetricsTool(client, config, args),
  );
}
