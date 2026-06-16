// src/mcp/tools/sales.test.ts
import { describe, it, expect, vi } from "vitest";
import { salesGetMetricsTool } from "./sales";
import type { SpApiClient } from "../../client";
import type { SpApiConfig } from "../../config";

const config: SpApiConfig = {
  lwaClientId: "id",
  lwaClientSecret: "sec",
  refreshToken: "rt",
  marketplaceIds: ["ATVPDKIKX0DER"],
  region: "na",
  sandbox: false,
};

function mockClient(response: unknown): SpApiClient {
  return { request: vi.fn().mockResolvedValue(response) } as unknown as SpApiClient;
}

const INTERVAL = "2024-01-01T00:00:00Z--2024-01-31T23:59:59Z";

describe("salesGetMetricsTool", () => {
  it("returns order metrics on success", async () => {
    const client = mockClient({
      payload: [
        {
          interval: INTERVAL,
          unitCount: 42,
          orderItemCount: 42,
          orderCount: 40,
          averageUnitPrice: { currencyCode: "USD", amount: "25.00" },
          totalSales: { currencyCode: "USD", amount: "1050.00" },
        },
      ],
    });
    const result = await salesGetMetricsTool(client, config, { interval: INTERVAL });
    expect(result.isError).toBeUndefined();
    const parsed = JSON.parse(result.content[0]!.text);
    expect(parsed.payload[0].unitCount).toBe(42);
  });

  it("defaults granularity to Day and marketplaceIds to config", async () => {
    const client = mockClient({ payload: [] });
    await salesGetMetricsTool(client, config, { interval: INTERVAL });
    const opts = (client.request as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    expect(opts.query.granularity).toBe("Day");
    expect(opts.query.marketplaceIds).toEqual(["ATVPDKIKX0DER"]);
  });

  it("passes provided granularity and marketplaceIds", async () => {
    const client = mockClient({ payload: [] });
    await salesGetMetricsTool(client, config, {
      interval: INTERVAL,
      granularity: "Month",
      marketplaceIds: ["A1F83G8C2ARO7P"],
    });
    const opts = (client.request as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    expect(opts.query.granularity).toBe("Month");
    expect(opts.query.marketplaceIds).toEqual(["A1F83G8C2ARO7P"]);
  });

  it("passes optional filters to query", async () => {
    const client = mockClient({ payload: [] });
    await salesGetMetricsTool(client, config, {
      interval: INTERVAL,
      granularityTimeZone: "America/New_York",
      buyerType: "B2C",
      fulfillmentNetwork: "AFN",
      asin: "B00001",
      sku: "SKU1",
    });
    const opts = (client.request as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    expect(opts.query.granularityTimeZone).toBe("America/New_York");
    expect(opts.query.buyerType).toBe("B2C");
    expect(opts.query.fulfillmentNetwork).toBe("AFN");
    expect(opts.query.asin).toBe("B00001");
    expect(opts.query.sku).toBe("SKU1");
  });

  it("returns isError when operation rejects", async () => {
    const client = { request: vi.fn().mockRejectedValue(new Error("rate limited")) } as unknown as SpApiClient;
    const result = await salesGetMetricsTool(client, config, { interval: INTERVAL });
    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain("rate limited");
  });
});
