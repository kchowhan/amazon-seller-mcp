// src/mcp/tools/fbaInventory.ts
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SpApiClient } from "../../client";
import type { SpApiConfig } from "../../config";
import { getInventorySummaries } from "../../operations/fbaInventory";
import { textResult, errorResult, type ToolResult } from "../toolResult";

export async function inventoryGetFbaTool(
  client: SpApiClient,
  config: SpApiConfig,
  args: {
    marketplaceId?: string;
    details?: boolean;
    startDateTime?: string;
    sellerSkus?: string[];
    nextToken?: string;
  },
): Promise<ToolResult> {
  const marketplaceId = args.marketplaceId ?? config.marketplaceIds[0]!;
  try {
    const result = await getInventorySummaries(client, {
      granularityType: "Marketplace",
      granularityId: marketplaceId,
      marketplaceIds: [marketplaceId],
      details: args.details ?? true,
      startDateTime: args.startDateTime,
      sellerSkus: args.sellerSkus,
      nextToken: args.nextToken,
    });
    return textResult(result);
  } catch (err) {
    return errorResult(err);
  }
}

export function registerFbaInventoryTools(
  server: McpServer,
  client: SpApiClient,
  config: SpApiConfig,
): void {
  server.registerTool(
    "inventory_get_fba",
    {
      description:
        "Get FBA inventory summaries for the seller. Defaults to the first configured marketplace with details=true. Supports pagination via nextToken.",
      inputSchema: {
        marketplaceId: z
          .string()
          .optional()
          .describe("Marketplace ID (defaults to first configured marketplace)"),
        details: z
          .boolean()
          .optional()
          .describe("Whether to include detailed inventory data (default true)"),
        startDateTime: z
          .string()
          .optional()
          .describe("ISO 8601 datetime to filter items changed after this time"),
        sellerSkus: z
          .array(z.string())
          .optional()
          .describe("Filter by specific seller SKUs"),
        nextToken: z.string().optional().describe("Pagination token from a previous response"),
      },
    },
    async (args) => inventoryGetFbaTool(client, config, args),
  );
}
