// src/operations/sales.test.ts
import { describe, it, expect, vi } from "vitest";
import { getOrderMetrics } from "./sales";
import type { SpApiClient } from "../client";

function mockClient(response: unknown): SpApiClient {
  return { request: vi.fn().mockResolvedValue(response) } as unknown as SpApiClient;
}

describe("getOrderMetrics", () => {
  it("GETs /sales/v1/orderMetrics with required params", async () => {
    const client = mockClient({ payload: [] });
    const result = await getOrderMetrics(client, {
      marketplaceIds: ["ATVPDKIKX0DER"],
      interval: "2024-01-01T00:00:00Z--2024-01-31T23:59:59Z",
      granularity: "Day",
    });
    expect(result.payload).toBeDefined();
    const opts = (client.request as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    expect(opts.operation).toBe("getOrderMetrics");
    expect(opts.method).toBe("GET");
    expect(opts.path).toBe("/sales/v1/orderMetrics");
    expect(opts.query.marketplaceIds).toEqual(["ATVPDKIKX0DER"]);
    expect(opts.query.interval).toBe("2024-01-01T00:00:00Z--2024-01-31T23:59:59Z");
    expect(opts.query.granularity).toBe("Day");
  });

  it("passes optional query params when provided", async () => {
    const client = mockClient({ payload: [] });
    await getOrderMetrics(client, {
      marketplaceIds: ["ATVPDKIKX0DER"],
      interval: "2024-01-01T00:00:00Z--2024-01-31T23:59:59Z",
      granularity: "Month",
      granularityTimeZone: "America/Los_Angeles",
      buyerType: "B2C",
      fulfillmentNetwork: "AFN",
      asin: "B000001",
      sku: "MY-SKU",
    });
    const opts = (client.request as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    expect(opts.query.granularityTimeZone).toBe("America/Los_Angeles");
    expect(opts.query.buyerType).toBe("B2C");
    expect(opts.query.fulfillmentNetwork).toBe("AFN");
    expect(opts.query.asin).toBe("B000001");
    expect(opts.query.sku).toBe("MY-SKU");
  });

  it("does not set grantless (seller-authorized operation)", async () => {
    const client = mockClient({ payload: [] });
    await getOrderMetrics(client, {
      marketplaceIds: ["ATVPDKIKX0DER"],
      interval: "2024-01-01T00:00:00Z--2024-01-31T23:59:59Z",
      granularity: "Day",
    });
    const opts = (client.request as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    expect(opts.grantless).toBeUndefined();
  });
});
