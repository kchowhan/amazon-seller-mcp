// src/operations/merchantFulfillment.test.ts
import { describe, it, expect, vi } from "vitest";
import {
  getEligibleShipmentServices,
  createShipment,
} from "./merchantFulfillment";
import type { SpApiClient } from "../client";

function mockClient(response: unknown): SpApiClient {
  return { request: vi.fn().mockResolvedValue(response) } as unknown as SpApiClient;
}

function callOpts(client: SpApiClient) {
  return (client.request as ReturnType<typeof vi.fn>).mock.calls[0]![0];
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
// getEligibleShipmentServices
// ------------------------------------------------------------------

describe("getEligibleShipmentServices", () => {
  it("POSTs to /mfn/v0/eligibleShippingServices", async () => {
    const client = mockClient({ payload: { ShippingServiceList: [] } });
    await getEligibleShipmentServices(client, { ShipmentRequestDetails: shipmentRequestDetails });
    const opts = callOpts(client);
    expect(opts.operation).toBe("getEligibleShipmentServices");
    expect(opts.method).toBe("POST");
    expect(opts.path).toBe("/mfn/v0/eligibleShippingServices");
  });

  it("sends ShipmentRequestDetails in the body", async () => {
    const client = mockClient({ payload: {} });
    await getEligibleShipmentServices(client, { ShipmentRequestDetails: shipmentRequestDetails });
    const opts = callOpts(client);
    expect((opts.body as Record<string, unknown>).ShipmentRequestDetails).toEqual(
      shipmentRequestDetails,
    );
  });

  it("does NOT set restrictedResources (getEligibleShipmentServices is not restricted per SP-API Tokens use-case guide)", async () => {
    const client = mockClient({ payload: {} });
    await getEligibleShipmentServices(client, { ShipmentRequestDetails: shipmentRequestDetails });
    const opts = callOpts(client);
    expect(opts.restrictedResources).toBeUndefined();
  });
});

// ------------------------------------------------------------------
// createShipment
// ------------------------------------------------------------------

describe("createShipment", () => {
  it("POSTs to /mfn/v0/shipments", async () => {
    const client = mockClient({ payload: { Shipment: {} } });
    await createShipment(client, {
      ShipmentRequestDetails: shipmentRequestDetails,
      ShippingServiceId: "UPS_PTP_GND",
    });
    const opts = callOpts(client);
    expect(opts.operation).toBe("createShipment");
    expect(opts.method).toBe("POST");
    expect(opts.path).toBe("/mfn/v0/shipments");
  });

  it("sends ShipmentRequestDetails and ShippingServiceId in the body", async () => {
    const client = mockClient({ payload: {} });
    await createShipment(client, {
      ShipmentRequestDetails: shipmentRequestDetails,
      ShippingServiceId: "UPS_PTP_GND",
    });
    const opts = callOpts(client);
    const body = opts.body as Record<string, unknown>;
    expect(body.ShipmentRequestDetails).toEqual(shipmentRequestDetails);
    expect(body.ShippingServiceId).toBe("UPS_PTP_GND");
  });

  it("sets restrictedResources with path=/mfn/v0/shipments (createShipment is restricted per SP-API Tokens use-case guide)", async () => {
    const client = mockClient({ payload: {} });
    await createShipment(client, {
      ShipmentRequestDetails: shipmentRequestDetails,
      ShippingServiceId: "UPS_PTP_GND",
    });
    const opts = callOpts(client);
    expect(opts.restrictedResources).toEqual([
      {
        method: "POST",
        path: "/mfn/v0/shipments",
        dataElements: ["shippingAddress"],
      },
    ]);
  });
});
