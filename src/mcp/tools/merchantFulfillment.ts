// src/mcp/tools/merchantFulfillment.ts
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SpApiClient } from "../../client";
import {
  getEligibleShipmentServices,
  createShipment,
  type ShipmentRequestDetails,
} from "../../operations/merchantFulfillment";
import { textResult, errorResult, type ToolResult } from "../toolResult";

// Zod schema for ShipmentRequestDetails (reused by both tools)
const shipmentRequestDetailsSchema = z.object({
  AmazonOrderId: z.string().describe("Amazon order ID (e.g. 114-1234567-1234567)"),
  SellerOrderId: z.string().optional().describe("Seller-defined order ID"),
  ItemList: z
    .array(
      z.object({
        OrderItemId: z.string().describe("Amazon order item ID"),
        Quantity: z.number().int().positive().describe("Number of items to ship"),
      }),
    )
    .describe("List of items to include in the shipment"),
  ShipFromAddress: z
    .object({
      Name: z.string(),
      AddressLine1: z.string(),
      AddressLine2: z.string().optional(),
      AddressLine3: z.string().optional(),
      DistrictOrCounty: z.string().optional(),
      City: z.string(),
      CountryCode: z.string(),
      Email: z.string(),
      Phone: z.string(),
      PostalCode: z.string(),
    })
    .describe("Ship-from address"),
  PackageDimensions: z
    .object({
      Length: z.number().optional(),
      Width: z.number().optional(),
      Height: z.number().optional(),
      Unit: z.string().optional().describe("Unit of measurement (e.g. inches, centimeters)"),
      PredefinedPackageDimensions: z.string().optional(),
    })
    .describe("Package dimensions"),
  Weight: z
    .object({
      Value: z.number(),
      Unit: z.string().describe("Weight unit (e.g. oz, g)"),
    })
    .describe("Package weight"),
  MustArriveByDate: z.string().optional().describe("ISO 8601 must-arrive-by date"),
  ShipDate: z.string().optional().describe("ISO 8601 ship date"),
  ShippingServiceOptions: z
    .object({
      DeliveryExperience: z.string().describe("Delivery confirmation type"),
      CarrierWillPickUp: z.boolean().describe("Whether carrier will pick up the package"),
      CarrierWillPickUpOption: z.string().optional(),
      DeclaredValue: z
        .object({ CurrencyCode: z.string(), Amount: z.string() })
        .optional()
        .describe("Declared value for insurance"),
      LabelFormat: z.string().optional(),
    })
    .describe("Shipping service options"),
  LabelCustomization: z
    .object({
      CustomTextForLabel: z.string().optional(),
      StandardIdForLabel: z.string().optional(),
    })
    .optional()
    .describe("Label customization options"),
});

// ------------------------------------------------------------------
// fulfillmentGetRatesTool
// ------------------------------------------------------------------

export async function fulfillmentGetRatesTool(
  client: SpApiClient,
  args: { shipmentRequestDetails: ShipmentRequestDetails },
): Promise<ToolResult> {
  try {
    const result = await getEligibleShipmentServices(client, {
      ShipmentRequestDetails: args.shipmentRequestDetails,
    });
    return textResult(result);
  } catch (err) {
    return errorResult(err);
  }
}

// ------------------------------------------------------------------
// fulfillmentBuyLabelTool
// ------------------------------------------------------------------

export async function fulfillmentBuyLabelTool(
  client: SpApiClient,
  args: { shipmentRequestDetails: ShipmentRequestDetails; shippingServiceId: string },
): Promise<ToolResult> {
  try {
    const result = await createShipment(client, {
      ShipmentRequestDetails: args.shipmentRequestDetails,
      ShippingServiceId: args.shippingServiceId,
    });
    return textResult(result);
  } catch (err) {
    return errorResult(err);
  }
}

// ------------------------------------------------------------------
// registerMerchantFulfillmentTools
// ------------------------------------------------------------------

export function registerMerchantFulfillmentTools(
  server: McpServer,
  client: SpApiClient,
): void {
  server.registerTool(
    "fulfillment_get_rates",
    {
      description:
        "Get eligible shipping services (rates) for an Amazon order shipment. Returns carrier options, pricing, and estimated delivery times for the given shipment details.",
      inputSchema: {
        shipmentRequestDetails: shipmentRequestDetailsSchema.describe(
          "Details of the shipment to get rates for",
        ),
      },
    },
    async (args) =>
      fulfillmentGetRatesTool(client, {
        shipmentRequestDetails: args.shipmentRequestDetails as ShipmentRequestDetails,
      }),
  );

  server.registerTool(
    "fulfillment_buy_label",
    {
      description:
        "Purchase a shipping label for an Amazon order. Creates a shipment using the selected shipping service. The response contains the buyer's shipping address (PII) and is authorized via a Restricted Data Token minted automatically.",
      inputSchema: {
        shipmentRequestDetails: shipmentRequestDetailsSchema.describe(
          "Details of the shipment to create",
        ),
        shippingServiceId: z
          .string()
          .describe(
            "Shipping service ID from fulfillment_get_rates (e.g. UPS_PTP_GND, USPS_PTP_PRI)",
          ),
      },
    },
    async (args) =>
      fulfillmentBuyLabelTool(client, {
        shipmentRequestDetails: args.shipmentRequestDetails as ShipmentRequestDetails,
        shippingServiceId: args.shippingServiceId,
      }),
  );
}
