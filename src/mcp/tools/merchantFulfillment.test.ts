// src/mcp/tools/merchantFulfillment.test.ts
import { describe, it, expect, vi } from "vitest";
import {
  fulfillmentGetRatesTool,
  fulfillmentBuyLabelTool,
} from "./merchantFulfillment";
import type { SpApiClient } from "../../client";
import type { SpApiConfig } from "../../config";

const config: SpApiConfig = {
  lwaClientId: "id",
  lwaClientSecret: "secret",
  refreshToken: "rt",
  region: "na",
  marketplaceIds: ["ATVPDKIKX0DER"],
  sandbox: false,
};

function mockClient(response: unknown): SpApiClient {
  return { request: vi.fn().mockResolvedValue(response) } as unknown as SpApiClient;
}

function errorClient(): SpApiClient {
  return {
    request: vi.fn().mockRejectedValue(new Error("SP-API error")),
  } as unknown as SpApiClient;
}

const shipmentRequestDetails = {
  AmazonOrderId: "114-1234567-1234567",
  ItemList: [{ OrderItemId: "item1", Quantity: 1 }],
  ShipFromAddress: {
    Name: "Test Seller",
    AddressLine1: "123 Main St",
    City: "Seattle",
    CountryCode: "US",
    Email: "seller@example.com",
    Phone: "555-0100",
    PostalCode: "98101",
  },
  PackageDimensions: { Length: 10, Width: 10, Height: 10, Unit: "inches" },
  Weight: { Value: 1, Unit: "oz" },
  ShippingServiceOptions: {
    DeliveryExperience: "DeliveryConfirmationWithoutSignature",
    CarrierWillPickUp: false,
  },
};

// ------------------------------------------------------------------
// fulfillmentGetRatesTool
// ------------------------------------------------------------------

describe("fulfillmentGetRatesTool", () => {
  it("returns eligible shipping services on success", async () => {
    const services = [{ ShippingServiceId: "UPS_PTP_GND", ShippingServiceName: "UPS Ground" }];
    const client = mockClient({ payload: { ShippingServiceList: services } });
    const result = await fulfillmentGetRatesTool(client, { shipmentRequestDetails });
    expect(result.isError).toBeUndefined();
    expect(result.content[0]!.text).toContain("UPS_PTP_GND");
  });

  it("POSTs to /mfn/v0/eligibleShippingServices without restrictedResources", async () => {
    const client = mockClient({ payload: { ShippingServiceList: [] } });
    await fulfillmentGetRatesTool(client, { shipmentRequestDetails });
    const opts = (client.request as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    expect(opts.path).toBe("/mfn/v0/eligibleShippingServices");
    expect(opts.method).toBe("POST");
    expect(opts.restrictedResources).toBeUndefined();
  });

  it("returns errorResult on failure", async () => {
    const result = await fulfillmentGetRatesTool(errorClient(), { shipmentRequestDetails });
    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain("Error:");
  });
});

// ------------------------------------------------------------------
// fulfillmentBuyLabelTool
// ------------------------------------------------------------------

describe("fulfillmentBuyLabelTool", () => {
  it("returns created shipment on success", async () => {
    const client = mockClient({ payload: { Shipment: { ShipmentId: "SHIP123" } } });
    const result = await fulfillmentBuyLabelTool(client, {
      shipmentRequestDetails,
      shippingServiceId: "UPS_PTP_GND",
    });
    expect(result.isError).toBeUndefined();
    expect(result.content[0]!.text).toContain("SHIP123");
  });

  it("POSTs to /mfn/v0/shipments with restrictedResources shippingAddress", async () => {
    const client = mockClient({ payload: {} });
    await fulfillmentBuyLabelTool(client, {
      shipmentRequestDetails,
      shippingServiceId: "UPS_PTP_GND",
    });
    const opts = (client.request as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    expect(opts.path).toBe("/mfn/v0/shipments");
    expect(opts.method).toBe("POST");
    expect(opts.restrictedResources).toEqual([
      { method: "POST", path: "/mfn/v0/shipments", dataElements: ["shippingAddress"] },
    ]);
  });

  it("sends ShippingServiceId in the body", async () => {
    const client = mockClient({ payload: {} });
    await fulfillmentBuyLabelTool(client, {
      shipmentRequestDetails,
      shippingServiceId: "UPS_PTP_GND",
    });
    const opts = (client.request as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    expect((opts.body as Record<string, unknown>).ShippingServiceId).toBe("UPS_PTP_GND");
  });

  it("returns errorResult on failure", async () => {
    const result = await fulfillmentBuyLabelTool(errorClient(), {
      shipmentRequestDetails,
      shippingServiceId: "UPS_PTP_GND",
    });
    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain("Error:");
  });
});
