// src/mcp/tools/orders.test.ts
import { describe, it, expect, vi } from "vitest";
import {
  ordersListTool,
  ordersGetTool,
  orderGetItemsTool,
  orderConfirmShipmentTool,
} from "./orders";
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

describe("ordersListTool", () => {
  it("returns order list on success", async () => {
    const orders = [{ AmazonOrderId: "114-1234567-1234567" }];
    const client = mockClient({ payload: { Orders: orders } });
    const result = await ordersListTool(client, config, {});
    expect(result.isError).toBeUndefined();
    expect(result.content[0]!.text).toContain("114-1234567-1234567");
  });

  it("defaults marketplaceIds to config", async () => {
    const client = mockClient({ payload: {} });
    await ordersListTool(client, config, {});
    const opts = (client.request as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    expect(opts.query.MarketplaceIds).toEqual(["ATVPDKIKX0DER"]);
  });

  it("passes createdAfter and orderStatuses", async () => {
    const client = mockClient({ payload: {} });
    await ordersListTool(client, config, {
      createdAfter: "2024-01-01T00:00:00Z",
      orderStatuses: ["Shipped"],
    });
    const opts = (client.request as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    expect(opts.query.CreatedAfter).toBe("2024-01-01T00:00:00Z");
    expect(opts.query.OrderStatuses).toEqual(["Shipped"]);
  });

  it("returns errorResult on failure", async () => {
    const result = await ordersListTool(errorClient(), config, {});
    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain("Error:");
  });
});

describe("ordersGetTool", () => {
  const orderId = "114-1234567-9876543";

  it("returns order on success", async () => {
    const client = mockClient({ payload: { AmazonOrderId: orderId } });
    const result = await ordersGetTool(client, { orderId });
    expect(result.isError).toBeUndefined();
    expect(result.content[0]!.text).toContain(orderId);
  });

  it("requests the correct path", async () => {
    const client = mockClient({ payload: {} });
    await ordersGetTool(client, { orderId });
    const opts = (client.request as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    expect(opts.path).toBe(`/orders/v0/orders/${orderId}`);
    // RDT path must match request path
    expect(opts.restrictedResources[0].path).toBe(`/orders/v0/orders/${orderId}`);
  });

  it("returns errorResult on failure", async () => {
    const result = await ordersGetTool(errorClient(), { orderId });
    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain("Error:");
  });
});

describe("orderGetItemsTool", () => {
  const orderId = "114-0000001-2222222";

  it("returns order items on success", async () => {
    const client = mockClient({ payload: { OrderItems: [] } });
    const result = await orderGetItemsTool(client, { orderId });
    expect(result.isError).toBeUndefined();
  });

  it("requests the correct path and RDT with buyerInfo", async () => {
    const client = mockClient({ payload: {} });
    await orderGetItemsTool(client, { orderId });
    const opts = (client.request as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    expect(opts.path).toBe(`/orders/v0/orders/${orderId}/orderItems`);
    expect(opts.restrictedResources[0].path).toBe(opts.path);
    expect(opts.restrictedResources[0].dataElements).toEqual(["buyerInfo"]);
  });

  it("returns errorResult on failure", async () => {
    const result = await orderGetItemsTool(errorClient(), { orderId });
    expect(result.isError).toBe(true);
  });
});

describe("orderConfirmShipmentTool", () => {
  const packageDetail = {
    packageReferenceId: "1",
    carrierCode: "UPS",
    trackingNumber: "1Z999AA10123456784",
    shipDate: "2024-06-01T00:00:00Z",
    orderItems: [{ orderItemId: "item1", quantity: 1 }],
  };

  it("returns success result", async () => {
    const client = mockClient({});
    const result = await orderConfirmShipmentTool(client, config, {
      orderId: "114-0000001-3333333",
      packageDetail,
    });
    expect(result.isError).toBeUndefined();
  });

  it("defaults marketplaceId to first config marketplace", async () => {
    const client = mockClient({});
    await orderConfirmShipmentTool(client, config, {
      orderId: "114-0000001-3333333",
      packageDetail,
    });
    const opts = (client.request as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    const body = opts.body as { marketplaceId: string };
    expect(body.marketplaceId).toBe("ATVPDKIKX0DER");
  });

  it("uses provided marketplaceId when given", async () => {
    const client = mockClient({});
    await orderConfirmShipmentTool(client, config, {
      orderId: "114-0000001-3333333",
      marketplaceId: "A2EUQ1WTGCTBG2",
      packageDetail,
    });
    const opts = (client.request as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    const body = opts.body as { marketplaceId: string };
    expect(body.marketplaceId).toBe("A2EUQ1WTGCTBG2");
  });

  it("returns errorResult when no marketplaceId is available", async () => {
    const emptyConfig: SpApiConfig = { ...config, marketplaceIds: [] };
    const client = mockClient({});
    const result = await orderConfirmShipmentTool(client, emptyConfig, {
      orderId: "114-0000001-3333333",
      packageDetail,
    });
    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain("marketplaceId is required");
  });

  it("returns errorResult on SP-API failure", async () => {
    const result = await orderConfirmShipmentTool(errorClient(), config, {
      orderId: "114-0000001-3333333",
      packageDetail,
    });
    expect(result.isError).toBe(true);
  });
});
