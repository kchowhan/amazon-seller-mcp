// src/operations/orders.test.ts
import { describe, it, expect, vi } from "vitest";
import { getOrders, getOrder, getOrderItems, confirmShipment } from "./orders";
import type { SpApiClient } from "../client";

function mockClient(response: unknown): SpApiClient {
  return { request: vi.fn().mockResolvedValue(response) } as unknown as SpApiClient;
}

// Helper to extract the request options from the first mock call
function callOpts(client: SpApiClient) {
  return (client.request as ReturnType<typeof vi.fn>).mock.calls[0]![0];
}

describe("getOrders", () => {
  it("GETs /orders/v0/orders with PascalCase MarketplaceIds", async () => {
    const client = mockClient({ payload: { Orders: [] } });
    await getOrders(client, { MarketplaceIds: ["ATVPDKIKX0DER"] });
    const opts = callOpts(client);
    expect(opts.operation).toBe("getOrders");
    expect(opts.method).toBe("GET");
    expect(opts.path).toBe("/orders/v0/orders");
    expect(opts.query.MarketplaceIds).toEqual(["ATVPDKIKX0DER"]);
  });

  it("passes optional query params with PascalCase casing", async () => {
    const client = mockClient({ payload: {} });
    await getOrders(client, {
      MarketplaceIds: ["ATVPDKIKX0DER"],
      CreatedAfter: "2024-01-01T00:00:00Z",
      LastUpdatedAfter: "2024-06-01T00:00:00Z",
      OrderStatuses: ["Shipped", "Unshipped"],
      NextToken: "tok123",
    });
    const opts = callOpts(client);
    expect(opts.query.CreatedAfter).toBe("2024-01-01T00:00:00Z");
    expect(opts.query.LastUpdatedAfter).toBe("2024-06-01T00:00:00Z");
    expect(opts.query.OrderStatuses).toEqual(["Shipped", "Unshipped"]);
    expect(opts.query.NextToken).toBe("tok123");
  });

  it("sets restrictedResources with path=/orders/v0/orders and dataElements buyerInfo+shippingAddress", async () => {
    const client = mockClient({ payload: {} });
    await getOrders(client, { MarketplaceIds: ["ATVPDKIKX0DER"] });
    const opts = callOpts(client);
    expect(opts.restrictedResources).toEqual([
      { method: "GET", path: "/orders/v0/orders", dataElements: ["buyerInfo", "shippingAddress"] },
    ]);
  });
});

describe("getOrder", () => {
  const orderId = "114-1234567-1234567";

  it("GETs /orders/v0/orders/{orderId} with the concrete orderId", async () => {
    const client = mockClient({ payload: {} });
    await getOrder(client, orderId);
    const opts = callOpts(client);
    expect(opts.operation).toBe("getOrder");
    expect(opts.method).toBe("GET");
    expect(opts.path).toBe(`/orders/v0/orders/${orderId}`);
  });

  it("sets restrictedResources path matching the request path with buyerInfo+shippingAddress", async () => {
    const client = mockClient({ payload: {} });
    await getOrder(client, orderId);
    const opts = callOpts(client);
    expect(opts.restrictedResources).toEqual([
      {
        method: "GET",
        path: `/orders/v0/orders/${orderId}`,
        dataElements: ["buyerInfo", "shippingAddress"],
      },
    ]);
    // Confirm path and restrictedResources path are identical
    expect(opts.restrictedResources[0].path).toBe(opts.path);
  });
});

describe("getOrderItems", () => {
  const orderId = "114-1234567-9999999";

  it("GETs /orders/v0/orders/{orderId}/orderItems with the concrete orderId", async () => {
    const client = mockClient({ payload: {} });
    await getOrderItems(client, orderId);
    const opts = callOpts(client);
    expect(opts.operation).toBe("getOrderItems");
    expect(opts.method).toBe("GET");
    expect(opts.path).toBe(`/orders/v0/orders/${orderId}/orderItems`);
  });

  it("passes NextToken when provided", async () => {
    const client = mockClient({ payload: {} });
    await getOrderItems(client, orderId, "page2token");
    const opts = callOpts(client);
    expect(opts.query.NextToken).toBe("page2token");
  });

  it("sets restrictedResources path matching the request path with dataElements buyerInfo", async () => {
    const client = mockClient({ payload: {} });
    await getOrderItems(client, orderId);
    const opts = callOpts(client);
    expect(opts.restrictedResources).toEqual([
      {
        method: "GET",
        path: `/orders/v0/orders/${orderId}/orderItems`,
        dataElements: ["buyerInfo"],
      },
    ]);
    expect(opts.restrictedResources[0].path).toBe(opts.path);
  });
});

describe("confirmShipment", () => {
  const params = {
    orderId: "114-0000000-1111111",
    marketplaceId: "ATVPDKIKX0DER",
    packageDetail: {
      packageReferenceId: "1",
      carrierCode: "UPS",
      trackingNumber: "1Z999AA10123456784",
      shipDate: "2024-06-01T00:00:00Z",
      orderItems: [{ orderItemId: "item1", quantity: 1 }],
    },
  };

  it("POSTs to /orders/v0/orders/{orderId}/shipmentConfirmation", async () => {
    const client = mockClient({});
    await confirmShipment(client, params);
    const opts = callOpts(client);
    expect(opts.operation).toBe("confirmShipment");
    expect(opts.method).toBe("POST");
    expect(opts.path).toBe(`/orders/v0/orders/${params.orderId}/shipmentConfirmation`);
  });

  it("sends marketplaceId and packageDetail in the body", async () => {
    const client = mockClient({});
    await confirmShipment(client, params);
    const opts = callOpts(client);
    const body = opts.body as { marketplaceId: string; packageDetail: unknown };
    expect(body.marketplaceId).toBe("ATVPDKIKX0DER");
    expect(body.packageDetail).toEqual(params.packageDetail);
  });

  it("does NOT set restrictedResources (confirmShipment is not a restricted operation)", async () => {
    const client = mockClient({});
    await confirmShipment(client, params);
    const opts = callOpts(client);
    expect(opts.restrictedResources).toBeUndefined();
  });

  it("does NOT set grantless", async () => {
    const client = mockClient({});
    await confirmShipment(client, params);
    const opts = callOpts(client);
    expect(opts.grantless).toBeUndefined();
  });
});
