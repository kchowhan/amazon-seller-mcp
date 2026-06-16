// src/mcp/tools/solicitations.ts
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SpApiClient } from "../../client";
import type { SpApiConfig } from "../../config";
import {
  getSolicitationActionsForOrder,
  createProductReviewAndSellerFeedbackSolicitation,
} from "../../operations/solicitations";
import { textResult, errorResult, type ToolResult } from "../toolResult";

// ------------------------------------------------------------------
// solicitationsGetActionsTool
// ------------------------------------------------------------------

export async function solicitationsGetActionsTool(
  client: SpApiClient,
  config: SpApiConfig,
  args: { amazonOrderId: string; marketplaceIds?: string[] },
): Promise<ToolResult> {
  try {
    const result = await getSolicitationActionsForOrder(client, {
      amazonOrderId: args.amazonOrderId,
      marketplaceIds: args.marketplaceIds ?? config.marketplaceIds,
    });
    return textResult(result);
  } catch (err) {
    return errorResult(err);
  }
}

// ------------------------------------------------------------------
// solicitationsRequestReviewTool
// ------------------------------------------------------------------

export async function solicitationsRequestReviewTool(
  client: SpApiClient,
  config: SpApiConfig,
  args: { amazonOrderId: string; marketplaceIds?: string[] },
): Promise<ToolResult> {
  try {
    const result = await createProductReviewAndSellerFeedbackSolicitation(client, {
      amazonOrderId: args.amazonOrderId,
      marketplaceIds: args.marketplaceIds ?? config.marketplaceIds,
    });
    return textResult(result);
  } catch (err) {
    return errorResult(err);
  }
}

// ------------------------------------------------------------------
// registerSolicitationsTools
// ------------------------------------------------------------------

export function registerSolicitationsTools(
  server: McpServer,
  client: SpApiClient,
  config: SpApiConfig,
): void {
  server.registerTool(
    "solicitations_get_actions",
    {
      description:
        "Get the solicitation action types available for an Amazon order. Use this to check whether a product review and seller feedback solicitation can be sent for the given order. marketplaceIds defaults to the configured marketplaces.",
      inputSchema: {
        amazonOrderId: z.string().describe("Amazon order ID (e.g. 114-1234567-1234567)"),
        marketplaceIds: z
          .array(z.string())
          .optional()
          .describe("Marketplace IDs (defaults to configured marketplaces; max 1 per request)"),
      },
    },
    async (args) => solicitationsGetActionsTool(client, config, args),
  );

  server.registerTool(
    "solicitations_request_review",
    {
      description:
        "Send a product review and seller feedback solicitation to the buyer for an Amazon order. Only one solicitation per order is allowed; use solicitations_get_actions first to confirm the action is available. marketplaceIds defaults to the configured marketplaces.",
      inputSchema: {
        amazonOrderId: z.string().describe("Amazon order ID (e.g. 114-1234567-1234567)"),
        marketplaceIds: z
          .array(z.string())
          .optional()
          .describe("Marketplace IDs (defaults to configured marketplaces; max 1 per request)"),
      },
    },
    async (args) => solicitationsRequestReviewTool(client, config, args),
  );
}
