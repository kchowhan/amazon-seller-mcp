// src/mcp/tools/orders.ts
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SpApiClient } from "../../client";
import type { SpApiConfig } from "../../config";
import {
  getOrders,
  getOrder,
  getOrderItems,
  confirmShipment,
  type PackageDetail,
} from "../../operations/orders";
import { textResult, errorResult, type ToolResult } from "../toolResult";

export async function ordersListTool(
  client: SpApiClient,
  config: SpApiConfig,
  args: {
    createdAfter?: string;
    lastUpdatedAfter?: string;
    orderStatuses?: string[];
    marketplaceIds?: string[];
    nextToken?: string;
  },
): Promise<ToolResult> {
  try {
    const result = await getOrders(client, {
      MarketplaceIds: args.marketplaceIds ?? config.marketplaceIds,
      CreatedAfter: args.createdAfter,
      LastUpdatedAfter: args.lastUpdatedAfter,
      OrderStatuses: args.orderStatuses,
      NextToken: args.nextToken,
    });
    return textResult(result);
  } catch (err) {
    return errorResult(err);
  }
}

export async function ordersGetTool(
  client: SpApiClient,
  args: { orderId: string },
): Promise<ToolResult> {
  try {
    const result = await getOrder(client, args.orderId);
    return textResult(result);
  } catch (err) {
    return errorResult(err);
  }
}

export async function orderGetItemsTool(
  client: SpApiClient,
  args: { orderId: string; nextToken?: string },
): Promise<ToolResult> {
  try {
    const result = await getOrderItems(client, args.orderId, args.nextToken);
    return textResult(result);
  } catch (err) {
    return errorResult(err);
  }
}

export async function orderConfirmShipmentTool(
  client: SpApiClient,
  config: SpApiConfig,
  args: {
    orderId: string;
    marketplaceId?: string;
    packageDetail: PackageDetail;
  },
): Promise<ToolResult> {
  try {
    const marketplaceId = args.marketplaceId ?? config.marketplaceIds[0];
    if (!marketplaceId) {
      return errorResult(
        new Error(
          "marketplaceId is required: set SPAPI_MARKETPLACE_IDS or pass marketplaceId as a tool argument",
        ),
      );
    }
    const result = await confirmShipment(client, {
      orderId: args.orderId,
      marketplaceId,
      packageDetail: args.packageDetail,
    });
    return textResult(result);
  } catch (err) {
    return errorResult(err);
  }
}

export function registerOrdersTools(
  server: McpServer,
  client: SpApiClient,
  config: SpApiConfig,
): void {
  server.registerTool(
    "orders_list",
    {
      description:
        "List Amazon orders. Includes buyer PII (name, address) via a Restricted Data Token minted automatically. marketplaceIds defaults to the configured marketplaces. Supports pagination via nextToken.",
      inputSchema: {
        createdAfter: z
          .string()
          .optional()
          .describe("ISO 8601 datetime; return orders created at or after this time"),
        lastUpdatedAfter: z
          .string()
          .optional()
          .describe("ISO 8601 datetime; return orders last updated at or after this time"),
        orderStatuses: z
          .array(z.string())
          .optional()
          .describe(
            "Filter by order status (e.g. Pending, Unshipped, Shipped, Canceled)",
          ),
        marketplaceIds: z
          .array(z.string())
          .optional()
          .describe("Marketplace IDs (defaults to configured marketplaces)"),
        nextToken: z
          .string()
          .optional()
          .describe("Pagination token from a previous response"),
      },
    },
    async (args) => ordersListTool(client, config, args),
  );

  server.registerTool(
    "orders_get",
    {
      description:
        "Get a single Amazon order by orderId. Includes buyer PII (name, address) via a Restricted Data Token minted automatically.",
      inputSchema: {
        orderId: z.string().describe("Amazon order ID (e.g. 114-1234567-1234567)"),
      },
    },
    async (args) => ordersGetTool(client, args),
  );

  server.registerTool(
    "order_get_items",
    {
      description:
        "Get the order items for an Amazon order. Includes buyer info (gift wrap, custom order details) via a Restricted Data Token minted automatically.",
      inputSchema: {
        orderId: z.string().describe("Amazon order ID (e.g. 114-1234567-1234567)"),
        nextToken: z
          .string()
          .optional()
          .describe("Pagination token from a previous response"),
      },
    },
    async (args) => orderGetItemsTool(client, args),
  );

  server.registerTool(
    "order_confirm_shipment",
    {
      description:
        "Confirm shipment for an Amazon order (updates shipment status with carrier and tracking info). marketplaceId defaults to the first configured marketplace.",
      inputSchema: {
        orderId: z.string().describe("Amazon order ID (e.g. 114-1234567-1234567)"),
        marketplaceId: z
          .string()
          .optional()
          .describe("Marketplace ID (defaults to first configured marketplace)"),
        packageDetail: z
          .object({
            packageReferenceId: z.string().describe("Unique reference for the package"),
            carrierCode: z.string().describe("Carrier code (e.g. UPS, USPS, FedEx)"),
            trackingNumber: z.string().describe("Carrier tracking number"),
            shipDate: z.string().describe("ISO 8601 ship date/time"),
            orderItems: z
              .array(z.record(z.unknown()))
              .describe("List of order items and quantities being shipped"),
            carrierName: z
              .string()
              .optional()
              .describe("Carrier name (required when carrierCode is Other)"),
            shippingMethod: z.string().optional().describe("Ship method"),
            shipFromSupplySourceId: z
              .string()
              .optional()
              .describe("Supply source ID for multi-channel fulfillment"),
          })
          .describe("Package details for the shipment confirmation"),
      },
    },
    async (args) =>
      orderConfirmShipmentTool(client, config, {
        orderId: args.orderId,
        marketplaceId: args.marketplaceId,
        packageDetail: args.packageDetail as PackageDetail,
      }),
  );
}
