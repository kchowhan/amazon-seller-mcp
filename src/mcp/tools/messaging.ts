// src/mcp/tools/messaging.ts
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SpApiClient } from "../../client";
import type { SpApiConfig } from "../../config";
import {
  getMessagingActionsForOrder,
  createConfirmDeliveryDetails,
} from "../../operations/messaging";
import { textResult, errorResult, type ToolResult } from "../toolResult";

// ------------------------------------------------------------------
// messagingGetActionsTool
// ------------------------------------------------------------------

export async function messagingGetActionsTool(
  client: SpApiClient,
  config: SpApiConfig,
  args: { amazonOrderId: string; marketplaceIds?: string[] },
): Promise<ToolResult> {
  try {
    const result = await getMessagingActionsForOrder(client, {
      amazonOrderId: args.amazonOrderId,
      marketplaceIds: args.marketplaceIds ?? config.marketplaceIds,
    });
    return textResult(result);
  } catch (err) {
    return errorResult(err);
  }
}

// ------------------------------------------------------------------
// messagingConfirmDeliveryTool
// ------------------------------------------------------------------

export async function messagingConfirmDeliveryTool(
  client: SpApiClient,
  config: SpApiConfig,
  args: { amazonOrderId: string; text: string; marketplaceIds?: string[] },
): Promise<ToolResult> {
  try {
    const result = await createConfirmDeliveryDetails(client, {
      amazonOrderId: args.amazonOrderId,
      marketplaceIds: args.marketplaceIds ?? config.marketplaceIds,
      text: args.text,
    });
    return textResult(result);
  } catch (err) {
    return errorResult(err);
  }
}

// ------------------------------------------------------------------
// registerMessagingTools
// ------------------------------------------------------------------

export function registerMessagingTools(
  server: McpServer,
  client: SpApiClient,
  config: SpApiConfig,
): void {
  server.registerTool(
    "messaging_get_actions",
    {
      description:
        "Get the message types available for an Amazon order. Amazon constrains buyer-seller messaging to specific permitted action types; this lists which message types are currently permitted for the given order. marketplaceIds defaults to the configured marketplaces.",
      inputSchema: {
        amazonOrderId: z.string().describe("Amazon order ID (e.g. 114-1234567-1234567)"),
        marketplaceIds: z
          .array(z.string())
          .optional()
          .describe("Marketplace IDs (defaults to configured marketplaces; max 1 per request)"),
      },
    },
    async (args) => messagingGetActionsTool(client, config, args),
  );

  server.registerTool(
    "messaging_confirm_delivery",
    {
      description:
        "Send a delivery confirmation message to the buyer for an Amazon order. Amazon restricts buyer-seller messaging to specific permitted action types; use messaging_get_actions first to confirm this action is permitted for the order. marketplaceIds defaults to the configured marketplaces.",
      inputSchema: {
        amazonOrderId: z.string().describe("Amazon order ID (e.g. 114-1234567-1234567)"),
        text: z
          .string()
          .min(1)
          .max(2000)
          .describe(
            "Message text to send to the buyer (1-2000 chars; only delivery-related links allowed)",
          ),
        marketplaceIds: z
          .array(z.string())
          .optional()
          .describe("Marketplace IDs (defaults to configured marketplaces; max 1 per request)"),
      },
    },
    async (args) => messagingConfirmDeliveryTool(client, config, args),
  );
}
