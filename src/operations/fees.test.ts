// src/operations/fees.test.ts
// Product Fees API v0
// Model: product-fees-api-model/productFeesV0.json
// Note: this API uses PascalCase body fields (FeesEstimateRequest, MarketplaceId, etc.)
import { describe, it, expect, vi } from "vitest";
import type { SpApiClient } from "../client";
import { getMyFeesEstimateForASIN } from "./fees";

function makeClient(returnValue: unknown) {
  return { request: vi.fn().mockResolvedValue(returnValue) } as unknown as SpApiClient;
}

describe("getMyFeesEstimateForASIN", () => {
  it("calls correct operation, method, path with Asin in URL and correct POST body", async () => {
    const client = makeClient({ payload: {} });
    await getMyFeesEstimateForASIN(client, {
      Asin: "B001234567",
      FeesEstimateRequest: {
        MarketplaceId: "ATVPDKIKX0DER",
        IsAmazonFulfilled: true,
        Identifier: "my-request-1",
        PriceToEstimateFees: {
          ListingPrice: { CurrencyCode: "USD", Amount: 29.99 },
        },
      },
    });

    expect(client.request).toHaveBeenCalledOnce();
    const opts = (client.request as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    expect(opts.operation).toBe("getMyFeesEstimateForASIN");
    expect(opts.method).toBe("POST");
    expect(opts.path).toBe("/products/fees/v0/items/B001234567/feesEstimate");
    expect(opts.body).toEqual({
      FeesEstimateRequest: {
        MarketplaceId: "ATVPDKIKX0DER",
        IsAmazonFulfilled: true,
        Identifier: "my-request-1",
        PriceToEstimateFees: {
          ListingPrice: { CurrencyCode: "USD", Amount: 29.99 },
        },
      },
    });
  });

  it("handles optional IsAmazonFulfilled omitted (undefined body field)", async () => {
    const client = makeClient({ payload: {} });
    await getMyFeesEstimateForASIN(client, {
      Asin: "B002",
      FeesEstimateRequest: {
        MarketplaceId: "ATVPDKIKX0DER",
        Identifier: "req-2",
        PriceToEstimateFees: {
          ListingPrice: { CurrencyCode: "USD", Amount: 9.99 },
        },
      },
    });

    const opts = (client.request as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    expect(opts.path).toBe("/products/fees/v0/items/B002/feesEstimate");
    expect(opts.body.FeesEstimateRequest.MarketplaceId).toBe("ATVPDKIKX0DER");
    expect(opts.body.FeesEstimateRequest.IsAmazonFulfilled).toBeUndefined();
  });
});
